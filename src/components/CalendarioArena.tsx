import { useCitasVisibles, useEquipoVisible } from "@/lib/accesos-panel";
import { useOcupadoExterno, useSincronizarCalendarios } from "@/lib/calendarios-panel";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Palette, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { serviceLabelOf } from "@/lib/appointment-services";
import { franjasProfesional } from "@/lib/horario-equipo";
import { hora } from "@/lib/copy";
import { indiceColorServicio, minutosAHora } from "@/lib/hoy-arena";
import {
  carrilesSolapados,
  citasDeCalendario,
  horizonteDelDia,
  huecosDe,
  iniciales,
  inicioDelDia,
  minutosDe,
  mismoDia,
  ocupacionDe,
  pausasDe,
  porcentaje,
  type Tramo,
} from "@/lib/calendario-arena";
import type { Appointment, Employee, EmployeeId, Service } from "@/lib/mock/types";
import { cn } from "@/lib/utils";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { RejillaCalendario, colorProfesional, type ColumnaRejilla } from "@/components/RejillaCalendario";
import { CamposPreferenciasCalendario } from "@/components/CamposPreferenciasCalendario";
import { MAX_DIAS_ELEGIDOS, diasDesde, rangoDeDias, VISTAS_CALENDARIO, diasDeRejilla, inicioDeSemana, pasoDeVista, preferenciasDe, type PrimerDia, type VistaCalendario } from "@/lib/preferencias-calendario";

/**
 * Calendario con la identidad «Arena» (DESIGN.md), calcado del prototipo v2:
 * cuatro vistas (Día, Semana, Mes y Cronograma), paleta propia de pasteles
 * fríos en la que el color dice el SERVICIO, línea de «ahora» añil, huecos
 * libres que abren «Nueva cita» con la profesional y la hora puestas, y el
 * detalle de cada cita en el panel lateral de siempre.
 */

/** «rango» = Elegir días: no es vista predeterminada, vive mientras dura la sesión. */
type Vista = VistaCalendario | "rango";
const CLAVE_RANGO = "sishow-calendario-rango";

function fechaISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** El rango elegido, recordado en esta pestaña del navegador. */
function useRangoDeSesion() {
  const [rango, setRango] = useState<{ inicio: Date; n: number } | null>(() => {
    try {
      const g = JSON.parse(window.sessionStorage.getItem(CLAVE_RANGO) ?? "null") as { inicio: string; n: number } | null;
      if (!g) return null;
      const r = rangoDeDias(g.inicio, g.inicio);
      return "error" in r || !(g.n >= 1 && g.n <= MAX_DIAS_ELEGIDOS) ? null : { inicio: r.inicio, n: g.n };
    } catch {
      return null;
    }
  });
  const guardar = (r: { inicio: Date; n: number } | null) => {
    setRango(r);
    try {
      if (r) window.sessionStorage.setItem(CLAVE_RANGO, JSON.stringify({ inicio: fechaISO(r.inicio), n: r.n }));
      else window.sessionStorage.removeItem(CLAVE_RANGO);
    } catch {
      /* sin almacenamiento: dura hasta recargar */
    }
  };
  return [rango, guardar] as const;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DCORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const fechaTxt = (d: Date) => `${capital(DIAS[d.getDay()])}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
/** Pasteles de profesional para los avatares (taupe, salvia, nata tostada). */
const colorPro = (i: number) => `var(--stylist-${["mario", "diego", "ruben"][i % 3]})`;
/** Color de la barra de ocupación de la profesional, por orden del equipo. */
const barraPro = (i: number) => `var(--k-pro-${(i % 3) + 1})`;

type AbrirHueco = (employeeId: EmployeeId, minuto: number, dia: Date) => void;

function useAhora() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

/**
 * `inicio` (desde el asistente): abre en ese día, con esa cita a la vista o con
 * «Nueva cita» abierta. Sin él, hoy y la vista preferida.
 */
export function CalendarioArena({ inicio }: { inicio?: { dia?: string; cita?: string; nueva?: boolean } } = {}) {
  const visibles = useCitasVisibles();
  const services = useSalonStore((s) => s.services);
  const guardadas = useSalonStore((s) => s.salonProfile.calendario);
  const equipo = useEquipoVisible();
  const soloUno = esSoloUnProfesional(equipo);
  const carta = useMemo(() => selectServiceMap(services), [services]);
  const ahora = useAhora();
  const pref = preferenciasDe(guardadas);

  const citaInicial = inicio?.cita ? (visibles.find((a) => a.id === inicio.cita) ?? null) : null;
  const [anchor, setAnchor] = useState(() => {
    if (citaInicial) return inicioDelDia(new Date(citaInicial.start));
    const m = inicio?.dia?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : inicioDelDia(new Date());
  });
  // 14c: lo ocupado en Google/Apple, rayado y sin título (solo con los calendarios activados).
  useSincronizarCalendarios();
  const desdeExt = fechaISO(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 7));
  const hastaExt = fechaISO(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 42));
  const externos = useOcupadoExterno(desdeExt, hastaExt, equipo.map((e) => e.id));
  const appointments = useMemo(() => (externos.length ? [...visibles, ...externos] : visibles), [visibles, externos]);
  const [vista, setVista] = useState<Vista>(inicio?.dia || citaInicial ? "dia" : pref.vista);
  /** En Semana y 3 días: «todas» o el id de una profesional. */
  const [filtroPro, setFiltroPro] = useState<string>("todas");
  const [rango, setRango] = useRangoDeSesion();
  const [rangoAbierto, setRangoAbierto] = useState(false);
  const [seleccionada, setSeleccionada] = useState<Appointment | null>(citaInicial);
  const [prefill, setPrefill] = useState<{ date: Date; employeeId: EmployeeId } | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(!!inicio?.nueva);
  /** Huecos libres y ocupación del día, plegados bajo la rejilla. */
  const [verPie, setVerPie] = useState(false);
  /** Ensancha la rejilla para enseñar las citas fuera de las horas visibles. */
  /** Sube cada vez que se pulsa «Hoy»: la rejilla baja hasta ahora. */
  const [irAAhora, setIrAAhora] = useState(0);

  const citasDia = useMemo(() => citasDeCalendario(appointments, anchor), [appointments, anchor]);
  const esHoy = mismoDia(anchor, ahora);
  const desde = esHoy ? minutosDe(ahora) : undefined;
  const huecosDia = useMemo(
    () =>
      equipo.flatMap((e) =>
        huecosDe(citasDia, e, anchor.getDay(), { desde }).map((t) => ({ ...t, e })),
      ),
    [citasDia, equipo, anchor, desde],
  );

  const abrirHueco: AbrirHueco = (employeeId, minuto, dia) => {
    const date = new Date(dia);
    date.setHours(Math.floor(minuto / 60), minuto % 60, 0, 0);
    setPrefill({ date, employeeId });
    setNuevaAbierta(true);
  };

  function mover(n: number) {
    const d = new Date(anchor);
    if (vista === "rango" && rango) {
      setRango({ inicio: new Date(rango.inicio.getFullYear(), rango.inicio.getMonth(), rango.inicio.getDate() + n * rango.n), n: rango.n });
      return;
    }
    if (vista === "mes") {
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
    } else {
      d.setDate(d.getDate() + n * pasoDeVista(vista === "rango" ? "dia" : vista));
    }
    setAnchor(d);
  }
  const abrirDia = (d: Date) => {
    setAnchor(inicioDelDia(d));
    setVista("dia");
  };

  const esRejilla = vista === "dia" || vista === "tres" || vista === "semana" || (vista === "rango" && !!rango);
  const diasRejilla =
    vista === "rango" && rango ? diasDesde(rango.inicio, rango.n) : esRejilla && vista !== "rango" ? diasDeRejilla(anchor, vista, pref.primerDia) : [];
  const variosDias = vista === "semana" || vista === "tres" || vista === "rango";
  let titulo: string;
  if (variosDias && diasRejilla.length > 0) {
    const pri = diasRejilla[0];
    const ult = diasRejilla[diasRejilla.length - 1];
    titulo =
      pri.getMonth() === ult.getMonth()
        ? `${pri.getDate()} – ${ult.getDate()} de ${MESES[ult.getMonth()]}`
        : `${pri.getDate()} de ${MESES[pri.getMonth()]} – ${ult.getDate()} de ${MESES[ult.getMonth()]}`;
  } else if (vista === "mes") {
    titulo = `${capital(MESES[anchor.getMonth()])} de ${anchor.getFullYear()}`;
  } else {
    titulo = fechaTxt(anchor);
  }
  const porConfirmar = citasDia.filter((a) => a.status === "pending").length;
  const numCitas = citasDia.filter((a) => a.status !== "blocked").length;

  // Columnas de la rejilla: en Día, una por profesional; en 3 días y Semana,
  // una por día con todo el equipo o con la profesional elegida.
  const equipoFiltrado = filtroPro === "todas" ? equipo : equipo.filter((e) => e.id === filtroPro);
  const columnas: ColumnaRejilla[] =
    vista === "dia"
      ? equipo.map((e, i) => {
          const mias = citasDia.filter((a) => a.employeeId === e.id && a.status !== "blocked");
          return {
            clave: `${anchor.getTime()}-${e.id}`,
            dia: anchor,
            equipo: [e],
            cabecera: (
              <span className="flex items-center gap-2">
                {!soloUno && <AvatarPro e={e} i={i} size={30} />}
                <span className="min-w-0 leading-tight">
                  <b className="block truncate text-[14px]">{e.name}</b>
                  <small className="block text-[12px] font-semibold text-cafe-suave tabular-nums">
                    {mias.length} {mias.length === 1 ? "cita" : "citas"}
                  </small>
                </span>
              </span>
            ),
          };
        })
      : diasRejilla.map((d) => {
          const hoy = mismoDia(d, ahora);
          const cerrado = equipoFiltrado.every((e) => franjasProfesional(e, d.getDay()).length === 0);
          return {
            clave: `${d.getTime()}`,
            dia: d,
            equipo: equipoFiltrado,
            onCabecera: () => abrirDia(d),
            cabecera: (
              <span className="flex flex-col items-start leading-none" aria-label={`Abrir el ${DIAS[d.getDay()]} ${d.getDate()}`}>
                <span className={cn("text-[11px] font-bold tracking-[0.04em] uppercase", hoy ? "text-hoja-tinta" : "text-cafe-suave")}>{DCORTO[d.getDay()]}</span>
                <span
                  className={cn(
                    "mt-1 grid size-[34px] place-items-center rounded-full text-[19px] font-extrabold tabular-nums",
                    hoy && "bg-hoja text-white",
                  )}
                >
                  {d.getDate()}
                </span>
                {cerrado && <span className="mt-1 text-[11px] font-semibold">Cerrado</span>}
              </span>
            ),
          };
        });
  // Lote 15: la rejilla pinta el día entero; las horas elegidas son lo que se ve al abrir.
  const horasVisibles = { desde: pref.desde, hasta: pref.hasta };

  return (
    // Altura fija a la ventana para que las rejillas y el mes tengan scroll
    // interno. El cronograma, en pantallas bajas, deja crecer la página: así
    // cada profesional conserva sus 110 px y el pie no aplasta la rejilla.
    <div
      className={cn(
        "flex flex-col md:h-[calc(100dvh-71px-64px)] md:min-h-[620px]",
        vista === "cronograma" && "md:[@media(max-height:879px)]:h-auto",
        esRejilla && "h-[calc(100dvh-190px)] min-h-[520px]",
      )}
    >
      {/* Controles: navegar, qué periodo es, profesional, colores, vista y ajustes. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => { setAnchor(inicioDelDia(new Date())); setIrAAhora((n) => n + 1); }} className="mr-1 h-10 rounded-full border border-lino bg-card px-4 text-sm font-bold hover:bg-beige">
            Hoy
          </button>
          <button type="button" onClick={() => mover(-1)} aria-label="Anterior" className="grid size-10 place-items-center rounded-full text-cafe-medio hover:bg-beige">
            <ChevronLeft className="size-5" strokeWidth={1.6} />
          </button>
          <button type="button" onClick={() => mover(1)} aria-label="Siguiente" className="grid size-10 place-items-center rounded-full text-cafe-medio hover:bg-beige">
            <ChevronRight className="size-5" strokeWidth={1.6} />
          </button>
        </div>
        <div className="min-w-0 flex-1 md:flex-none">
          <h1 className="text-xl leading-tight font-extrabold tracking-[-0.02em] md:text-[24px]">{titulo}</h1>
          {(vista === "dia" || vista === "cronograma") && (
            <p className="text-[13.5px] text-muted-foreground tabular-nums">
              {numCitas} citas · {huecosDia.length} huecos libres
              {porConfirmar > 0 && <span className="text-primary"> · {porConfirmar} por confirmar</span>}
            </p>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto">
          {variosDias && !soloUno && (
            <label className="relative">
              <span className="sr-only">Profesional</span>
              <select
                value={filtroPro}
                onChange={(ev) => setFiltroPro(ev.target.value)}
                className="h-10 appearance-none rounded-full border border-lino bg-card pr-9 pl-4 text-[13px] font-bold text-cafe hover:bg-beige"
              >
                <option value="todas">Todas</option>
                {equipo.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-cafe-medio" strokeWidth={1.6} />
            </label>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-cafe-medio hover:bg-beige">
                <Palette className="size-[18px]" strokeWidth={1.6} />
                <span className="hidden sm:inline">Colores</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] rounded-2xl p-0">
              <Leyenda vista={vista} porPro={variosDias && filtroPro === "todas" && !soloUno} services={services} equipo={equipo} />
              <p className="px-4 py-3 text-[12.5px] text-muted-foreground">
                Pulsa una cita para ver su detalle, o un hueco vacío para dar una cita a esa hora.
              </p>
            </PopoverContent>
          </Popover>
          <div role="tablist" aria-label="Vista del calendario" className="order-last grid w-full grid-cols-5 gap-0.5 rounded-full bg-beige p-1 md:order-none md:inline-flex md:w-auto">
            {VISTAS_CALENDARIO.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={vista === v.id}
                onClick={() => setVista(v.id)}
                className={cn(
                  "h-[34px] rounded-full px-1 text-[12.5px] font-bold whitespace-nowrap text-cafe-medio md:px-[13px] md:text-[13px]",
                  vista === v.id && "bg-card text-foreground shadow-[0_1px_3px_rgba(59,47,42,0.14)]",
                )}
              >
                {v.id === "cronograma" ? (
                  <>
                    <span className="sm:hidden">Crono</span>
                    <span className="hidden sm:inline">{v.label}</span>
                  </>
                ) : (
                  v.label
                )}
              </button>
            ))}
            <Popover open={rangoAbierto} onOpenChange={setRangoAbierto}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="tab"
                  aria-selected={vista === "rango"}
                  className={cn(
                    "col-span-5 h-[34px] rounded-full px-1 text-[12.5px] font-bold whitespace-nowrap text-cafe-medio md:col-span-1 md:px-[13px] md:text-[13px]",
                    vista === "rango" && "bg-card text-foreground shadow-[0_1px_3px_rgba(59,47,42,0.14)]",
                  )}
                >
                  Elegir días
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(320px,calc(100vw-2rem))] rounded-2xl p-4">
                <FormRango
                  inicial={rango}
                  anchor={anchor}
                  onVer={(r) => {
                    setRango(r);
                    setVista("rango");
                    setRangoAbierto(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Ajustes del calendario" title="Ajustes del calendario" className="grid size-10 shrink-0 place-items-center rounded-full text-cafe-medio hover:bg-beige">
                <Settings2 className="size-[18px]" strokeWidth={1.6} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(320px,calc(100vw-2rem))] rounded-2xl p-4">
              <p className="mb-3 text-[14px] font-extrabold">Ajustes del calendario</p>
              <CamposPreferenciasCalendario />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Caja del calendario: la vista, con scroll interno. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-lino-fuerte bg-card">
        {vista === "cronograma" && (
          <Cronograma dia={anchor} citas={citasDia} equipo={equipo} ahora={ahora} carta={carta} services={services} irAAhora={irAAhora} onCita={setSeleccionada} onHueco={abrirHueco} />
        )}
        {esRejilla && (
          <RejillaCalendario
            columnas={columnas}
            appointments={appointments}
            todoElEquipo={equipo}
            desde={horasVisibles.desde}
            hasta={horasVisibles.hasta}
            irAAhora={irAAhora}
            ahora={ahora}
            carta={carta}
            services={services}
            colorPor={vista !== "dia" && filtroPro === "todas" && !soloUno ? "profesional" : "servicio"}
            anchoMinimo={vista === "dia" ? 150 : diasRejilla.length <= 3 ? 96 : diasRejilla.length > 7 ? 60 : 44}
            onCita={setSeleccionada}
            onHueco={abrirHueco}
          />
        )}
        {vista === "mes" && (
          <VistaMes anchor={anchor} appointments={appointments} equipo={equipo} ahora={ahora} primerDia={pref.primerDia} onDia={abrirDia} />
        )}
      </div>

      {vista === "cronograma" && numCitas > 0 && (
        <div className="flex-none">
          <button
            type="button"
            onClick={() => setVerPie((v) => !v)}
            aria-expanded={verPie}
            className="mt-3 inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13.5px] font-bold text-cafe-medio hover:bg-beige"
          >
            {verPie ? "Ocultar huecos libres y ocupación" : "Ver huecos libres y ocupación"}
            <ChevronDown className={cn("size-4 transition-transform", verPie && "rotate-180")} strokeWidth={1.6} />
          </button>
          {verPie && <PieCronograma dia={anchor} citas={citasDia} equipo={equipo} huecos={huecosDia} onHueco={abrirHueco} />}
        </div>
      )}

      <AppointmentDetailSheet appointment={seleccionada} open={!!seleccionada} onOpenChange={(o) => !o && setSeleccionada(null)} />
      <NewAppointmentDialog
        open={nuevaAbierta}
        onOpenChange={(o) => {
          setNuevaAbierta(o);
          if (!o) setPrefill(null);
        }}
        defaultDate={prefill?.date}
        defaultEmployeeId={prefill?.employeeId}
      />
    </div>
  );
}

/* ---------- Leyenda ---------- */

function Leyenda({ vista, porPro, services, equipo }: { vista: Vista; porPro: boolean; services: Service[]; equipo: Employee[] }) {
  const activos = services.filter((s) => s.active !== false).slice(0, 6);
  const muestra = "inline-block size-3.5 rounded-[4px] border border-cafe";
  if (vista === "mes") {
    return (
      <div className="flex flex-none flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-lino px-4 py-3 text-[12.5px] font-semibold text-k-tinta2">
        <b className="text-k-tinta">Barras = ocupación de cada profesional</b>
        {equipo.map((e, i) => (
          <span key={e.id} className="flex items-center gap-1.5">
            <i className="inline-block size-3.5 rounded-[4px]" style={{ background: barraPro(i) }} />
            {e.name}
          </span>
        ))}
        <span className="basis-full">El número de la derecha son sus citas · pulsa un día para abrirlo</span>
      </div>
    );
  }
  if (porPro) {
    return (
      <div className="flex flex-none flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-lino px-4 py-3 text-[12.5px] font-semibold text-k-tinta2">
        <b className="text-k-tinta">Profesional:</b>
        {equipo.map((e, i) => (
          <span key={e.id} className="flex items-center gap-1.5">
            <i className="inline-block size-3.5 rounded-[4px] border border-cafe" style={{ background: colorProfesional(i, e.id) }} />
            {e.name}
          </span>
        ))}
        <span className="basis-full">Elige una profesional arriba para ver sus citas por color de servicio.</span>
      </div>
    );
  }
  return (
    <div className="flex flex-none flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-lino px-4 py-3 text-[12.5px] font-semibold text-k-tinta2">
      <b className="text-k-tinta">Servicio:</b>
      {activos.map((s) => {
        const n = indiceColorServicio(s.id, services);
        return (
          <span key={s.id} className="flex items-center gap-1.5">
            <i className={muestra} style={{ background: `var(--serv-${n})` }} />
            {s.name.split(/ y | \/ /)[0]}
          </span>
        );
      })}
        <>
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-3.5 rounded-[4px] border border-dashed border-cafe bg-superficie" />
            Por confirmar
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-3.5 rounded-[4px] border border-k-linea" style={{ background: RAYADO }} />
            Comida
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-3.5 rounded-[4px] border-[1.5px] border-dashed border-k-libre-b bg-k-libre" />
            Libre
          </span>
        </>
    </div>
  );
}

const RAYADO = "repeating-linear-gradient(135deg,#EDE4D8 0 7px,#F5EFE6 7px 14px)";

/* ---------- Piezas: cita, pausa, hueco ---------- */

function BloqueCita({
  a,
  carta,
  services,
  style,
  variante,
  onClick,
}: {
  a: Appointment;
  carta: Record<string, Service>;
  services: Service[];
  style: CSSProperties;
  variante: "crono" | "dia" | "semana";
  onClick: () => void;
}) {
  const n = indiceColorServicio(a.serviceIds[0], services);
  const corta = a.duration < 60;
  const pendiente = a.status === "pending";
  const vino = a.status === "completed";
  const noVino = a.status === "no-show";
  const ini = minutosDe(a.start);
  const nombreServicio = serviceLabelOf(a, carta);
  const rango = `${hora(a.start)}${a.duration >= 60 ? `–${minutosAHora(ini + a.duration)}` : ""}`;
  const [nombre, ...resto] = (a.clientName || "Sin nombre").trim().split(/\s+/);
  const apellido = resto.join(" ");
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${a.clientName} · ${nombreServicio} · ${hora(a.start)}–${minutosAHora(ini + a.duration)}${pendiente ? " · por confirmar" : ""}`}
      className={cn(
        "absolute flex flex-col overflow-hidden text-left leading-[1.28] text-k-tinta hover:shadow-[0_2px_8px_rgba(31,38,51,0.12)] hover:brightness-[0.97] [&>*]:shrink-0",
        "rounded-md border border-cafe",
        variante === "semana" ? "px-1.5 py-[5px] text-[11.5px]" : "px-2.5 py-2 text-[13px]",
        variante !== "crono" && corta && "py-[3px]",
        variante === "crono" && corta && "px-[7px] py-[7px]",
        pendiente && "border-dashed",
        noVino && "opacity-55 line-through",
      )}
      style={{
        ...style,
        background: pendiente ? "var(--superficie)" : `var(--serv-${n})`,
      }}
    >
      {vino && variante !== "semana" && (
        <span className="absolute top-[7px] right-2 rounded-md bg-white/80 px-1.5 text-[10.5px] font-bold text-[color:var(--k-vino)]">✓ vino</span>
      )}
      {/* En bloques estrechos (citas cortas, o la semana) el nombre va en
          dos líneas —nombre y apellido— cortadas cada una, sin servicio: el
          color ya lo dice y el nombre entero sale al pasar el ratón. */}
      {corta || variante === "semana" ? (
        <b className={cn("font-extrabold", variante === "semana" || variante === "crono" ? "text-[11.5px] leading-[1.2]" : "text-[13px]", vino && variante !== "semana" && "pr-12")}>
          <span className="block truncate">{nombre}</span>
          {apellido && <span className="block truncate">{apellido}</span>}
        </b>
      ) : (
        <b className={cn("line-clamp-2 text-[13px] font-extrabold", vino && "pr-12")}>{a.clientName || "Sin nombre"}</b>
      )}
      <span className={cn("font-bold text-k-tinta2 tabular-nums", variante === "semana" ? "text-[10.5px]" : corta ? "text-[11px]" : "text-xs")}>{rango}</span>
    </button>
  );
}

