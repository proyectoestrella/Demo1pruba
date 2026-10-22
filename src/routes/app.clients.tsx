import { fichaDeClientaMemo } from "@/lib/selectores-rutas";
import { useFichas } from "@/lib/use-fichas";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { useCitasVisibles, usePermisos } from "@/lib/accesos-panel";
import { puede } from "@/lib/permisos";
import { recargoActivo } from "@/lib/recargo-activo";
import { usaTpv123 } from "@/lib/plan-basico";
import { clientFrequency } from "@/lib/derive";
import { useBusinessType } from "@/lib/use-display-profile";
import { buscarClientas } from "@/lib/buscar-clientas";
import { useEquipo } from "@/lib/use-equipo";
import { toDateKey } from "@/lib/reparto";
import type { Appointment, Client } from "@/lib/mock/types";
import { EmptyState } from "@/components/EmptyState";
import { AvatarClienta } from "@/components/Avatar";
import { ImportarClientasDialog } from "@/components/ImportarClientasDialog";
import { Button } from "@/components/ui/button";
import { RecargosPendientes } from "@/components/RecargosPendientes";
import { CampoFiltro } from "@/components/CampoFiltro";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { eur, eurRedondo, hora } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { Users, Download } from "lucide-react";

export const Route = createFileRoute("/app/clients")({ component: Clients });

const DAY_MS = 86400_000;
const SIN_CITAS: Appointment[] = [];
/** Sin visita en más de 60 días se trata como "en riesgo" de perderlo. */
const INACTIVE_DAYS = 60;
/** 3 o más visitas ya es un patrón, no una casualidad. */
const REGULAR_VISITS = 3;
/** "Nuevo" mientras el alta tenga menos de un mes. */
const NEW_DAYS = 30;

type ClientTag = "nuevo" | "habitual" | "inactivo" | "activo";

const TAG_CONFIG: Record<ClientTag, { label: string; className: string }> = {
  nuevo: { label: "Nueva", className: "bg-salvia-clara text-hoja-tinta" },
  habitual: { label: "Habitual", className: "bg-nata text-cafe-medio" },
  inactivo: { label: "Inactiva", className: "bg-arena text-cafe-medio" },
  activo: { label: "Activa", className: "bg-nata text-cafe-medio" },
};

/** Triángulo de aviso (el color nunca va solo). */
function IconoAviso() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </svg>
  );
}

const chip =
  "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-bold whitespace-nowrap";

type Row = Client & ReturnType<typeof clientFrequency>;

function tagFor(row: Row, now: number): ClientTag {
  const isRecent = now - +new Date(row.createdAt) < NEW_DAYS * DAY_MS;
  // Desde que "última visita" solo cuenta las citas pasadas, un cliente que
  // acaba de reservar para la semana que viene se quedaba sin ninguna: sin
  // esta salida caía en "inactivo", que es justo lo contrario de lo que es.
  if (!row.lastVisit) {
    if (isRecent) return "nuevo";
    return row.nextVisit ? "activo" : "inactivo";
  }
  const daysSinceLast = (now - +new Date(row.lastVisit)) / DAY_MS;
  if (daysSinceLast > INACTIVE_DAYS) return "inactivo";
  if (row.pastVisits >= REGULAR_VISITS) return "habitual";
  if (isRecent) return "nuevo";
  return "activo";
}

function TagPill({ tag }: { tag: ClientTag }) {
  const cfg = TAG_CONFIG[tag];
  return <span className={cn(chip, cfg.className)}>{cfg.label}</span>;
}

const fechaCortaSinAnio = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "")
    : "—";

type Filtro = "todos" | "hoy" | ClientTag | "color" | "penalizado";

