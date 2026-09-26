import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Clock3, UserX } from "lucide-react";
import { colorElegidoProfesional } from "@/lib/colores-elegidos";
import { hora } from "@/lib/copy";
import { serviceLabelOf } from "@/lib/appointment-services";
import { franjasProfesional } from "@/lib/horario-equipo";
import { indiceColorServicio, minutosAHora } from "@/lib/hoy-arena";
import { esBloqueExterno } from "@/lib/calendarios-panel";
import { carrilesSolapados, citasPorDia, iniciales, minutosDe, mismoDia, pausasDe } from "@/lib/calendario-arena";
import { toDateKey } from "@/lib/reparto";
import type { Appointment, Employee, EmployeeId, Service } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

/**
 * Rejilla de tiempo de Día, 3 días y Semana, con la estructura de Google
 * Calendar y Apple Calendar: columna de horas fija a la izquierda, cabecera
 * fija arriba, columnas de igual anchura, una línea por hora y otra más
 * suave cada media hora, citas posicionadas por hora con alto proporcional,
 * solapes en subcolumnas y la línea de «ahora». Pulsar un hueco vacío abre
 * «Nueva cita» a esa hora (redondeada al cuarto).
 */

/**
 * Lote 15: la rejilla pinta las 24 h (00:00-24:00) y se recorre con scroll,
 * como Google y Apple Calendar. Las «horas visibles» de Ajustes son el tramo
 * que se ve AL ABRIR (y el que decide el alto de una hora), no un recorte.
 */
export const HORAS_DIA = 24;

/** Alto de una hora en la rejilla. Fijo, como en Google: el día se recorre con scroll. */
export const PX_HORA = 64;
/** Por debajo de esto, las citas de media hora no se leen: la rejilla pasa a tener scroll. */
export const PX_HORA_MINIMO = 48;

/**
 * Altura de una hora para que el rango elegido llene el alto disponible (lo
 * que queda bajo la cabecera de días); si no cabe ni a 48 px por hora, 48 y
 * scroll. Función pura, con test.
 */
export function altoPorHora(altoDisponible: number, horas: number): number {
  if (horas <= 0 || altoDisponible <= 0) return PX_HORA;
  return Math.max(PX_HORA_MINIMO, Math.floor(altoDisponible / horas));
}

/**
 * Dónde queda el scroll al abrir (px desde las 00:00): el principio de las
 * horas visibles; si hoy está en pantalla y la hora actual cae dentro,
 * una hora antes de ahora. Pura, con test.
 */
export function scrollInicial(pxHora: number, verDesde: number, verHasta: number, minutoAhoraSiHoy: number | null): number {
  const dentro = minutoAhoraSiHoy !== null && minutoAhoraSiHoy >= verDesde * 60 && minutoAhoraSiHoy < verHasta * 60;
  const minuto = dentro ? minutoAhoraSiHoy - 60 : verDesde * 60;
  return Math.max(0, (minuto / 60) * pxHora);
}

export type ColumnaRejilla = {
  clave: string;
  dia: Date;
  /** Profesionales cuyas citas caen en esta columna. */
  equipo: Employee[];
  cabecera: ReactNode;
  /** Pulsar la cabecera (en Semana y 3 días abre ese día). */
  onCabecera?: () => void;
};

/** Pasteles por profesional cuando la rejilla junta a todo el equipo. */
export const colorProfesional = (i: number, id?: string) => `var(--pro-${colorElegidoProfesional(id) ?? (i % 4) + 1})`;

