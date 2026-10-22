import { useTienePlan } from "@/lib/accesos-panel";
import { HORAS_HISTORIAL_ESTANDAR } from "@/lib/plan";
import { LlegaConPlan } from "@/components/LlegaConPlan";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Search, Smartphone } from "lucide-react";
import { motivoSaltable, puedeVerCambio, textoMotivo, type Cambio, type TipoCambio } from "@/lib/cambios";
import { deshacerDesdeHistorial, estadoDeshacer, useCambios } from "@/lib/deshacer-maqueta";
import { dispositivoId } from "@/lib/dispositivo";
import { useSalonStore } from "@/lib/store";
import { agruparPorDia, useHistorialServidor } from "@/lib/historial-panel";
import { useRealSalonSlug } from "@/lib/use-real-salon";
import { STATUS_OPTIONS } from "@/lib/appointment-status";
import { usePermisos } from "@/lib/accesos-panel";
import { puede } from "@/lib/permisos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Ajustes › Historial de cambios (lote 12, conectado a salón real en el 14):
 * lo cambiado, por día, con quién, qué, antes → después y «Deshacer» cuando
 * se puede (o el motivo cuando no). Nunca borra filas: deshacer añade otra.
 *
 * En la demo son los cambios de este navegador (`useCambios`). En un salón
 * real es `listarCambios` del servidor, paginado por día con «Cargar más».
 * «Deshacer» solo se ofrece para un cambio que la store de ESTE navegador
 * conoce (el que se acaba de hacer aquí, o el que ya trajo esta sesión): es
 * la única forma fiable de saber si sigue pudiéndose deshacer. Un cambio de
 * otro dispositivo que el servidor sí enseña se ve igualmente, sin botón.
 */

type Grupo = "citas" | "clientas" | "dinero" | "carta" | "equipo" | "web" | "ajustes";
const GRUPOS: Array<[Grupo | "todo", string]> = [
  ["todo", "Todo"],
  ["citas", "Citas"],
  ["dinero", "Cobros y señales"],
  ["clientas", "Clientas"],
  ["carta", "Servicios"],
  ["equipo", "Equipo y horarios"],
  ["web", "Mi página"],
  ["ajustes", "Ajustes"],
];

function grupoDe(t: TipoCambio): Grupo {
  if (t === "cita.cobrar" || t.startsWith("senal.") || t.startsWith("recargo.")) return "dinero";
  if (t.startsWith("cita.")) return "citas";
  if (t.startsWith("clienta.")) return "clientas";
  if (t.startsWith("servicio.")) return "carta";
  if (t === "profesional.editar" || t === "horario.editar") return "equipo";
  if (t.startsWith("perfil.")) return "web";
  return "ajustes";
}