function BloquePausa({ style, texto = "Comida" }: { style: CSSProperties; texto?: string }) {
  return (
    <div className="absolute grid place-items-center rounded-xl border border-k-linea text-[11px] font-semibold text-k-gris" style={{ ...style, background: RAYADO }}>
      {texto}
    </div>
  );
}

function BloqueHueco({ style, tramo, onClick }: { style: CSSProperties; tramo: Tramo; dosLineas?: boolean; onClick: () => void }) {
  const franja = `${minutosAHora(tramo.ini)}–${minutosAHora(tramo.fin)}`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Libre ${franja}: pulsa para dar una cita`}
      aria-label={`Hueco libre de ${franja}: crear una cita a las ${minutosAHora(tramo.ini)}`}
      className="group absolute grid place-items-center rounded-xl border border-dashed border-transparent text-center text-k-gris transition-colors hover:border-k-libre-b hover:bg-k-libre hover:text-k-libre-t"
      style={style}
    >
      <span className="flex flex-col items-center leading-tight">
        <span className="text-lg font-light opacity-60 group-hover:opacity-100">+</span>
        <span className="text-[11.5px] font-bold tabular-nums opacity-0 group-hover:opacity-100">{franja}</span>
      </span>
    </button>
  );
}

function AvatarPro({ e, i, size = 40 }: { e: Employee; i: number; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-extrabold text-cafe" style={{ width: size, height: size, fontSize: size >= 40 ? 13 : 11, background: colorPro(i) }}>
      {iniciales(e.name)}
    </span>
  );
}

function VacioDia({ dia }: { dia: Date }) {
  return (
    <div className="border-b border-k-linea p-6 text-center text-[12.5px] text-muted-foreground">
      <b className="block text-sm text-foreground">{capital(DIAS[dia.getDay()])}: el salón está cerrado</b>
      Puedes abrir un día suelto desde Equipo, en el horario de cada profesional.
    </div>
  );
}

/* ---------- Cronograma ---------- */

function Cronograma({
  dia,
  citas,
  equipo,
  ahora,
  carta,
  services,
  irAAhora = 0,
  onCita,
  onHueco,
}: {
  dia: Date;
  citas: Appointment[];
  equipo: Employee[];
  ahora: Date;
  carta: Record<string, Service>;
  services: Service[];
  irAAhora?: number;
  onCita: (a: Appointment) => void;
  onHueco: AbrirHueco;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const derecha = useRef<HTMLDivElement>(null);
  // Lote 15: el día entero a lo ancho (00:00-24:00); la jornada llena la
  // pantalla al abrir y lo de antes o después se ve con scroll horizontal.
  const jornada = horizonteDelDia(equipo, dia.getDay());
  const h = { ini: 0, fin: 24 * 60 };
  const esHoy = mismoDia(dia, ahora);
  const minAhora = minutosDe(ahora);
  const irA = (min: number, suave = false) => {
    const el = scroll.current;
    const der = derecha.current;
    if (!el || !der) return;
    el.scrollTo({ left: Math.max(0, (min / (24 * 60)) * der.offsetWidth), behavior: suave && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
  };
  // Al abrir: el principio de la jornada, o una hora antes de ahora si es hoy y cae dentro.
  useLayoutEffect(() => {
    if (!jornada) return;
    const dentro = esHoy && minAhora >= jornada.ini && minAhora < jornada.fin;
    irA(dentro ? minAhora - 60 : jornada.ini);
    // Solo al cambiar de día: no perseguir la línea de «ahora» cada minuto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia.getTime(), !!jornada]);
  useLayoutEffect(() => {
    if (irAAhora) irA(minAhora - 60, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [irAAhora]);

  if (!jornada) return <VacioDia dia={dia} />;
  const horas = 24;
  const horasJornada = Math.max(1, (jornada.fin - jornada.ini) / 60);
  const filas = `44px repeat(${equipo.length}, minmax(120px, 1fr))`;
  const pos = (ini: number, dur: number): CSSProperties => ({
    left: `calc(${porcentaje(ini, h)}% + 2px)`,
    width: `calc(${(dur / (h.fin - h.ini)) * 100}% - 4px)`,
    top: 10,
    bottom: 10,
  });
  const fondo: CSSProperties = {
    backgroundImage: "linear-gradient(90deg,var(--k-linea) 1px,transparent 1px)",
    backgroundSize: `calc(100% / ${horas}) 100%`,
  };
  const desde = esHoy ? minAhora : undefined;

  return (
    <div ref={scroll} className="relative min-h-0 flex-1 overflow-auto">
      <div
        className="grid h-full min-h-[376px] grid-cols-[92px_1fr] [--izq:92px] md:grid-cols-[168px_1fr] md:[--izq:168px]"
        // La jornada ocupa el ancho visible; las 24 h, 24/jornada veces eso (60 px por hora como mínimo).
        style={{ width: `max(calc(var(--izq) + (100% - var(--izq)) * ${24 / horasJornada}), calc(var(--izq) + ${24 * 60}px))` }}
      >
        <div className="sticky left-0 z-[8] grid border-r border-k-linea-f bg-card" style={{ gridTemplateRows: filas }}>
          <div className="flex items-center border-b border-k-linea-f bg-k-cab pl-4 text-[11px] font-bold tracking-[0.06em] text-k-tinta2 uppercase">Profesional</div>
          {equipo.map((e, i) => {
            const mias = citas.filter((a) => a.employeeId === e.id && a.status !== "blocked");
            return (
              <div key={e.id} className="flex items-center gap-1.5 border-b border-k-linea px-2 last:border-b-0 md:gap-3 md:px-4">
                <span className="hidden md:block"><AvatarPro e={e} i={i} /></span>
                <span className="md:hidden"><AvatarPro e={e} i={i} size={28} /></span>
                <div className="min-w-0">
                  <b className="block truncate text-xs md:text-[15px]">{e.name}</b>
                  <small className="block text-[11px] leading-tight text-muted-foreground tabular-nums">
                    {mias.length} citas · {ocupacionDe(citas, e, dia.getDay())} % ocupada
                  </small>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={derecha} className="relative grid min-w-0" style={{ gridTemplateRows: filas }}>
          <div className="relative border-b border-k-linea-f bg-k-cab">
            {Array.from({ length: horas }, (_, i) => (
              <span
                key={i}
                className="absolute top-[13px] text-xs font-bold text-k-tinta2 tabular-nums"
                // Etiqueta a la derecha de su línea: con scroll horizontal, la columna fija no la tapa a medias.
                style={{ left: `calc(${(i / horas) * 100}% + 6px)` }}
              >
                {i}:00
              </span>
            ))}
          </div>
          {equipo.map((e) => {
            const mias = citas.filter((a) => a.employeeId === e.id);
            const carriles = carrilesSolapados(mias);
            const posCita = (a: Appointment): CSSProperties => {
              const { carril, total } = carriles.get(a.id) ?? { carril: 0, total: 1 };
              const base = pos(minutosDe(a.start), a.duration);
              if (total === 1) return base;
              return { ...base, top: `calc(10px + (100% - 20px) * ${carril / total})`, bottom: "auto", height: `calc((100% - 20px) / ${total} - 2px)` };
            };
            return (
              <div key={e.id} className="relative border-b border-k-linea last:border-b-0" style={fondo}>
                {pausasDe(e, dia.getDay()).map((p) => (
                  <BloquePausa key={`p${p.ini}`} style={pos(p.ini, p.fin - p.ini)} />
                ))}
                {huecosDe(citas, e, dia.getDay(), { desde }).map((t) => (
                  <BloqueHueco key={`h${t.ini}`} tramo={t} dosLineas style={pos(t.ini, t.fin - t.ini)} onClick={() => onHueco(e.id, t.ini, dia)} />
                ))}
                {mias.map((a) =>
                  a.status === "blocked" ? (
                    <BloquePausa key={a.id} texto={a.note || "Bloqueado"} style={posCita(a)} />
                  ) : (
                    <BloqueCita key={a.id} a={a} carta={carta} services={services} variante="crono" style={posCita(a)} onClick={() => onCita(a)} />
                  ),
                )}
              </div>
            );
          })}
          {/* Fuera de la jornada: rayado tenue, como en la rejilla. */}
          {[{ ini: 0, fin: jornada.ini }, { ini: jornada.fin, fin: 24 * 60 }].filter((t) => t.fin > t.ini).map((t) => (
            <div
              key={`f${t.ini}`}
              aria-hidden="true"
              className="pointer-events-none absolute top-[46px] bottom-0 z-[1] bg-[repeating-linear-gradient(135deg,var(--k-cerrado)_0_6px,transparent_6px_12px)] opacity-55"
              style={{ left: `${porcentaje(t.ini, h)}%`, width: `${((t.fin - t.ini) / (24 * 60)) * 100}%` }}
            />
          ))}
          {esHoy && minAhora >= h.ini && minAhora <= h.fin && (
            <div className="pointer-events-none absolute top-0 bottom-0 z-[5] w-0.5 bg-k-ahora" style={{ left: `${porcentaje(minAhora, h)}%` }} aria-hidden="true">
              <i className="absolute top-[11px] -left-[22px] rounded-full bg-k-ahora px-1.5 text-[10px] font-extrabold text-white not-italic tabular-nums">{hora(ahora)}</i>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Día y semana: rejilla vertical ---------- */

/* ---------- Mes ---------- */

function VistaMes({ anchor, appointments, equipo, ahora, primerDia, onDia }: { anchor: Date; appointments: Appointment[]; equipo: Employee[]; ahora: Date; primerDia: PrimerDia; onDia: (d: Date) => void }) {
  // Celdas desde el primer día de semana elegido: cinco o seis filas, sin
  // una última que sea entera del mes siguiente.
  const celdas = useMemo(() => {
    const inicio = inicioDeSemana(new Date(anchor.getFullYear(), anchor.getMonth(), 1), primerDia);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      if (i >= 35 && d.getMonth() !== anchor.getMonth()) break;
      out.push(d);
    }
    return out;
  }, [anchor, primerDia]);
  const cabeceras = Array.from({ length: 7 }, (_, i) => DCORTO[(primerDia + i) % 7]);
  const filas = celdas.length / 7;
  return (
    <div className="relative min-h-0 flex-1 overflow-auto">
      <div className="grid h-full min-w-[700px] grid-cols-7" style={{ gridTemplateRows: `auto repeat(${filas}, minmax(88px, 1fr))` }}>
        {cabeceras.map((d) => (
          <div key={d} className="border-b border-k-linea-f bg-k-cab p-2.5 text-[11px] font-bold tracking-[0.06em] text-k-tinta2 uppercase">
            {d}
          </div>
        ))}
        {celdas.map((d) => {
          const citas = citasDeCalendario(appointments, d).filter((a) => a.status !== "blocked");
          const fuera = d.getMonth() !== anchor.getMonth();
          const hoy = mismoDia(d, ahora);
          const abre = equipo.some((e) => franjasProfesional(e, d.getDay()).length > 0);
          return (
            <button
              key={d.getTime()}
              type="button"
              onClick={() => onDia(d)}
              aria-label={`${d.getDate()} de ${MESES[d.getMonth()]}, ${citas.length} citas`}
              className={cn(
                "flex flex-col gap-1.5 border-r border-b border-k-linea p-2 text-left text-k-tinta [&:nth-child(7n)]:border-r-0",
                fuera ? "bg-beige/60 text-cafe-suave" : "hover:bg-k-cab",
                hoy && "bg-salvia-suave/50",
              )}
            >
              <span className="flex items-center justify-between">
                <span className={cn("grid size-[26px] place-items-center rounded-full text-[13px] font-extrabold tabular-nums", hoy && "bg-hoja text-white")}>{d.getDate()}</span>
                {citas.length > 0 && (
                  <span className="text-xs font-extrabold text-k-tinta tabular-nums">
                    {citas.length} {citas.length === 1 ? "cita" : "citas"}
                  </span>
                )}
              </span>
              {citas.length > 0 ? (
                <span className="mt-auto flex flex-col gap-[3px]">
                  {equipo.map((e, i) => {
                    const mias = citas.filter((a) => a.employeeId === e.id);
                    const pct = ocupacionDe(citas, e, d.getDay());
                    return (
                      <span key={e.id} className="flex items-center gap-1.5 text-[11px] font-bold text-k-tinta2" title={`${e.name}: ${mias.length} citas · ${pct} %`}>
                        <b className="w-3">{e.name[0]}</b>
                        <i className="block h-[7px] flex-1 overflow-hidden rounded-full bg-beige">
                          <u className="block h-full rounded-full" style={{ width: `${pct}%`, background: barraPro(i) }} />
                        </i>
                        <span className="tabular-nums">{mias.length}</span>
                      </span>
                    );
                  })}
                </span>
              ) : (
                <span className="mt-auto text-xs text-muted-foreground">{abre ? "" : "Cerrado"}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Pie del cronograma: huecos y ocupación ---------- */

function PieCronograma({
  dia,
  citas,
  equipo,
  huecos,
  onHueco,
}: {
  dia: Date;
  citas: Appointment[];
  equipo: Employee[];
  huecos: (Tramo & { e: Employee })[];
  onHueco: AbrirHueco;
}) {
  const ordenados = [...huecos].sort((a, b) => a.ini - b.ini);
  const tarjeta = "rounded-[20px] border border-k-linea-f bg-card";
  return (
    <div className="mt-4 grid flex-none grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr] xl:group-data-[panel=abierto]/panel:grid-cols-1">
      <Tarjeta className={tarjeta} titulo="Huecos libres" sub="Pulsa uno para dar la cita" extra={<span className="ml-auto inline-flex h-6 items-center rounded-full bg-salvia-clara px-2.5 text-[12.5px] font-bold text-hoja-tinta tabular-nums">{ordenados.length}</span>}>
        {ordenados.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">No queda ningún hueco de media hora o más.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ordenados.map((t) => (
              <button
                key={`${t.e.id}-${t.ini}`}
                type="button"
                onClick={() => onHueco(t.e.id, t.ini, dia)}
                className="h-9 rounded-full border-[1.5px] border-dashed border-k-libre-b bg-card px-3 text-[12.5px] font-bold text-k-libre-t tabular-nums hover:bg-k-libre"
              >
                {minutosAHora(t.ini)}–{minutosAHora(t.fin)} · {t.e.name}
              </button>
            ))}
          </div>
        )}
      </Tarjeta>
      <Tarjeta className={tarjeta} titulo="Ocupación" sub="Minutos reservados sobre la jornada">
        {equipo.map((e, i) => {
          const pct = ocupacionDe(citas, e, dia.getDay());
          return (
            <div key={e.id} className="flex items-center gap-2.5 py-2">
              <AvatarPro e={e} i={i} size={28} />
              <b className="w-16 truncate">{e.name}</b>
              <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-nata">
                <i className="block" style={{ width: `${pct}%`, background: barraPro(i) }} />
              </span>
              <span className="w-10 text-right font-bold tabular-nums">{pct} %</span>
            </div>
          );
        })}
      </Tarjeta>
    </div>
  );
}

function Tarjeta({ className, titulo, sub, extra, children }: { className: string; titulo: string; sub: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className={className}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 px-5 py-4">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">{titulo}</h2>
        <span className="text-[12.5px] text-muted-foreground">{sub}</span>
        {extra}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

/* ---------- Elegir días ---------- */

function FormRango({ inicial, anchor, onVer }: { inicial: { inicio: Date; n: number } | null; anchor: Date; onVer: (r: { inicio: Date; n: number }) => void }) {
  const ini = inicial?.inicio ?? anchor;
  const fin = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + (inicial?.n ?? 5) - 1);
  const [desde, setDesde] = useState(fechaISO(ini));
  const [hasta, setHasta] = useState(fechaISO(fin));
  const [error, setError] = useState<string | null>(null);
  const campo = "h-10 w-full rounded-xl border border-input bg-blanco px-3 text-[14px] text-cafe";
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const r = rangoDeDias(desde, hasta);
        if ("error" in r) return setError(r.error);
        onVer(r);
      }}
    >
      <p className="text-[14px] font-extrabold">Elegir días</p>
      <label className="grid gap-1.5 text-[13px] font-bold">
        Desde
        <input type="date" className={campo} value={desde} onChange={(e) => { setDesde(e.target.value); setError(null); }} />
      </label>
      <label className="grid gap-1.5 text-[13px] font-bold">
        Hasta
        <input type="date" className={campo} value={hasta} onChange={(e) => { setHasta(e.target.value); setError(null); }} />
      </label>
      <p className="text-[12.5px] text-cafe-suave">Hasta {MAX_DIAS_ELEGIDOS} días. Las flechas saltan a los siguientes días del mismo tamaño.</p>
      {error && <p role="alert" className="text-[12.5px] text-melocoton-tinta">{error}</p>}
      <button type="submit" className="h-10 rounded-full bg-primary text-[14px] font-bold text-primary-foreground">
        Ver estos días
      </button>
    </form>
  );
}
