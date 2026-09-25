import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { colorElegidoProfesional } from "@/lib/colores-elegidos";
import { hora } from "@/lib/copy";
import { serviceLabelOf } from "@/lib/appointment-services";
import { franjasProfesional } from "@/lib/horario-equipo";
import { indiceColorServicio, minutosAHora } from "@/lib/hoy-arena";
import { carrilesSolapados, citasDeCalendario, iniciales, minutosDe, mismoDia, pausasDe } from "@/lib/calendario-arena";
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
  desde,
  hasta,
  ahora,
  carta,
  services,
  colorPor,
  anchoMinimo,
  onCita,
  onHueco,
}: {
  columnas: ColumnaRejilla[];
  appointments: Appointment[];
  /** El equipo entero, en su orden: da el color de cada profesional. */
  todoElEquipo: Employee[];
  desde: number;
  hasta: number;
  ahora: Date;
  carta: Record<string, Service>;
  services: Service[];
  colorPor: "servicio" | "profesional";
  anchoMinimo: number;
  onCita: (a: Appointment) => void;
  onHueco: (employeeId: EmployeeId, minuto: number, dia: Date) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cabecera = useRef<HTMLDivElement>(null);
  const horas = hasta - desde;
  // La altura de una hora se ajusta al hueco: el rango elegido llena la
  // pantalla y solo hay scroll si no cabe a 48 px por hora. Se mide con
  // ResizeObserver, así sigue bien al abrir un panel o cambiar la ventana.
  const [px, setPx] = useState(PX_HORA);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const altoCab = cabecera.current?.offsetHeight ?? 64;
      setPx(altoPorHora(el.clientHeight - altoCab - 1, horas));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [horas]);
  const y = (min: number) => ((min - desde * 60) / 60) * px;

  // Al abrir, el día laborable a la vista: desde la hora actual si hoy está
  // en pantalla y ya ha empezado la jornada; si no, desde la primera franja.
  const primeraFranja = Math.min(
    ...columnas.flatMap((c) => c.equipo.flatMap((e) => franjasProfesional(e, c.dia.getDay()).map((f) => f.start))),
    24 * 60,
  );
  const hoyVisible = columnas.some((c) => mismoDia(c.dia, ahora));
  const claveScroll = columnas.map((c) => c.clave).join("|");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Arriba, el principio de la jornada. Si hoy está en pantalla y la hora
    // actual no cabría, se baja lo justo para dejarla a un tercio del alto.
    let top = y(primeraFranja - 30);
    const yAhora = y(minutosDe(ahora));
    if (hoyVisible && yAhora > top + el.clientHeight - 140) top = yAhora - el.clientHeight / 3;
    el.scrollTop = Math.max(0, top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveScroll]);

  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-auto overscroll-contain">
      <div className="grid" style={{ gridTemplateColumns: `52px repeat(${columnas.length}, minmax(${anchoMinimo}px, 1fr))` }}>
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
                "sticky top-0 z-[10] flex min-h-[64px] flex-col justify-center border-b border-l border-k-linea-f bg-k-cab px-2 py-2 text-left text-k-tinta",
                c.onCabecera && "hover:bg-beige",
                cerrado && "text-cafe-suave",
              )}
            >
              {c.cabecera}
            </Etiqueta>
          );
        })}

        {/* Columna de horas, fija a la izquierda. */}
        <div className="sticky left-0 z-[9] border-r border-k-linea-f bg-k-cab" style={{ height: horas * px }}>
          {Array.from({ length: horas }, (_, i) =>
            i === 0 ? null : (
              <span
                key={i}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-bold text-cafe-medio tabular-nums"
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
            appointments={appointments}
            todoElEquipo={todoElEquipo}
            desde={desde}
            horas={horas}
            ahora={ahora}
            carta={carta}
            services={services}
            colorPor={colorPor}
            y={y}
            px={px}
            onCita={onCita}
            onHueco={onHueco}
          />
        ))}
      </div>
    </div>
  );
}