function Clients() {
  // Lote 11: sin «ver todas», sus clientas (las que tienen o tuvieron cita con
  // ella), empezando por las de hoy; el buscador encuentra a cualquiera para darle cita.
  const permisos = usePermisos();
  const esBarberia = useBusinessType() === "barberia";
  const todasLasClientas = puede(permisos, "clienta.ver-todas");
  const appointments = useCitasVisibles();
  const todasLasCitas = useSalonStore((s) => s.appointments);
  const clientesSalon = useSalonStore((s) => s.clients);
  const propias = useMemo(() => new Set(appointments.map((a) => a.clientId)), [appointments]);
  const clients = useMemo(
    () => (todasLasClientas ? clientesSalon : clientesSalon.filter((c) => propias.has(c.id))),
    [todasLasClientas, clientesSalon, propias],
  );
  const services = useSalonStore((s) => s.services);
  const equipo = useEquipo();
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur);
  const origenTpv123 = useSalonStore((s) => usaTpv123(s.salonProfile));
  const conRecargo = recargoActivo({ noShowFeeEur });
  const { abrirClienta } = useFichas();
  const setSelected = (c: Client | null) => {
    if (c) abrirClienta(c.id);
  };
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>(todasLasClientas ? "todos" : "hoy");
  /** Filas a la vista: de 20 en 20, y vuelve a 20 al cambiar filtro o búsqueda. */
  const [cuantas, setCuantas] = useState(20);
  useEffect(() => setCuantas(20), [filtro, busqueda]);

  // Lote 16: «ahora» fijo mientras la pantalla está abierta (al minuto no
  // cambia nada de lo que se enseña) para poder memoizar lo pesado.
  const [now] = useState(() => Date.now());
  const hoyClave = toDateKey(new Date(now));

  // Lote 16: las citas se agrupan por clienta UNA vez. Antes cada una de las
  // ~600 clientas recorría las ~3.300 citas varias veces en cada pintado.
  const citasPorClienta = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const l = m.get(a.clientId);
      if (l) l.push(a);
      else m.set(a.clientId, [a]);
    }
    return m;
  }, [appointments]);

  // El recorte va DESPUÉS de buscar: al revés, el buscador solo miraría dentro
  // de los 40 primeros. Y ya no se esconde a quien no tiene visitas todavía:
  // un cliente recién dado de alta también hay que poder encontrarlo.
  const allRows: (Row & { tag: ClientTag })[] = useMemo(
    () =>
      clients
        .map((c) => ({
          ...c,
          ...clientFrequency(citasPorClienta.get(c.id) ?? SIN_CITAS, c.id, new Date(now)),
        }))
        .map((r) => ({ ...r, tag: tagFor(r, now) })),
    [clients, citasPorClienta, now],
  );

  const kpis = {
    total: allRows.length,
    nuevos: allRows.filter((r) => now - +new Date(r.createdAt) < NEW_DAYS * DAY_MS).length,
    habituales: allRows.filter((r) => r.tag === "habitual").length,
    enRiesgo: allRows.filter((r) => r.tag === "inactivo").length,
  };

  // Citas de hoy por clienta: «Hoy 12:00» en la fila y el filtro «Vienen hoy».
  const citaDeHoy = useMemo(() => {
    const m = new Map<string, Appointment>();
    for (const a of appointments) {
      if (a.status === "cancelled" || a.status === "blocked") continue;
      if (toDateKey(new Date(a.start)) !== hoyClave) continue;
      const previa = m.get(a.clientId);
      if (!previa || +new Date(a.start) < +new Date(previa.start)) m.set(a.clientId, a);
    }
    return m;
  }, [appointments, hoyClave]);

  const limiteColor = now + 14 * DAY_MS;
  const proximasSinColor = useMemo(
    () =>
      allRows
        .flatMap((client) => {
          const suyas = citasPorClienta.get(client.id) ?? SIN_CITAS;
          const cita = suyas
            .filter(
              (a) =>
                (a.status === "confirmed" || a.status === "pending") &&
                +new Date(a.start) >= now &&
                +new Date(a.start) <= limiteColor,
            )
            .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
          const tieneColor = suyas.some(
            (a) => a.status === "completed" && +new Date(a.start) < now && !!a.colorFormula?.trim(),
          );
          return cita && !tieneColor ? [{ client, cita }] : [];
        })
        .sort((a, b) => +new Date(a.cita.start) - +new Date(b.cita.start)),
    [allRows, citasPorClienta, now, limiteColor],
  );
  const colorPendiente = useMemo(
    () => new Set(proximasSinColor.map((x) => x.client.id)),
    [proximasSinColor],
  );

  // Solo se ofrece el filtro cuando hay a quién filtrar: una pestaña "Me
  // deben" vacía es ruido en cualquier demo sin plantones.
  const hayPenalizados =
    conRecargo &&
    puede(permisos, "recargo.gestionar") &&
    allRows.some((r) => (r.penaltyEur ?? 0) > 0);

  // Lote 16: sin texto no hay nada que buscar (antes se normalizaban todas las fichas igualmente).
  // Móvil (22-oct): la caja de texto se pinta al instante y la lista sigue
  // cuando puede (con ~1.300 clientas, cada tecla recalculaba todo en el acto).
  const busquedaDiferida = useDeferredValue(busqueda);
  const hayBusqueda = busquedaDiferida.trim().length > 0;
  const buscados = useMemo(
    () => (hayBusqueda ? buscarClientas(busquedaDiferida, { clientes: clients, citas: appointments }) : clients),
    [hayBusqueda, busquedaDiferida, clients, appointments],
  );
  // Fuera de las suyas: las del salón que coinciden, solo para darles cita (ficha reducida).
  const otrasDelSalon = useMemo(
    () =>
      !todasLasClientas && busquedaDiferida.trim().length >= 2
        ? buscarClientas(busquedaDiferida, { clientes: clientesSalon, citas: todasLasCitas }).filter((c) => !propias.has(c.id)).slice(0, 5)
        : [],
    [todasLasClientas, busquedaDiferida, clientesSalon, todasLasCitas, propias],
  );
  const ordenBusqueda = useMemo(() => new Map(buscados.map((c, i) => [c.id, i])), [buscados]);
  const filtroEfectivo: Filtro = filtro === "penalizado" && !conRecargo ? "todos" : filtro;
  const pasa = (c: Row & { tag: ClientTag }) => {
    switch (filtroEfectivo) {
      case "todos":
        return true;
      case "hoy":
        return citaDeHoy.has(c.id);
      case "color":
        return colorPendiente.has(c.id);
      case "penalizado":
        return (c.penaltyEur ?? 0) > 0;
      default:
        return c.tag === filtroEfectivo;
    }
  };
  const rows = useMemo(() => allRows
    .filter(pasa)
    .filter((c) => ordenBusqueda.has(c.id))
    .sort((a, b) =>
      hayBusqueda
        ? ordenBusqueda.get(a.id)! - ordenBusqueda.get(b.id)!
        : filtroEfectivo === "hoy"
          ? +new Date(citaDeHoy.get(a.id)!.start) - +new Date(citaDeHoy.get(b.id)!.start)
          : b.totalSpent - a.totalSpent,
    )
    // Sin tope (22-oct): con ~1.250 clientas importadas, «Ver más» debe llegar a todas;
    // la tabla pinta de 20 en 20 (`cuantas`) y las fichas solo se calculan para esas.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `pasa` solo lee filtroEfectivo, citaDeHoy y colorPendiente
    , [allRows, ordenBusqueda, hayBusqueda, filtroEfectivo, citaDeHoy, colorPendiente]);

  // Frecuencia y servicio habitual salen de la ficha (con la carta viva), solo
  // para las filas que se ven.
  const fichas = new Map(
    rows.slice(0, cuantas).map((c) => [
      c.id,
      fichaDeClientaMemo(c.id, {
        citas: citasPorClienta.get(c.id) ?? SIN_CITAS,
        clientes: clients,
        servicios: services,
        equipo,
        ahora: new Date(now),
      }).resumen,
    ]),
  );
  const frecuencia = (id: string) => {
    const d = fichas.get(id)?.frecuenciaMediaDias;
    if (d === undefined) return "—";
    return d < 14 ? `cada ${d} días` : `cada ${Math.round(d / 7)} sem.`;
  };
  const semanasSinVenir = (r: Row) =>
    r.lastVisit ? Math.floor((now - +new Date(r.lastVisit)) / (7 * DAY_MS)) : null;

  const estado = (c: Row & { tag: ClientTag }) => {
    const hoy = citaDeHoy.get(c.id);
    const sem = semanasSinVenir(c);
    // Un solo chip por fila: el más relevante. El resto vive en la ficha.
    let chipFila: ReactNode = null;
    if (conRecargo && (c.penaltyEur ?? 0) > 0) {
      chipFila = (
        <span className={cn(chip, "bg-melocoton text-melocoton-tinta")}>
          <IconoAviso />
          Debe {eur(c.penaltyEur!)}
        </span>
      );
    } else if (hoy) {
      chipFila = (
        <span className={cn(chip, "bg-salvia-clara text-hoja-tinta tabular-nums")}>
          Hoy {hora(hoy.start)}
        </span>
      );
    } else if (!esBarberia && colorPendiente.has(c.id)) {
      chipFila = (
        <span className={cn(chip, "bg-melocoton text-melocoton-tinta")}>
          <IconoAviso />
          Color pendiente
        </span>
      );
    } else if (c.tag === "inactivo" && sem !== null) {
      chipFila = (
        <span className={cn(chip, "bg-arena text-cafe-medio tabular-nums")}>
          {sem} sem. sin venir
        </span>
      );
    } else if (c.tag === "nuevo") {
      chipFila = <TagPill tag={c.tag} />;
    }
    return chipFila;
  };

  return (
    <div className="pagina">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] md:text-[32px]">
            {esBarberia ? "Clientes" : "Clientas"}
          </h1>
          {/* La cartera en una línea de texto, como las cifras de Hoy. */}
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[15px] text-cafe-medio">
            <span className="whitespace-nowrap">
              <b className="text-foreground tabular-nums">{kpis.total}</b>{" "}
              {esBarberia ? "clientes" : "clientas"}
            </span>
            <span className="text-taupe" aria-hidden="true">
              ·
            </span>
            <span className="whitespace-nowrap" title="Dadas de alta en 30 días">
              <b className="text-foreground tabular-nums">{kpis.nuevos}</b> nuevas este mes
            </span>
            <span className="text-taupe" aria-hidden="true">
              ·
            </span>
            <span className="whitespace-nowrap" title="Tres visitas o más">
              <b className="text-foreground tabular-nums">{kpis.habituales}</b> recurrentes
            </span>
            {kpis.enRiesgo > 0 && (
              <>
                <span className="text-taupe" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => setFiltro("inactivo")}
                  className="whitespace-nowrap hover:text-foreground"
                  title="Más de 60 días sin venir: ver las inactivas"
                >
                  <b className="text-primary tabular-nums">{kpis.enRiesgo}</b> en riesgo
                </button>
              </>
            )}
          </p>
        </div>
        {puede(permisos, "clienta.importar") && (
          <Button
            type="button"
            variant="outline"
            className="md:ml-auto"
            onClick={() => setImportarAbierto(true)}
          >
            <Download className="size-[18px]" strokeWidth={1.6} />
            {origenTpv123
              ? "Importar desde TPV 123"
              : esBarberia
                ? "Importar clientes"
                : "Importar clientas"}
          </Button>
        )}
      </div>

      {/* Recargos pendientes destacados: Adam pidió esto expresamente el
          17-sep. El propio componente enseña un estado vacío amable cuando
          no hay ninguno pendiente. */}
      {conRecargo && <RecargosPendientes title="Recargos pendientes" />}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div
          className="sin-scrollbar flex min-w-0 max-w-full gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,black_88%,transparent)] lg:[mask-image:none]"
          role="group"
          aria-label="Filtrar clientas"
        >
          {[
            { id: "todos", etiqueta: "Todas" },
            {
              id: "hoy",
              etiqueta: (
                <>
                  Vienen hoy{" "}
                  <span className="ml-1 tabular-nums text-muted-foreground">{citaDeHoy.size}</span>
                </>
              ),
            },
            { id: "nuevo", etiqueta: esBarberia ? "Nuevos" : "Nuevas" },
            { id: "habitual", etiqueta: "Habituales" },
            { id: "inactivo", etiqueta: esBarberia ? "Inactivos" : "Inactivas" },
            ...(esBarberia
              ? []
              : [
                  {
                    id: "color",
                    etiqueta: (
                      <>
                        Color pendiente{" "}
                        <span className="ml-1 tabular-nums text-muted-foreground">
                          {proximasSinColor.length}
                        </span>
                      </>
                    ),
                  },
                ]),
            ...(hayPenalizados ? [{ id: "penalizado", etiqueta: "Me deben" }] : []),
          ].map(({ id, etiqueta }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtroEfectivo === id}
              onClick={() => setFiltro(id as Filtro)}
              className={cn(
                "h-9 shrink-0 rounded-full px-3 text-[13px] font-bold whitespace-nowrap",
                filtroEfectivo === id
                  ? "bg-cafe text-white shadow-sm"
                  : "bg-beige text-cafe-medio hover:bg-nata",
              )}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <CampoFiltro
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Filtrar: nombre, teléfono, notas o color"
          aria-label="Filtrar clientas"
          className="lg:ml-auto"
        />
      </div>

      {filtroEfectivo === "color" && (
        <p className="-mt-2 text-[12.5px] text-muted-foreground">
          Citadas en los próximos 14 días y sin ningún color anotado: ábrelas y añade su fórmula
          {origenTpv123 ? " de TPV 123" : ""} antes de que lleguen.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="flex-1 tarjeta-principal bg-card">
          {/* Dos vacíos muy distintos, y hasta ahora los dos decían lo mismo.
              Un salón que acaba de empezar, sin ningún cliente todavía y sin
              haber tocado ningún filtro, leía "prueba con otro término de
              búsqueda" y se quedaba buscando un filtro que no había puesto. */}
          {allRows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Todavía no tienes clientas"
              description="Aquí irá apareciendo cada persona que reserve contigo: su teléfono, lo que suele pedir y cuándo vino por última vez. La ficha se crea sola con la primera cita, o impórtalas desde un archivo."
            />
          ) : (
            <EmptyState
              icon={Users}
              title="Ninguna clienta coincide"
              description="Prueba con otro nombre o quita el filtro."
            />
          )}
        </div>
      ) : (
        <>
          {/* PC: tabla */}
          <div className="@container hidden min-w-0 flex-1 overflow-x-auto tarjeta-principal bg-card lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{esBarberia ? "Cliente" : "Clienta"}</TableHead>
                  <TableHead className="@max-[520px]:hidden">Última visita</TableHead>
                  <TableHead className="text-right @max-[420px]:hidden">Visitas</TableHead>
                  <TableHead className="group-data-[panel=abierto]/panel:hidden">
                    Frecuencia
                  </TableHead>
                  <TableHead className="hidden xl:table-cell xl:group-data-[panel=abierto]/panel:hidden">
                    Servicio habitual
                  </TableHead>
                  <TableHead className="group-data-[panel=abierto]/panel:hidden">
                    Próxima cita
                  </TableHead>
                  <TableHead className="text-right @max-[600px]:hidden">Gasto acumulado</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, cuantas).map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <AvatarClienta id={c.id} nombre={c.name} size="sm" />
                        <div className="min-w-0 leading-tight">
                          <b className="block truncate">{c.name}</b>
                          <span className="text-[12.5px] text-muted-foreground tabular-nums">
                            {c.phone}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums @max-[520px]:hidden">
                      {fechaCortaSinAnio(c.lastVisit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums @max-[420px]:hidden">
                      {c.pastVisits}
                    </TableCell>
                    <TableCell className="text-muted-foreground group-data-[panel=abierto]/panel:hidden">
                      {frecuencia(c.id)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground xl:table-cell xl:group-data-[panel=abierto]/panel:hidden">
                      {fichas.get(c.id)?.servicioHabitual ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums group-data-[panel=abierto]/panel:hidden">
                      {fechaCortaSinAnio(c.nextVisit)}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums @max-[600px]:hidden">
                      {eurRedondo(c.totalSpent)}
                    </TableCell>
                    <TableCell>{estado(c)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Móvil: tarjetas */}
          <div className="overflow-hidden tarjeta-principal bg-card lg:hidden">
            {rows.slice(0, cuantas).map((c) => {
              const estadoClienta = estado(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c)}
                  className="flex w-full items-center gap-3 border-t border-border px-[var(--relleno-tarjeta)] py-3 text-left first:border-t-0"
                >
                  <AvatarClienta id={c.id} nombre={c.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <b className="truncate">{c.name}</b>
                      <span className="shrink-0 font-bold tabular-nums">
                        {eurRedondo(c.totalSpent)}
                      </span>
                    </div>
                    <p className="truncate text-[12.5px] text-muted-foreground tabular-nums">
                      {c.pastVisits} {c.pastVisits === 1 ? "visita" : "visitas"} · última{" "}
                      {fechaCortaSinAnio(c.lastVisit)} · {frecuencia(c.id)}
                    </p>
                    {estadoClienta && <div className="mt-1.5">{estadoClienta}</div>}
                  </div>
                </button>
              );
            })}
          </div>
          {rows.length > cuantas && (
            <button
              type="button"
              onClick={() => setCuantas((n) => n + 20)}
              className="inline-flex items-center gap-1 self-start rounded-full px-3 py-2 text-[13.5px] font-bold text-cafe-medio hover:bg-beige"
            >
              Ver {Math.min(20, rows.length - cuantas)} más
              <span className="font-semibold text-cafe-suave tabular-nums">
                · {cuantas} de {rows.length}
              </span>
            </button>
          )}
        </>
      )}

      {otrasDelSalon.length > 0 && (
        <section className="rounded-2xl border border-lino bg-card px-[var(--relleno-tarjeta)] py-3">
          <h2 className="text-[13.5px] font-bold text-cafe-medio">
            Otras clientas del salón · para darles cita
          </h2>
          <ul className="mt-1.5 divide-y divide-lino">
            {otrasDelSalon.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className="flex w-full items-center gap-3 py-2 text-left hover:text-foreground"
                >
                  <AvatarClienta id={c.id} nombre={c.name} size="md" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                  <span className="text-[12.5px] text-muted-foreground tabular-nums">
                    {c.phone}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ImportarClientasDialog open={importarAbierto} onOpenChange={setImportarAbierto} />
    </div>
  );
}