const ESTADO = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
const diaLargo = (iso: string) => {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  const t = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const fechaHora = (v: unknown) => (typeof v === "string" && v ? new Date(v).toLocaleString("es-ES", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "—");
const euros = (v: unknown) => (typeof v === "number" ? `${v} €` : "—");

/** «vie 10:00 → sáb 11:30», «Pendiente → Cancelada»… cuando hay un dato simple que comparar. */
export function antesDespues(c: Cambio): string | null {
  const a = c.antes;
  const d = c.despues;
  if ("status" in d) return `${ESTADO[String(a.status)] ?? "—"} → ${ESTADO[String(d.status)] ?? "—"}`;
  if ("start" in d) return `${fechaHora(a.start)} → ${fechaHora(d.start)}`;
  if ("duration" in d) return `${a.duration ?? "—"} min → ${d.duration ?? "—"} min`;
  if ("paidAt" in d || "paymentMethod" in d) return d.paidAt ? `Sin cobrar → Cobrada${d.paymentMethod ? ` (${d.paymentMethod})` : ""}` : "Cobrada → Sin cobrar";
  if ("penaltyEur" in d) return `${euros(a.penaltyEur)} → ${euros(d.penaltyEur)}`;
  if ("manualBlock" in d) return d.manualBlock ? "Puede reservar → Bloqueada" : "Bloqueada → Puede reservar";
  if ("servicio" in d) {
    const sa = a.servicio as { name?: string; priceEur?: number; durationMin?: number; active?: boolean } | null;
    const sd = d.servicio as typeof sa;
    if (!sd) return null;
    if (sa && sa.priceEur !== sd.priceEur) return `${euros(sa.priceEur)} → ${euros(sd.priceEur)}`;
    if (sa && sa.durationMin !== sd.durationMin) return `${sa.durationMin} min → ${sd.durationMin} min`;
    if (sa && sa.active !== sd.active) return sd.active === false ? "Se puede reservar → Oculto" : "Oculto → Se puede reservar";
  }
  return null;
}

export function HistorialCambios() {
  const realSlug = useRealSalonSlug();
  const esReal = Boolean(realSlug);
  const locales = useCambios((s) => s.cambios);
  // Lote 13: fuera de Estándar (28-sep: bajó de Embajador), las últimas 24 h (el aviso de 10 s sigue en todos los planes).
  const completo = useTienePlan("historial-completo");
  const servidor = useHistorialServidor(realSlug ?? "", esReal, completo);
  const permisos = usePermisos();
  const miembro = useSalonStore((s) => s.miembro);
  // Cada persona ve y deshace LO SUYO; quien tiene «deshacer lo ajeno» (gerente, subencargada) ve lo de todas.
  const veTodo = puede(permisos, "historial.deshacer-ajeno");
  const quien = miembro?.userId ?? null;
  const [soloAqui, setSoloAqui] = useState(false);
  const [aquiId, setAquiId] = useState("");
  useEffect(() => setAquiId(dispositivoId()), []);
  // En un salón real, la lista del servidor (que ya llegó fusionada a la store) más lo hecho aquí y aún sin subir;
  // la versión de la store gana (refleja un «deshecho» reciente). En la demo, la lista local.
  const todos = useMemo(() => {
    if (!esReal) return locales;
    const porId = new Map(locales.map((c) => [c.id, c]));
    const delServidor = servidor.cambios.map((c) => porId.get(c.id) ?? c);
    const ids = new Set(delServidor.map((c) => c.id));
    const soloLocales = locales.filter((c) => !ids.has(c.id) && Date.parse(c.fecha) >= Date.now() - 24 * 3_600_000);
    return [...soloLocales, ...delServidor].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [esReal, locales, servidor.cambios]);
  const cambios = useMemo(
    () => todos.filter((c) => (completo || Date.now() - Date.parse(c.fecha) <= HORAS_HISTORIAL_ESTANDAR * 3_600_000) && puedeVerCambio(c, quien, veTodo || !esReal)),
    [todos, completo, quien, veTodo, esReal],
  );
  const [grupo, setGrupo] = useState<Grupo | "todo">("todo");
  const [persona, setPersona] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  // Se vuelve a pintar tras deshacer (la lista cambia), así que el estado de cada fila está al día.
  const personas = useMemo(() => [...new Set(cambios.map((c) => c.autorNombre ?? "Demo"))], [cambios]);
  const veDinero = puede(permisos, "dinero.ver-global") || !!permisos.acciones.get("dinero.ver-propio");
  const filtrados = cambios.filter(
    (c) =>
      (grupo === "todo" || grupoDe(c.tipo) === grupo) &&
      (persona === "todas" || (c.autorNombre ?? "Demo") === persona) &&
      (!soloAqui || (!!aquiId && c.dispositivoId === aquiId)) &&
      (veDinero || grupoDe(c.tipo) !== "dinero") &&
      (!busca.trim() || c.resumen.toLowerCase().includes(busca.trim().toLowerCase())),
  );
  const porDia = agruparPorDia(filtrados, diaLargo);

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-cafe-medio">
        {veTodo || !esReal ? "Lo que se ha cambiado en el panel" : "Lo que has cambiado tú en el panel"}{" "}
        {completo ? "en los últimos 90 días." : `en las últimas ${HORAS_HISTORIAL_ESTANDAR} horas.`} Deshacer no borra nada: añade una fila más.
        {esReal && !veTodo && " Puedes verlo y deshacerlo desde cualquiera de tus dispositivos."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 basis-48 items-center gap-2 rounded-full border border-input bg-blanco px-3 text-muted-foreground">
          <Search className="size-4 shrink-0" strokeWidth={1.6} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Clienta o servicio" aria-label="Buscar en el historial" className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none" />
        </label>
        <select value={grupo} onChange={(e) => setGrupo(e.target.value as Grupo | "todo")} aria-label="Qué cambios" className="h-9 rounded-full border border-input bg-blanco px-3 text-[13.5px]">
          {GRUPOS.filter(([g]) => veDinero || g !== "dinero").map(([g, t]) => (
            <option key={g} value={g}>
              {t}
            </option>
          ))}
        </select>
        {veTodo && personas.length > 1 && (
          <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Quién" className="h-9 rounded-full border border-input bg-blanco px-3 text-[13.5px]">
            <option value="todas">Todas</option>
            {personas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-input bg-blanco px-3 text-[13.5px]">
          <input type="checkbox" checked={soloAqui} onChange={(e) => setSoloAqui(e.target.checked)} data-testid="solo-este-dispositivo" className="size-4 accent-current" />
          Solo este dispositivo
        </label>
      </div>
      {esReal && servidor.aviso && !servidor.error && (
        <p role="status" className="text-[12.5px] text-muted-foreground">
          {servidor.aviso} Mientras tanto verás solo lo que se haga desde este aparato.
        </p>
      )}

      {esReal && servidor.cargando ? (
        <p className="flex items-center gap-2 rounded-2xl border border-dashed border-lino px-4 py-6 text-center text-[14px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Cargando el historial…
        </p>
      ) : esReal && servidor.error ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-lino px-4 py-6 text-center text-[14px] text-muted-foreground">
          <p>{servidor.error}</p>
          <Button variant="outline" size="sm" onClick={servidor.recargar}>
            Reintentar
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-lino px-4 py-6 text-center text-[14px] text-muted-foreground">
          {cambios.length === 0 ? `Todavía no hay cambios${completo ? "" : ` en las últimas ${HORAS_HISTORIAL_ESTANDAR} horas`}. Lo que confirmes, muevas, cobres o guardes —y cada texto, foto u horario que cambies en Mi página— aparecerá aquí, con quién lo hizo, cuándo y desde qué aparato, y un botón para deshacerlo.` : "Nada con ese filtro."}
        </p>
      ) : (
        porDia.map(([dia, lista]) => (
          <section key={dia}>
            <h4 className="px-1 pb-1.5 text-[13px] font-bold text-cafe-medio">{dia}</h4>
            <ul className="divide-y divide-lino overflow-hidden rounded-2xl border border-lino bg-card">
              {lista.map((c) => (
                <FilaCambio key={c.id} c={c} esteAparato={!!aquiId && c.dispositivoId === aquiId} />
              ))}
            </ul>
          </section>
        ))
      )}
      {esReal && completo && servidor.hayMas && !servidor.cargando && !servidor.error && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={servidor.cargarMas} disabled={servidor.cargandoMas}>
            {servidor.cargandoMas ? <Loader2 className="size-4 animate-spin" /> : null}
            Cargar más
          </Button>
        </div>
      )}
      {!completo && (
        <p className="text-[12.5px] text-muted-foreground" data-testid="nota-versiones-web">
          Lo de más de {HORAS_HISTORIAL_ESTANDAR} horas no sale aquí con tu plan, pero tu página no se pierde: en Mi página › Versiones puedes volver a cualquiera de las últimas publicaciones.
        </p>
      )}
      {!completo && <LlegaConPlan funcion="historial-completo" compacta />}
    </div>
  );
}

/** Una fila del historial. El «Deshacer» pide confirmación en la propia fila (sin ventanas aparte). */
function FilaCambio({ c, esteAparato }: { c: Cambio; esteAparato: boolean }) {
  // `locales` fuerza el repintado al cambiar la store (p. ej. tras deshacer algo).
  useCambios((s) => s.cambios);
  const [confirmando, setConfirmando] = useState<null | "normal" | "forzar">(null);
  const [haciendo, setHaciendo] = useState(false);
  const e = c.deshaceA || c.deshechoEn ? null : estadoDeshacer(c.id);
  const detalle = antesDespues(c);
  const saltable = !!e && !e.puede && motivoSaltable(e.motivo) && estadoDeshacer(c.id, true).puede;
  const ejecutar = async (forzar: boolean) => {
    setHaciendo(true);
    try {
      await deshacerDesdeHistorial(c.id, { forzar });
    } finally {
      setHaciendo(false);
      setConfirmando(null);
    }
  };
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-2.5 sm:flex-nowrap" data-testid="fila-cambio">
      <span className="w-12 shrink-0 pt-0.5 text-[13px] font-bold tabular-nums text-cafe-medio">{hora(c.fecha)}</span>
      <div className="min-w-0 flex-1">
        <p className={cn("break-words text-[14px]", (c.deshechoEn || c.deshaceA) && "text-cafe-medio")}>
          <b className="font-bold">{c.autorNombre ?? "Demo"}</b> · {c.deshaceA ? `Deshizo: ${c.resumen.replace(/^Deshecho:\s*/i, "")}` : c.resumen}
          {c.avisoEnviado && <MessageCircle className="ml-1.5 inline size-3.5 text-hoja-tinta" strokeWidth={1.8} aria-label="Se le escribió por WhatsApp" />}
        </p>
        {detalle && <p className="text-[12.5px] text-muted-foreground tabular-nums">{detalle}</p>}
        {c.dispositivoNombre && (
          <p className="flex items-center gap-1 text-[12.5px] text-muted-foreground" data-testid="cambio-dispositivo">
            <Smartphone className="size-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {c.dispositivoNombre}
            {esteAparato && " (este aparato)"}
          </p>
        )}
        {e && !e.puede && e.motivo !== "PERMISO" && e.motivo !== "DESHECHO" && <p className="text-[12.5px] text-muted-foreground">{textoMotivo(e.motivo)}</p>}
        {confirmando && (
          <div role="alertdialog" aria-label="Confirmar deshacer" className="mt-2 rounded-xl border border-lino bg-arena px-3 py-2.5 text-[13.5px]" data-testid="confirmar-deshacer">
            <p className="font-bold">{confirmando === "forzar" ? "Esto cambió después de que lo hicieran." : "¿Deshacer este cambio?"}</p>
            <p className="text-cafe-medio">
              {confirmando === "forzar"
                ? "Si sigues, se vuelve a lo de antes y se pisa lo que se hizo desde entonces sobre esto mismo."
                : "Todo vuelve a como estaba antes. No se borra nada: queda anotado aquí."}
              {c.avisoEnviado && " Ojo: a la clienta ya se le escribió por WhatsApp."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" className="h-9 rounded-full px-4 font-bold" disabled={haciendo} onClick={() => void ejecutar(confirmando === "forzar")} data-testid="confirmar-deshacer-si">
                {haciendo ? <Loader2 className="size-4 animate-spin" /> : null}
                {confirmando === "forzar" ? "Deshacer igualmente" : "Sí, deshacer"}
              </Button>
              <Button size="sm" variant="outline" className="h-9 rounded-full px-4" disabled={haciendo} onClick={() => setConfirmando(null)}>
                No, dejarlo
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="shrink-0">
        {c.deshechoEn ? (
          <span className="rounded-full bg-arena px-2.5 py-0.5 text-[12px] font-bold text-cafe-medio">Deshecho</span>
        ) : !confirmando && e?.puede ? (
          <Button size="sm" variant="outline" className="h-9 rounded-full px-3 font-bold" onClick={() => setConfirmando("normal")}>
            Deshacer
          </Button>
        ) : !confirmando && saltable ? (
          <Button size="sm" variant="outline" className="h-9 rounded-full px-3 font-bold" onClick={() => setConfirmando("forzar")}>
            Deshacer igualmente
          </Button>
        ) : null}
      </div>
    </li>
  );
}