function ColumnaDia({
  columna,
  appointments,
  todoElEquipo,
  desde,
  horas,
  ahora,
  carta,
  services,
  colorPor,
  y,
  px,
  onCita,
  onHueco,
}: {
  columna: ColumnaRejilla;
  appointments: Appointment[];
  todoElEquipo: Employee[];
  desde: number;
  horas: number;
  ahora: Date;
  carta: Record<string, Service>;
  services: Service[];
  colorPor: "servicio" | "profesional";
  y: (min: number) => number;
  px: number;
  onCita: (a: Appointment) => void;
  onHueco: (employeeId: EmployeeId, minuto: number, dia: Date) => void;
}) {
  const { dia, equipo } = columna;
  const [fantasma, setFantasma] = useState<number | null>(null);
  const ids = new Set(equipo.map((e) => e.id));
  const citas = citasDeCalendario(appointments, dia).filter((a) => ids.has(a.employeeId));
  const carriles = carrilesSolapados(citas);
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
    backgroundImage: `linear-gradient(var(--k-linea-f) 1px, transparent 1px), linear-gradient(var(--k-linea-media) 1px, transparent 1px)`,
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
          className="pointer-events-none absolute inset-x-0 bg-[repeating-linear-gradient(135deg,var(--k-cerrado)_0_6px,transparent_6px_12px)]"
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
          className="pointer-events-none absolute inset-x-1 z-[3] rounded-md border border-dashed border-cafe-medio bg-card/80 px-1.5 text-[11px] font-bold text-cafe-medio tabular-nums"
          style={{ top: y(fantasma) + 1, height: px / 2 - 2 }}
        >
          + {minutosAHora(fantasma)}
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
            <div key={a.id} data-cita className="absolute z-[4] grid place-items-center overflow-hidden rounded-md border border-cafe/60 bg-beige text-[11px] font-semibold text-cafe-suave" style={style}>
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
            estrecha={total >= 3}
            style={style}
            onClick={() => onCita(a)}
          />
        );
      })}
      {esHoy && <LineaAhora y={y(minutosDe(ahora))} alto={horas * px} />}
    </div>
  );
}

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
  const cabeHora = estrecha ? alto >= 40 : true;
  return (
    <button
      type="button"
      data-cita
      onClick={onClick}
      title={`${a.clientName} · ${nombreServicio} · ${hora(a.start)}–${minutosAHora(ini + a.duration)}${pro ? ` · ${pro}` : ""}${pendiente ? " · por confirmar" : ""}`}
      className={cn(
        "absolute z-[4] flex flex-col overflow-hidden rounded-md border border-cafe px-1.5 text-left text-[12px] leading-[1.25] text-cafe hover:z-[7] hover:shadow-[0_2px_8px_rgba(59,47,42,0.18)] focus-visible:z-[7] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
        estrecha ? "px-1 py-0.5 text-[11px]" : alto < 34 ? "flex-row items-center gap-1.5 py-0" : "py-1",
        pendiente && "border-dashed",
        noVino && "opacity-60",
      )}
      style={{ ...style, background: pendiente ? "var(--superficie)" : (fondo ?? `var(--serv-${n})`) }}
    >
      <span className="flex min-w-0 items-center gap-1">
        {pro && !estrecha && (
          <span className="grid size-[18px] shrink-0 place-items-center rounded-full border border-cafe/40 bg-superficie text-[9px] font-extrabold" aria-hidden="true">
            {iniciales(pro)}
          </span>
        )}
        <b className={cn("truncate font-extrabold", noVino && "line-through")}>{estrecha ? pila : nombre}</b>
      </span>
      {cabeHora && (
        <span className="shrink-0 truncate text-[11px] font-semibold text-cafe-medio tabular-nums">
          {hora(a.start)}
          {!estrecha && alto >= 50 && ` – ${minutosAHora(ini + a.duration)}`}
          {!estrecha && vino && " · vino"}
        </span>
      )}
      {!estrecha && alto >= 72 && <span className="truncate text-[11px] text-cafe-medio">{nombreServicio}</span>}
    </button>
  );
}