export function RejillaCalendario({
  columnas,
  appointments,
  todoElEquipo,
  desde: verDesde,
  hasta: verHasta,
  irAAhora = 0,
  ahora,
  carta,
  services,
  colorPor,
  anchoMinimo,
  seleccionadaId,
  onCita,
  onHueco,
}: {
  columnas: ColumnaRejilla[];
  appointments: Appointment[];
  /** El equipo entero, en su orden: da el color de cada profesional. */
  todoElEquipo: Employee[];
  /** Horas que se ven al abrir (Ajustes › Tu agenda): el resto, con scroll. */
  desde: number;
  hasta: number;
  /** Cambia cada vez que se pulsa «Hoy»: baja hasta ahora con scroll suave. */
  irAAhora?: number;
  ahora: Date;
  carta: Record<string, Service>;
  services: Service[];
  colorPor: "servicio" | "profesional";
  anchoMinimo: number;
  /** La cita abierta en el detalle: lleva anillo. */
  seleccionadaId?: string;
  onCita: (a: Appointment) => void;
  onHueco: (employeeId: EmployeeId, minuto: number, dia: Date) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLDivElement>(null);
  const cabecera = useRef<HTMLDivElement>(null);
  const desde = 0;
  const horas = HORAS_DIA;
  const horasVisibles = Math.max(1, verHasta - verDesde);
  // La altura de una hora hace que las horas visibles llenen el hueco (48 px
  // como mínimo); el resto del día queda arriba y abajo, con scroll. Se mide
  // con ResizeObserver, así sigue bien al abrir un panel o cambiar la ventana.
  const [px, setPx] = useState(PX_HORA);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const altoCab = cabecera.current?.offsetHeight ?? 64;
      setPx(altoPorHora(el.clientHeight - altoCab - 1, horasVisibles));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [horasVisibles]);
  const y = (min: number) => ((min - desde * 60) / 60) * px;
  // Lote 15.4: la agenda se agrupa por día UNA vez por lista de citas; cada
  // columna recibe solo las suyas y no se repinta si no cambian (memo).
  const porDia = useMemo(() => citasPorDia(appointments), [appointments]);

  // Al abrir: arriba, el principio de las horas visibles; si hoy está en
  // pantalla y la hora actual cae dentro, «ahora» menos una hora.
  const hoyVisible = columnas.some((c) => mismoDia(c.dia, ahora));
  const claveScroll = columnas.map((c) => c.clave).join("|");
  const topInicial = () => scrollInicial(px, verDesde, verHasta, hoyVisible ? minutosDe(ahora) : null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = topInicial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveScroll, px, verDesde, verHasta]);
  // Al cambiar de día, semana o vista: fundido corto, sin desmontar la rejilla
  // (así no se pierde el scroll ni se repinta en blanco).
  const primera = useRef(true);
  useLayoutEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    lienzo.current?.animate?.([{ opacity: 0.35, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: "ease-out" });
  }, [claveScroll]);
  // Etiquetas de hora que quedarían medio tapadas por la cabecera fija: se
  // ocultan enteras (como Google Calendar). Sin React: 23 spans, una vez por fotograma.
  const horasCol = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const col = horasCol.current;
    if (!el || !col) return;
    let pendiente = 0;
    const ajustar = () => {
      pendiente = 0;
      const limite = el.scrollTop + 10; // media etiqueta: por encima, la taparía la cabecera
      for (const sp of Array.from(col.children) as HTMLElement[]) {
        const top = Number(sp.dataset.top);
        sp.style.visibility = top < limite ? "hidden" : "";
      }
    };
    const alScroll = () => {
      if (!pendiente) pendiente = requestAnimationFrame(ajustar);
    };
    ajustar();
    el.addEventListener("scroll", alScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", alScroll);
      cancelAnimationFrame(pendiente);
    };
  }, [px]);
  const minAhoraVisible = hoyVisible ? minutosDe(ahora) : null;
  // «Hoy»: hasta ahora, con scroll suave (sin animación si se pide menos movimiento).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !irAAhora) return;
    const suave = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: Math.max(0, y(minutosDe(ahora) - 60)), behavior: suave ? "smooth" : "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [irAAhora]);

  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable]">
      <div ref={lienzo} className="grid" style={{ gridTemplateColumns: `52px repeat(${columnas.length}, minmax(${anchoMinimo}px, 1fr))` }}>
        {/* Cabecera fija: esquina vacía y un encabezado por columna. */}
        <div ref={cabecera} className="sticky top-0 left-0 z-[12] border-r border-b border-k-linea-f bg-k-cab" />
        {columnas.map((c) => {
          const cerrado = c.equipo.every((e) => franjasProfesional(e, c.dia.getDay()).length === 0);
          const Etiqueta = c.onCabecera ? "button" : "div";
          return (
            <Etiqueta
              key={c.clave}
              {...(c.onCabecera ? { type: "button" as const, onClick: c.onCabecera } : {})}
              className={cn(
                "sticky top-0 z-[10] flex min-h-[58px] flex-col justify-center border-b border-l border-k-linea bg-k-cab px-2 py-1.5 text-left text-k-tinta transition-colors",
                c.onCabecera && "hover:bg-beige",
                cerrado && "text-cafe-suave",
              )}
            >
              {c.cabecera}
            </Etiqueta>
          );
        })}

        {/* Columna de horas, fija a la izquierda. */}
        <div ref={horasCol} className="sticky left-0 z-[9] border-r border-k-linea-f bg-k-cab" style={{ height: horas * px }}>
          {Array.from({ length: horas }, (_, i) =>
            i === 0 ? null : (
              <span
                key={i}
                data-top={i * px}
                className={cn(
                  "absolute right-2 -translate-y-1/2 text-[10.5px] font-semibold text-cafe-suave tabular-nums",
                  // El punto rojo de «ahora» no pisa la etiqueta de su hora.
                  minAhoraVisible !== null && Math.abs(minAhoraVisible - i * 60) < 12 && "opacity-0",
                )}
                style={{ top: i * px }}
              >
                {desde + i}:00
              </span>
            ),
          )}
        </div>

        {columnas.map((c) => (
          <ColumnaDia
            key={c.clave}
            columna={c}
            citasDelDia={porDia.get(toDateKey(c.dia)) ?? SIN_CITAS}
            todoElEquipo={todoElEquipo}
            desde={desde}
            horas={horas}
            ahora={ahora}
            carta={carta}
            services={services}
            colorPor={colorPor}
            px={px}
            seleccionadaId={seleccionadaId}
            onCita={onCita}
            onHueco={onHueco}
          />
        ))}
      </div>
    </div>
  );
}

