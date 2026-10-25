import { bordeProfesional, tinteProfesional } from "@/lib/colores-elegidos";
import { MiCalendarioExterno } from "@/components/MiCalendarioExterno";
import { tituloCalendario } from "@/lib/calendario-titulo-panel";
import { useFichas } from "@/lib/use-fichas";
import { useCitasVisibles, useEquipoVisible } from "@/lib/accesos-panel";
import { useOcupadoExterno, useSincronizarCalendarios } from "@/lib/calendarios-panel";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Palette, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { serviceLabelOf } from "@/lib/appointment-services";
import { franjasProfesionalEnFecha } from "@/lib/horario-equipo";
import { bloqueosComoCitas } from "@/lib/bloqueos-agenda";
import { zonaDelSalon } from "@/lib/zona-horaria";
import { guardarPerfil } from "@/lib/deshacer-maqueta";
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
import { BloquearTiempoDialog } from "@/components/BloquearTiempoDialog";
import {
  IconoEstado,
  RejillaCalendario,
  colorProfesional,
  type ColumnaRejilla,
} from "@/components/RejillaCalendario";
import { CamposPreferenciasCalendario } from "@/components/CamposPreferenciasCalendario";
import {
  MAX_DIAS_ELEGIDOS,
  diasDesde,
  rangoDeDias,
  VISTAS_CALENDARIO,
  diasDeRejilla,
  inicioDeSemana,
  pasoDeVista,
  preferenciasDe,
  vistaInicialCalendario,
  vistaElegidaGuardada,
  recordarVistaElegida,
  type PrimerDia,
  type VistaCalendario,
} from "@/lib/preferencias-calendario";

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
      const g = JSON.parse(window.sessionStorage.getItem(CLAVE_RANGO) ?? "null") as {
        inicio: string;
        n: number;
      } | null;
      if (!g) return null;
      const r = rangoDeDias(g.inicio, g.inicio);
      return "error" in r || !(g.n >= 1 && g.n <= MAX_DIAS_ELEGIDOS)
        ? null
        : { inicio: r.inicio, n: g.n };
    } catch {
      return null;
    }
  });
  const guardar = (r: { inicio: Date; n: number } | null) => {
    setRango(r);
    try {
      if (r)
        window.sessionStorage.setItem(
          CLAVE_RANGO,
          JSON.stringify({ inicio: fechaISO(r.inicio), n: r.n }),
        );
      else window.sessionStorage.removeItem(CLAVE_RANGO);
    } catch {
      /* sin almacenamiento: dura hasta recargar */
    }
  };
  return [rango, guardar] as const;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DCORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** Color de la barra de ocupación de la profesional, por orden del equipo. */