const SIN_CITAS: Appointment[] = [];

/**
 * Solo se repinta si cambia algo suyo: sus citas, el alto de hora, la cita
 * seleccionada (si es suya), el color, o el minuto de «ahora» si es hoy. La
 * cabecera de la columna (JSX nuevo en cada render del padre) no cuenta.
 */
function mismaColumna(a: PropsColumna, b: PropsColumna): boolean {
  const ids = (l: Employee[]) => l.map((e) => e.id).join(",");
  const esHoy = mismoDia(b.columna.dia, b.ahora);
  const sel = (p: PropsColumna) => (p.seleccionadaId && p.citasDelDia.some((c) => c.id === p.seleccionadaId) ? p.seleccionadaId : "");
  return (
    a.columna.clave === b.columna.clave &&
    ids(a.columna.equipo) === ids(b.columna.equipo) &&
    a.citasDelDia === b.citasDelDia &&
    ids(a.todoElEquipo) === ids(b.todoElEquipo) &&
    a.px === b.px &&
    a.desde === b.desde &&
    a.horas === b.horas &&
    a.colorPor === b.colorPor &&
    a.carta === b.carta &&
    a.services === b.services &&
    a.onCita === b.onCita &&
    a.onHueco === b.onHueco &&
    sel(a) === sel(b) &&
    (!esHoy || (mismoDia(a.ahora, b.ahora) && minutosDe(a.ahora) === minutosDe(b.ahora))) &&
    mismoDia(a.columna.dia, a.ahora) === esHoy
  );
}

type PropsColumna = {
  columna: ColumnaRejilla;
  citasDelDia: Appointment[];
  todoElEquipo: Employee[];
  desde: number;
  horas: number;
  ahora: Date;
  carta: Record<string, Service>;
  services: Service[];
  colorPor: "servicio" | "profesional";
  px: number;
  seleccionadaId?: string;
  onCita: (a: Appointment) => void;
  onHueco: (employeeId: EmployeeId, minuto: number, dia: Date) => void;
};