const barraPro = (i: number) => bordeProfesional(i);

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
export function CalendarioArena({
  inicio,
}: { inicio?: { dia?: string; cita?: string; nueva?: boolean } } = {}) {
  const visibles = useCitasVisibles();
  const services = useSalonStore((s) => s.services);
  const profile = useSalonStore((s) => s.salonProfile);
  const guardadas = useSalonStore((s) => s.salonProfile.calendario);
  const equipo = useEquipoVisible();
  const zona = zonaDelSalon(profile);
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
  const desdeExt = fechaISO(
    new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 7),
  );
  const hastaExt = fechaISO(
    new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 42),
  );
  const externos = useOcupadoExterno(
    desdeExt,
    hastaExt,
    equipo.map((e) => e.id),
  );
  const bloqueos = useMemo(
    () => bloqueosComoCitas(profile.bloqueosAgenda, desdeExt, hastaExt, zona, equipo),
    [profile.bloqueosAgenda, desdeExt, hastaExt, zona, equipo],
  );
  const appointments = useMemo(
    () => [...visibles, ...externos, ...bloqueos],
    [visibles, externos, bloqueos],
  );
  const [vista, setVista] = useState<Vista>(() =>
    inicio?.dia || citaInicial
      ? "dia"
      : ((typeof window !== "undefined" ? vistaElegidaGuardada() : null) ??
        vistaInicialCalendario(
          pref.vista,
          typeof window !== "undefined" && window.innerWidth < 640,
        )),
  );
  const elegirVista = (siguiente: VistaCalendario) => {
    setVista(siguiente);
    recordarVistaElegida(siguiente);
  };
  /** En Semana y 3 días: «todas» o el id de una profesional. */
  const [filtroPro, setFiltroPro] = useState<string>("todas");
  const [rango, setRango] = useRangoDeSesion();
  const [rangoAbierto, setRangoAbierto] = useState(false);
  // Las citas de verdad se abren en la ficha global (?cita=); aquí solo quedan
  // los bloqueos y lo que viene de calendarios externos, que no tienen ficha.
  const { abrirCita, ficha } = useFichas();
  const [seleccionada, setSeleccionada] = useState<Appointment | null>(null);
  const elegirCita = (a: Appointment) => {
    if (visibles.some((v) => v.id === a.id)) {
      setSeleccionada(null);
      abrirCita(a.id);
    } else setSeleccionada(a);
  };
  const resaltadaId = ficha?.tipo === "cita" ? ficha.id : seleccionada?.id;
  const [prefill, setPrefill] = useState<{ date: Date; employeeId: EmployeeId } | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(!!inicio?.nueva);
  const [bloqueoAbierto, setBloqueoAbierto] = useState(false);
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

  // Estable entre renders: las columnas memoizadas de la rejilla no se repintan por él.
  const abrirHueco: AbrirHueco = useCallback((employeeId, minuto, dia) => {
    const date = new Date(dia);
    date.setHours(Math.floor(minuto / 60), minuto % 60, 0, 0);
    setPrefill({ date, employeeId });
    setNuevaAbierta(true);
  }, []);

  function mover(n: number) {
    const d = new Date(anchor);
    if (vista === "rango" && rango) {
      setRango({
        inicio: new Date(
          rango.inicio.getFullYear(),
          rango.inicio.getMonth(),
          rango.inicio.getDate() + n * rango.n,
        ),
        n: rango.n,
      });
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

  const esRejilla =
    vista === "dia" || vista === "tres" || vista === "semana" || (vista === "rango" && !!rango);
  const diasRejilla =
    vista === "rango" && rango
      ? diasDesde(rango.inicio, rango.n)
      : esRejilla && vista !== "rango"
        ? diasDeRejilla(anchor, vista, pref.primerDia)
        : [];
  const variosDias = vista === "semana" || vista === "tres" || vista === "rango";
  // Lote 16: siempre con el año, en todas las vistas.
  const titulo = tituloCalendario(vista === "mes" ? "mes" : variosDias ? "varios" : "dia", diasRejilla, anchor);
  const numCitas = citasDia.filter((a) => a.status !== "blocked").length;

  // Columnas de la rejilla: en Día, una por profesional; en 3 días y Semana,
  // una por día con todo el equipo o con la profesional elegida.
  const equipoFiltrado = filtroPro === "todas" ? equipo : equipo.filter((e) => e.id === filtroPro);
  // En móvil Semana es un resumen que ya se desplaza horizontalmente. Cada
  // carril de citas conserva 24 px de área táctil, aun cuando haya solapes.
  const anchoMinimoSemanaMovil = useMemo(() => {
    if (vista !== "semana") return 44;
    const ids = new Set(equipoFiltrado.map((e) => e.id));
    const maxCarriles = Math.max(
      1,
      ...diasRejilla.map((dia) =>
        Math.max(
          1,
          ...[
            ...carrilesSolapados(
              citasDeCalendario(appointments, dia).filter((cita) => ids.has(cita.employeeId)),
            ).values(),
          ].map(({ total }) => total),
        ),
      ),
    );
    // Los 4 px que separan los carriles se suman a sus 24 px tocables.
    return Math.max(44, maxCarriles * 28);
  }, [appointments, diasRejilla, equipoFiltrado, vista]);
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
          const cerrado = equipoFiltrado.every(
            (e) => franjasProfesionalEnFecha(e, fechaISO(d), profile.diasEspeciales).length === 0,
          );
          const especial = profile.diasEspeciales?.some((x) => x.fecha === fechaISO(d));
          return {
            clave: `${d.getTime()}`,
            dia: d,
            equipo: equipoFiltrado,
            onCabecera: () => abrirDia(d),
              cabecera: (
              <span className={cn("flex min-h-[30px] w-full items-center justify-center gap-1 text-[12px] font-medium leading-none", hoy && "min-h-[30px] bg-[#303030] text-white")} aria-label={`Abrir el ${DIAS[d.getDay()]} ${d.getDate()}`}>
                <span className={hoy ? "text-white" : "text-[#555550]"}>{d.getDate()}</span>
                <span className={hoy ? "text-white/80" : "text-[#555550]"}>·</span>
                <span className={hoy ? "text-white" : "text-[#555550]"}>{DCORTO[d.getDay()]}</span>
                {cerrado && <span className="sr-only" role="img" aria-label="Cerrado">—</span>}
                {especial && <span className="sr-only">Especial</span>}
              </span>
            ),
          };
        });
  // Lote 15: la rejilla pinta el día entero; las horas elegidas son lo que se ve al abrir.
  const horasVisibles = { desde: pref.desde, hasta: pref.hasta };

  // «Nueva cita» cerrada no se vuelve a pintar en cada cambio de semana o minuto.
  const dialogoNueva = useMemo(
    () => (
      <NewAppointmentDialog
        open={nuevaAbierta}
        onOpenChange={(o) => {
          setNuevaAbierta(o);
          if (!o) setPrefill(null);
        }}
        defaultDate={prefill?.date}
        defaultEmployeeId={prefill?.employeeId}
      />
    ),
    [nuevaAbierta, prefill],
  );

  return (
    // Altura fija a la ventana para que las rejillas y el mes tengan scroll
    // interno. El cronograma, en pantallas bajas, deja crecer la página: así
    // cada profesional conserva sus 110 px y el pie no aplasta la rejilla.
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col bg-transparent",
        vista === "cronograma" && "md:[@media(max-height:879px)]:h-auto",
      )}
    >
      {/* Controles: navegar, qué periodo es, profesional, colores, vista y ajustes. */}
      {/* Lote 16: la fila de controles ya no se parte en dos según lo largo que
          sea el título (eso subía o bajaba la rejilla al cambiar de semana):
          en PC, título a la izquierda con el ancho que quede y controles fijos
          a la derecha; en móvil, navegación, título y vistas en filas fijas. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#ECEBE6] bg-transparent gutter-x py-2 lg:flex-nowrap" data-pagina="">
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => { setAnchor(inicioDelDia(new Date())); setIrAAhora((n) => n + 1); }} className="mr-1 h-10 rounded-full bg-cafe px-4 text-sm font-bold text-white hover:bg-cafe/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Hoy
          </button>
          <button type="button" onClick={() => mover(-1)} aria-label="Anterior" className="grid size-11 place-items-center rounded-full bg-[#F3F2EE] text-[#5A5A56] hover:bg-[#ECEBE6] md:size-10">
            <ChevronLeft className="size-5" strokeWidth={1.6} />
          </button>
          <button type="button" onClick={() => mover(1)} aria-label="Siguiente" className="grid size-11 place-items-center rounded-full bg-[#F3F2EE] text-[#5A5A56] hover:bg-[#ECEBE6] md:size-10">
            <ChevronRight className="size-5" strokeWidth={1.6} />
          </button>
          <button type="button" onClick={() => setBloqueoAbierto(true)} className="ml-1 h-11 rounded-full bg-[#F3F2EE] px-3 text-[13px] font-bold text-[#5A5A56] hover:bg-[#ECEBE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10">
            Bloquear tiempo
          </button>
        </div>
        <div className="order-last w-full min-w-0 lg:order-2 lg:w-auto lg:flex-1">
          <h1 className="titulo-calendario text-[27px] leading-[1.1] font-normal tracking-[-0.04em] text-[#303030] sm:truncate sm:text-[28px] sm:leading-tight md:text-[36px]" title={titulo}>{titulo}</h1>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 lg:order-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Colores del calendario"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-cafe-medio hover:bg-beige"
              >
                <Palette className="size-[18px]" strokeWidth={1.6} />
                <span className="hidden sm:inline">Colores</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(390px,calc(100vw-2rem))] rounded-2xl p-4">
              <h2 className="text-[15px] font-extrabold">Cómo leer el calendario</h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {vista === "mes"
                  ? "Las barras muestran cuánto trabaja cada profesional."
                  : variosDias && filtroPro === "todas" && !soloUno
                    ? "El color de cada cita identifica a la profesional."
                    : "El color de cada cita identifica el servicio."}
              </p>
              <Leyenda vista={vista} porPro={variosDias && filtroPro === "todas" && !soloUno} services={services} equipo={equipo} />
              {vista !== "mes" && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">Estados y espacios</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-perla p-2.5">
                      <span className="mb-1.5 block h-5 rounded-md border border-dashed border-cafe-medio bg-card" aria-hidden="true" />
                      <b className="block text-[11.5px]">Por confirmar</b>
                      <span className="text-[11px] text-muted-foreground">Falta confirmarla</span>
                    </div>
                    <div className="rounded-xl bg-perla p-2.5">
                      <span className="mb-1.5 block h-5 rounded-md border border-lino" style={{ background: RAYADO }} aria-hidden="true" />
                      <b className="block text-[11.5px]">Pausa</b>
                      <span className="text-[11px] text-muted-foreground">No se puede reservar</span>
                    </div>
                    <div className="rounded-xl bg-perla p-2.5">
                      <span className="mb-1.5 block h-5 rounded-md border border-dashed border-k-libre-b bg-k-libre" aria-hidden="true" />
                      <b className="block text-[11.5px]">Hueco libre</b>
                      <span className="text-[11px] text-muted-foreground">Pulsa para reservar</span>
                    </div>
                  </div>
                  <p className="mt-3 text-[12px] text-muted-foreground">Pulsa una cita para ver sus detalles.</p>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Ajustes del calendario"
                title="Ajustes del calendario"
                className="grid size-10 shrink-0 place-items-center rounded-full text-cafe-medio hover:bg-beige"
              >
                <Settings2 className="size-[18px]" strokeWidth={1.6} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(320px,calc(100vw-2rem))] rounded-2xl p-4">
              <p className="mb-3 text-[14px] font-extrabold">Ajustes del calendario</p>
              <CamposPreferenciasCalendario />
              <div className="mt-4 border-t border-border/60 pt-4">
                <MiCalendarioExterno />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {/* Segunda fila fija: profesional y vista. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#ECEBE6] bg-transparent gutter-x pb-3">
          {variosDias && !soloUno && (
            <label className="relative">
              <span className="sr-only">Profesional</span>
              <select
                aria-label="Filtrar agenda por profesional"
                value={filtroPro}
                onChange={(ev) => setFiltroPro(ev.target.value)}
                className="h-11 appearance-none rounded-full bg-[#F3F2EE] px-4 pr-9 text-[13px] font-semibold text-[#5A5A56] hover:bg-[#ECEBE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
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
          <div role="tablist" aria-label="Vista del calendario" className="order-last grid w-full grid-cols-5 gap-0.5 rounded-full bg-transparent p-1 md:order-none md:ml-auto md:inline-flex md:w-auto">
            {VISTAS_CALENDARIO.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={vista === v.id}
                aria-label={v.label}
                onClick={() => elegirVista(v.id)}
                className={cn(
                  "h-11 rounded-full bg-[#F3F2EE] px-1 text-[12.5px] font-semibold whitespace-nowrap text-[#5A5A56] transition-colors hover:bg-[#ECEBE6] md:h-10 md:px-[13px] md:text-[13px]",
                  vista === v.id && "bg-cafe text-white shadow-sm hover:bg-cafe",
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
                    "col-span-5 h-11 rounded-full bg-[#F3F2EE] px-1 text-[12.5px] font-semibold whitespace-nowrap text-[#5A5A56] hover:bg-[#ECEBE6] md:col-span-1 md:h-10 md:px-[13px] md:text-[13px]",
                    vista === "rango" && "bg-cafe text-white shadow-sm hover:bg-cafe",
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
      </div>

      {/* Caja del calendario: la vista, con scroll interno. */}
      <div data-vista={vista} className="caja-calendario flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        {vista === "cronograma" && (
          <Cronograma
            dia={anchor}
            citas={citasDia}
            equipo={equipo}
            ahora={ahora}
            carta={carta}
            services={services}
            irAAhora={irAAhora}
            seleccionadaId={resaltadaId}
            onCita={elegirCita}
            onHueco={abrirHueco}
          />
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
            colorPor={
              vista !== "dia" && filtroPro === "todas" && !soloUno ? "profesional" : "servicio"
            }
            seleccionadaId={resaltadaId}
            anchoMinimo={
              vista === "dia"
                ? 150
                : diasRejilla.length <= 3
                  ? 96
                  : diasRejilla.length > 7
                    ? 60
                    : 44
            }
            anchoMinimoMovil={anchoMinimoSemanaMovil}
            onCita={elegirCita}
            onHueco={abrirHueco}
            diasEspeciales={profile.diasEspeciales}
          />
        )}
        {vista === "mes" && (
          <VistaMes
            anchor={anchor}
            appointments={appointments}
            equipo={equipo}
            ahora={ahora}
            primerDia={pref.primerDia}
            onDia={abrirDia}
            diasEspeciales={profile.diasEspeciales}
          />
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
            <ChevronDown
              className={cn("size-4 transition-transform", verPie && "rotate-180")}
              strokeWidth={1.6}
            />
          </button>
          {verPie && (
            <PieCronograma
              dia={anchor}
              citas={citasDia}
              equipo={equipo}
              huecos={huecosDia}
              onHueco={abrirHueco}
            />
          )}
        </div>
      )}

      {seleccionada?.id.startsWith("bloqueo:") ? (
        <div className="fixed right-4 bottom-4 z-20 rounded-2xl border border-lino bg-card p-4 shadow-lg">
          <p className="text-sm font-bold">{seleccionada.note || "Tiempo bloqueado"}</p>
          <button
            type="button"
            className="mt-2 text-sm font-bold text-melocoton-tinta underline"
            onClick={() => {
              const id = seleccionada.id.split(":")[1];
              guardarPerfil({
                bloqueosAgenda: (profile.bloqueosAgenda ?? []).filter((b) => b.id !== id),
              });
              setSeleccionada(null);
            }}
          >
            Eliminar bloqueo
          </button>
        </div>
      ) : seleccionada ? (
        <AppointmentDetailSheet
          appointment={seleccionada}
          open
          onOpenChange={(o) => !o && setSeleccionada(null)}
        />
      ) : null}
      {dialogoNueva}
      <BloquearTiempoDialog
        open={bloqueoAbierto}
        onOpenChange={setBloqueoAbierto}
        date={anchor}
        equipo={equipo}
      />
    </div>
  );
}

/* ---------- Leyenda ---------- */

function Leyenda({
  vista,
  porPro,
  services,
  equipo,
}: {
  vista: Vista;
  porPro: boolean;
  services: Service[];
  equipo: Employee[];
}) {
  const activos = services.filter((s) => s.active !== false).slice(0, 6);
  if (vista === "mes") {
    return (
      <div className="mt-3 grid gap-1.5">
        {equipo.map((e, i) => (
          <div key={e.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[12.5px]">
            <i className="h-2.5 w-8 rounded-full" style={{ background: barraPro(i) }} aria-hidden="true" />
            <span>{e.name}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">barra = horas ocupadas</span>
          </div>
        ))}
      </div>
    );
  }
  if (porPro) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {equipo.map((e, i) => (
          <span key={e.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px]">
            <i className="size-4 shrink-0 rounded-[4px] border border-cafe/20" style={{ background: colorProfesional(i, e.id) }} aria-hidden="true" />
            {e.name}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5">
      {activos.map((s) => {
        const n = indiceColorServicio(s.id, services);
        return (
          <span key={s.id} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-[12px]">
            <i className="size-4 shrink-0 rounded-[4px] border border-cafe/20" style={{ background: `var(--serv-${n})` }} aria-hidden="true" />
            <span className="truncate">{s.name}</span>
          </span>
        );
      })}
    </div>
  );
}

const RAYADO = "repeating-linear-gradient(135deg,#ECEBE6 0 7px,#F5F4F0 7px 14px)";

/* ---------- Piezas: cita, pausa, hueco ---------- */

function BloqueCita({
  a,
  carta,
  services,
  style,
  variante,
  seleccionada = false,
  onClick,
}: {
  a: Appointment;
  carta: Record<string, Service>;
  services: Service[];
  style: CSSProperties;
  variante: "crono" | "dia" | "semana";
  seleccionada?: boolean;
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
        "absolute flex flex-col overflow-hidden text-left leading-[1.2] [&>*]:shrink-0",
        "rounded-[5px] border border-transparent transition-colors duration-150",
        variante === "semana" ? "px-[5px] py-1 text-[11.5px]" : "px-[5px] py-1 text-[12px]",
        variante !== "crono" && corta && "py-[3px]",
        variante === "crono" && corta && "px-[5px] py-1",
        pendiente && "border-dashed",
        noVino && "line-through decoration-cafe/60",
        seleccionada && "z-[6] ring-2 ring-primary ring-offset-1 ring-offset-card",
      )}
      style={{
        ...style,
        background: pendiente ? "var(--superficie)" : `var(--serv-${n})`,
        color: `var(--serv-${n}-tinta)`,
        borderLeft: pendiente ? "1px dashed #8A8A85" : "0",
      }}
    >
      <IconoEstado status={a.status} className="top-1.5 right-1.5" />
      {/* En bloques estrechos (citas cortas, o la semana) el nombre va en
          dos líneas —nombre y apellido— cortadas cada una, sin servicio: el
          color ya lo dice y el nombre entero sale al pasar el ratón. */}
      {corta || variante === "semana" ? (
        <b className={cn("font-semibold", variante === "semana" || variante === "crono" ? "text-[11.5px] leading-[1.2]" : "text-[12px]", (vino || pendiente) && "pr-4")}>
          <span className="block truncate">{nombre}</span>
          {apellido && <span className="block truncate">{apellido}</span>}
        </b>
      ) : (
        <b className={cn("line-clamp-2 text-[12px] font-semibold", (vino || pendiente) && "pr-4")}>{a.clientName || "Sin nombre"}</b>
      )}
      <span className={cn("font-normal tabular-nums", variante === "semana" ? "text-[10.5px]" : corta ? "text-[11px]" : "text-[11px]")}>{rango}</span>
    </button>
  );
}

function BloquePausa({ style, texto = "Comida" }: { style: CSSProperties; texto?: string }) {
  return (
    <div
      className="absolute grid place-items-center rounded-xl border border-k-linea text-[11px] font-semibold text-k-gris"
      style={{ ...style, background: RAYADO }}
    >
      {texto}
    </div>
  );
}

function BloqueHueco({
  style,
  tramo,
  onClick,
}: {
  style: CSSProperties;
  tramo: Tramo;
  dosLineas?: boolean;
  onClick: () => void;
}) {
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
        <span className="text-[11.5px] font-bold tabular-nums opacity-0 group-hover:opacity-100">
          {franja}
        </span>
      </span>
    </button>
  );
}