const ColumnaDia = memo(function ColumnaDia({
  columna,
  citasDelDia,
  todoElEquipo,
  desde,
  horas,
  ahora,
  carta,
  services,
  colorPor,
  px,
  seleccionadaId,
  onCita,
  onHueco,
}: PropsColumna) {
  const { dia, equipo } = columna;
  const [fantasma, setFantasma] = useState<number | null>(null);
  const y = (min: number) => ((min - desde * 60) / 60) * px;
  const claveEquipo = equipo.map((e) => e.id).join(",");
  const citas = useMemo(() => {
    const ids = new Set(claveEquipo.split(","));
    return citasDelDia.filter((a) => ids.has(a.employeeId));
  }, [citasDelDia, claveEquipo]);
  const carriles = useMemo(() => carrilesSolapados(citas), [citas]);
  const weekday = dia.getDay();
  const esHoy = mismoDia(dia, ahora);

  // Lo que queda fuera del horario de todas las profesionales de la columna, sombreado.
  const franjas = equipo.flatMap((e) => franjasProfesional(e, weekday)).sort((a, b) => a.start - b.start);
  const abiertas: { ini: number; fin: number }[] = [];
  for (const f of franjas) {
    const ult = abiertas[abiertas.length - 1];
    if (ult && f.start <= ult.fin) ult.fin = Math.max(ult.fin, f.end);
    else abiertas.push({ ini: f.start, fin: f.end });
  }
  const cerradas: { ini: number; fin: number }[] = [];
  let cursor = desde * 60;
  for (const a of abiertas) {
    if (a.ini > cursor) cerradas.push({ ini: cursor, fin: a.ini });
    cursor = Math.max(cursor, a.fin);
  }
  if (cursor < (desde + horas) * 60) cerradas.push({ ini: cursor, fin: (desde + horas) * 60 });

  const minutoDe = (evY: number) => Math.floor((desde * 60 + (evY / px) * 60) / 15) * 15;
  const quienAtiende = (min: number): Employee | undefined =>
    equipo.find((e) => franjasProfesional(e, weekday).some((f) => min >= f.start && min < f.end)) ?? equipo[0];

  const fondo: CSSProperties = {
    height: horas * px,
    // Hora: línea fina; media hora: aún más tenue, como en Google Calendar.
    backgroundImage: `linear-gradient(var(--k-linea) 1px, transparent 1px), linear-gradient(color-mix(in srgb, var(--k-linea-media) 55%, transparent) 1px, transparent 1px)`,
    backgroundSize: `100% ${px}px, 100% ${px / 2}px`,
  };

  return (
    <div
      className={cn("relative cursor-pointer overflow-y-clip border-l border-k-linea-f", esHoy && "bg-salvia-suave/35")}
      style={fondo}
      title="Pulsa un hueco para dar una cita a esa hora"
      onMouseMove={(ev) => {
        if ((ev.target as HTMLElement).closest("[data-cita]")) return setFantasma(null);
        const r = ev.currentTarget.getBoundingClientRect();
        setFantasma(minutoDe(ev.clientY - r.top));
      }}
      onMouseLeave={() => setFantasma(null)}
      onClick={(ev) => {
        if ((ev.target as HTMLElement).closest("[data-cita]")) return;
        const r = ev.currentTarget.getBoundingClientRect();
        const min = minutoDe(ev.clientY - r.top);
        const e = quienAtiende(min);
        if (e) onHueco(e.id, min, dia);
      }}
    >
      {cerradas.map((t) => (
        <div
          key={`c${t.ini}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bg-[repeating-linear-gradient(135deg,var(--k-cerrado)_0_6px,transparent_6px_12px)] opacity-55"
          style={{ top: y(t.ini), height: y(t.fin) - y(t.ini) }}
        />
      ))}
      {equipo.length === 1 &&
        pausasDe(equipo[0], weekday).map((p) => (
          <div
            key={`p${p.ini}`}
            className="pointer-events-none absolute inset-x-1 grid place-items-center rounded-md border border-dashed border-lino-fuerte bg-beige/70 text-[11px] font-semibold text-cafe-suave"
            style={{ top: y(p.ini) + 1, height: y(p.fin) - y(p.ini) - 2 }}
          >
            Comida
          </div>
        ))}
      {fantasma !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 z-[3] flex items-center gap-1 rounded-[5px] border border-dashed border-cafe-medio/70 bg-card/85 px-1.5 text-[11px] font-bold text-cafe-medio tabular-nums"
          style={{ top: y(fantasma) + 1, height: px / 2 - 2 }}
        >
          <span className="text-[14px] leading-none">+</span> {minutosAHora(fantasma)}
        </div>
      )}
      {citas.map((a) => {
        const { carril, total } = carriles.get(a.id) ?? { carril: 0, total: 1 };
        const ini = minutosDe(a.start);
        const style: CSSProperties = {
          top: y(ini) + 1,
          height: Math.max(18, (a.duration / 60) * px - 2),
          left: `calc(${(carril / total) * 100}% + 2px)`,
          width: `calc(${100 / total}% - 4px)`,
        };
        if (a.status === "blocked") {
          return (
            <div
              key={a.id}
              data-cita
              className="absolute z-[4] grid place-items-center overflow-hidden rounded-md border border-cafe/60 bg-beige text-[11px] font-semibold text-cafe-suave"
              // 14c: lo ocupado en un calendario externo va rayado, como la pausa.
              style={esBloqueExterno(a) ? { ...style, background: "repeating-linear-gradient(135deg,#EDE4D8 0 7px,#F5EFE6 7px 14px)" } : style}
            >
              {a.note || "Bloqueado"}
            </div>
          );
        }
        const iPro = todoElEquipo.findIndex((e) => e.id === a.employeeId);
        const pro = todoElEquipo[iPro];
        return (
          <CitaRejilla
            key={a.id}
            a={a}
            carta={carta}
            services={services}
            fondo={colorPor === "profesional" ? colorProfesional(Math.max(0, iPro), a.employeeId) : undefined}
            pro={colorPor === "profesional" && pro ? pro.name : undefined}
            estrecha={total === 3}
            compacta={total > 3}
            // Con carriles estrechos (la semana con todo el equipo) el icono taparía el nombre.
            conIcono={total === 1 || (colorPor === "servicio" && total === 2)}
            seleccionada={a.id === seleccionadaId}
            style={style}
            onClick={() => onCita(a)}
          />
        );
      })}
      {esHoy && <LineaAhora y={y(minutosDe(ahora))} alto={horas * px} />}
    </div>
  );
}, mismaColumna);

function LineaAhora({ y, alto }: { y: number; alto: number }) {
  if (y < 0 || y > alto) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 z-[6]" style={{ top: y }} aria-hidden="true">
      <span className="absolute -top-[5px] -left-[6px] size-[11px] rounded-full bg-k-ahora" />
      <span className="block h-0.5 bg-k-ahora" />
    </div>
  );
}

/** Una cita en la rejilla: pastel, borde fino café y radio pequeño. */
export function CitaRejilla({
  a,
  carta,
  services,
  fondo,
  pro,
  estrecha = false,
  compacta = false,
  conIcono = true,
  seleccionada = false,
  style,
  onClick,
}: {
  a: Appointment;
  carta: Record<string, Service>;
  services: Service[];
  /** Fondo por profesional; si no llega, el del servicio. */
  fondo?: string;
  /** Nombre de la profesional, para su chip de iniciales. */
  pro?: string;
  /** Tres o más citas a la vez: solo el nombre de pila, sin chip. */
  estrecha?: boolean;
  /** Más de tres a la vez: modo compacto, solo el nombre de pila. */
  compacta?: boolean;
  conIcono?: boolean;
  seleccionada?: boolean;
  style: CSSProperties;
  onClick: () => void;
}) {
  const n = indiceColorServicio(a.serviceIds[0], services);
  const pendiente = a.status === "pending";
  const noVino = a.status === "no-show";
  const vino = a.status === "completed";
  const ini = minutosDe(a.start);
  const alto = typeof style.height === "number" ? style.height : 60;
  const nombreServicio = serviceLabelOf(a, carta);
  const nombre = (a.clientName || "Sin nombre").trim();
  const pila = nombre.split(/\s+/)[0];
  const cabeHora = !compacta && (estrecha ? alto >= 40 : alto >= 30);
  const dosLineas = !estrecha && !compacta && alto >= 34;
  const cabeServicio = !estrecha && !compacta && alto >= 52;
  return (
    <button
      type="button"
      data-cita
      onClick={onClick}
      aria-pressed={seleccionada}
      title={`${a.clientName} · ${nombreServicio} · ${hora(a.start)}–${minutosAHora(ini + a.duration)}${pro ? ` · ${pro}` : ""}${pendiente ? " · por confirmar" : ""}${vino ? " · vino" : ""}${noVino ? " · no vino" : ""}`}
      className={cn(
        "@container absolute z-[4] flex flex-col overflow-hidden rounded-[5px] border border-cafe text-left text-[12px] leading-[1.25] text-cafe transition-shadow duration-150 hover:z-[7] hover:shadow-[0_3px_10px_rgba(59,47,42,0.16)] focus-visible:z-[7] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
        compacta ? "px-[3px] py-0.5 text-[10.5px]" : estrecha ? "px-1 py-0.5 text-[11px]" : dosLineas ? "px-1.5 py-1" : "flex-row items-center gap-1.5 px-1.5 py-0",
        pendiente && "border-dashed",
        noVino && "opacity-60",
        seleccionada && "z-[8] ring-2 ring-primary ring-offset-1 ring-offset-card",
        // Sitio para el icono de estado, que no tape la hora.
        conIcono && !compacta && a.status !== "confirmed" && a.status !== "blocked" && "pr-5",
      )}
      style={{ ...style, background: pendiente ? "var(--superficie)" : (fondo ?? `var(--serv-${n})`) }}
    >
      {/* En carriles de menos de 20 px de texto (la semana en el móvil) no cabe ni una
          letra: solo el bloque de color; al pulsarlo sale el detalle. */}
      <span className="flex min-w-0 items-center gap-1 @max-[20px]:hidden">
        {pro && !estrecha && !compacta && (
          <span className="grid size-[18px] shrink-0 place-items-center rounded-full border border-cafe/40 bg-superficie text-[9px] font-extrabold" aria-hidden="true">
            {iniciales(pro)}
          </span>
        )}
        <b className={cn("truncate font-extrabold", noVino && "line-through")}>{estrecha || compacta ? pila : nombre}</b>
      </span>
      {cabeHora && (
        <span className="shrink-0 truncate text-[11px] font-semibold text-cafe-medio tabular-nums @max-[20px]:hidden">
          {hora(a.start)}
          {dosLineas && alto >= 50 && ` – ${minutosAHora(ini + a.duration)}`}
        </span>
      )}
      {cabeServicio && <span className="truncate text-[11px] text-cafe-medio @max-[20px]:hidden">{nombreServicio}</span>}
      {conIcono && !compacta && <IconoEstado status={a.status} className={cn("@max-[60px]:hidden", dosLineas ? "top-1 right-1" : "top-1/2 right-1 -translate-y-1/2")} />}
    </button>
  );
}

/** Estado de la cita con un icono discreto (el texto va en el title). */
export function IconoEstado({ status, className }: { status: Appointment["status"]; className?: string }) {
  const Icono = status === "completed" ? Check : status === "pending" ? Clock3 : status === "no-show" ? UserX : null;
  if (!Icono) return null;
  const txt = status === "completed" ? "Vino" : status === "pending" ? "Por confirmar" : "No vino";
  return (
    <span className={cn("absolute grid size-[15px] place-items-center rounded-full bg-card/85 text-cafe-medio", className)} role="img" aria-label={txt}>
      <Icono className="size-[10px]" strokeWidth={2.4} aria-hidden="true" />
    </span>
  );
}