function VacioDia({ dia }: { dia: Date }) {
  return (
    <div className="border-b border-k-linea p-6 text-center text-[12.5px] text-muted-foreground">
      <b className="block text-sm text-foreground">
        {capital(DIAS[dia.getDay()])}: el salón está cerrado
      </b>
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
  seleccionadaId,
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
  seleccionadaId?: string;
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
    el.scrollTo({
      left: Math.max(0, (min / (24 * 60)) * der.offsetWidth),
      behavior:
        suave && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "auto",
    });
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
        style={{
          width: `max(calc(var(--izq) + (100% - var(--izq)) * ${24 / horasJornada}), calc(var(--izq) + ${24 * 60}px))`,
        }}
      >
        <div className="sticky left-0 z-[8] grid border-r border-k-linea-f bg-transparent" style={{ gridTemplateRows: filas }}>
          <div aria-hidden="true" />
          {equipo.map((e, i) => {
            const mias = citas.filter((a) => a.employeeId === e.id && a.status !== "blocked");
            return (
              <div key={e.id} className="relative m-1 flex items-center gap-1.5 rounded-2xl border-0 px-2 text-cafe md:gap-3 md:px-4"
                style={{
                  background: `color-mix(in srgb, ${tinteProfesional(i, e.id)} 94%, transparent)`,
                  boxShadow: "0 4px 12px rgba(59, 47, 42, 0.10)",
                }}>
                <div className="min-w-0">
                  <b className="block truncate text-xs md:text-[15px]">{e.name}</b>
                  <small className="block text-[11px] leading-tight text-muted-foreground tabular-nums">
                    <span className="block">{mias.length} citas</span>
                    <span className="block">{ocupacionDe(citas, e, dia.getDay())} % ocupada</span>
                  </small>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={derecha} className="relative grid min-w-0" style={{ gridTemplateRows: filas }}>
          <div className="relative border-b border-k-linea-f bg-transparent">
            {Array.from({ length: horas }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "absolute top-[13px] text-xs font-bold text-k-tinta2 tabular-nums",
                  esHoy && minAhora - i * 60 > -20 && minAhora - i * 60 < 45 && "opacity-0",
                )}
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
              return {
                ...base,
                top: `calc(10px + (100% - 20px) * ${carril / total})`,
                bottom: "auto",
                height: `calc((100% - 20px) / ${total} - 2px)`,
              };
            };
            return (
              <div
                key={e.id}
                className="relative border-b border-k-linea last:border-b-0"
                style={fondo}
              >
                {pausasDe(e, dia.getDay()).map((p) => (
                  <BloquePausa key={`p${p.ini}`} style={pos(p.ini, p.fin - p.ini)} />
                ))}
                {huecosDe(citas, e, dia.getDay(), { desde }).map((t) => (
                  <BloqueHueco
                    key={`h${t.ini}`}
                    tramo={t}
                    dosLineas
                    style={pos(t.ini, t.fin - t.ini)}
                    onClick={() => onHueco(e.id, t.ini, dia)}
                  />
                ))}
                {mias.map((a) =>
                  a.status === "blocked" ? (
                    <BloquePausa key={a.id} texto={a.note || "Bloqueado"} style={posCita(a)} />
                  ) : (
                    <BloqueCita
                      key={a.id}
                      a={a}
                      carta={carta}
                      services={services}
                      variante="crono"
                      seleccionada={a.id === seleccionadaId}
                      style={posCita(a)}
                      onClick={() => onCita(a)}
                    />
                  ),
                )}
              </div>
            );
          })}
          {/* Fuera de la jornada: rayado tenue, como en la rejilla. */}
          {[
            { ini: 0, fin: jornada.ini },
            { ini: jornada.fin, fin: 24 * 60 },
          ]
            .filter((t) => t.fin > t.ini)
            .map((t) => (
              <div
                key={`f${t.ini}`}
                aria-hidden="true"
                className="pointer-events-none absolute top-[46px] bottom-0 z-[1] bg-[repeating-linear-gradient(135deg,var(--k-cerrado)_0_6px,transparent_6px_12px)] opacity-55"
                style={{
                  left: `${porcentaje(t.ini, h)}%`,
                  width: `${((t.fin - t.ini) / (24 * 60)) * 100}%`,
                }}
              />
            ))}
          {esHoy && minAhora >= h.ini && minAhora <= h.fin && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-[5] w-0.5 bg-k-ahora"
              style={{ left: `${porcentaje(minAhora, h)}%` }}
              aria-hidden="true"
            >
              <i className="absolute top-[11px] -left-[22px] rounded-full bg-k-ahora px-1.5 text-[10px] font-extrabold text-white not-italic tabular-nums">
                {hora(ahora)}
              </i>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Día y semana: rejilla vertical ---------- */

/* ---------- Mes ---------- */

function VistaMes({
  anchor,
  appointments,
  equipo,
  ahora,
  primerDia,
  onDia,
  diasEspeciales,
}: {
  anchor: Date;
  appointments: Appointment[];
  equipo: Employee[];
  ahora: Date;
  primerDia: PrimerDia;
  onDia: (d: Date) => void;
  diasEspeciales?: import("@/lib/mock/types").DiaEspecial[];
}) {
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
      <div
        className="grid h-full min-w-[700px] grid-cols-7"
        style={{ gridTemplateRows: `auto repeat(${filas}, minmax(88px, 1fr))` }}
      >
        {cabeceras.map((d) => (
          <div key={d} className="border-b border-k-linea-f bg-[rgba(255,255,255,.35)] p-2.5 text-[11px] font-bold tracking-[0.06em] text-k-tinta2 uppercase backdrop-blur-[8px]">
            {d}
          </div>
        ))}
        {celdas.map((d) => {
          const citas = citasDeCalendario(appointments, d).filter((a) => a.status !== "blocked");
          const fuera = d.getMonth() !== anchor.getMonth();
          const hoy = mismoDia(d, ahora);
          const abre = equipo.some(
            (e) => franjasProfesionalEnFecha(e, fechaISO(d), diasEspeciales).length > 0,
          );
          const especial = diasEspeciales?.some((x) => x.fecha === fechaISO(d));
          return (
            <button
              key={d.getTime()}
              type="button"
              onClick={() => onDia(d)}
              aria-label={`${d.getDate()} de ${MESES[d.getMonth()]}, ${citas.length} citas`}
              className={cn(
                "flex flex-col gap-1.5 border-r border-b border-k-linea-f bg-transparent p-2 text-left text-k-tinta [&:nth-child(7n)]:border-r-0",
                fuera ? "text-cafe-suave" : "hover:bg-[#fafaf8]",
              )}
            >
              <span className="flex items-center justify-between">
                <span className={cn("grid size-[26px] place-items-center rounded-full text-[13px] font-medium tabular-nums", hoy && "bg-[#303030] text-white")}>{d.getDate()}</span>
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
                      <span
                        key={e.id}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-k-tinta2"
                        title={`${e.name}: ${mias.length} citas · ${pct} %`}
                      >
                        <b className="w-3">{e.name[0]}</b>
                        <i className="block h-[7px] flex-1 overflow-hidden rounded-full bg-beige">
                          <u
                            className="block h-full rounded-full"
                            style={{ width: `${pct}%`, background: barraPro(i) }}
                          />
                        </i>
                        <span className="tabular-nums">{mias.length}</span>
                      </span>
                    );
                  })}
                </span>
              ) : (
                <span className="mt-auto text-xs text-muted-foreground">
                  {abre ? (especial ? "Especial" : "") : "Cerrado"}
                </span>
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
      <Tarjeta
        className={tarjeta}
        titulo="Huecos libres"
        sub="Pulsa uno para dar la cita"
        extra={
          <span className="ml-auto inline-flex h-6 items-center rounded-full bg-salvia-clara px-2.5 text-[12.5px] font-bold text-hoja-tinta tabular-nums">
            {ordenados.length}
          </span>
        }
      >
        {ordenados.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            No queda ningún hueco de media hora o más.
          </p>
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

function Tarjeta({
  className,
  titulo,
  sub,
  extra,
  children,
}: {
  className: string;
  titulo: string;
  sub: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
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

function FormRango({
  inicial,
  anchor,
  onVer,
}: {
  inicial: { inicio: Date; n: number } | null;
  anchor: Date;
  onVer: (r: { inicio: Date; n: number }) => void;
}) {
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
        <input
          type="date"
          className={campo}
          value={desde}
          onChange={(e) => {
            setDesde(e.target.value);
            setError(null);
          }}
        />
      </label>
      <label className="grid gap-1.5 text-[13px] font-bold">
        Hasta
        <input
          type="date"
          className={campo}
          value={hasta}
          onChange={(e) => {
            setHasta(e.target.value);
            setError(null);
          }}
        />
      </label>
      <p className="text-[12.5px] text-cafe-suave">
        Hasta {MAX_DIAS_ELEGIDOS} días. Las flechas saltan a los siguientes días del mismo tamaño.
      </p>
      {error && (
        <p role="alert" className="text-[12.5px] text-melocoton-tinta">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="h-10 rounded-full bg-primary text-[14px] font-bold text-primary-foreground"
      >
        Ver estos días
      </button>
    </form>
  );
}
