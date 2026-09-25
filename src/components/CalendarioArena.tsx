import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { serviceLabelOf } from "@/lib/appointment-services";
import { franjasProfesional } from "@/lib/horario-equipo";
import { hora } from "@/lib/copy";
import { indiceColorServicio, minutosAHora } from "@/lib/hoy-arena";
import {
  carrilesSolapados,
  celdasDelMes,
  citasDeCalendario,
  diasDeSemana,
  horizonteDeDias,
  horizonteDelDia,
  huecosDe,
  iniciales,
  inicioDelDia,
  lunesDe,
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

/**
 * Calendario con la identidad «Arena» (DESIGN.md), calcado del prototipo v2:
 * cuatro vistas (Día, Semana, Mes y Cronograma), paleta propia de pasteles
 * fríos en la que el color dice el SERVICIO, línea de «ahora» añil, huecos
 * libres que abren «Nueva cita» con la profesional y la hora puestas, y el
 * detalle de cada cita en el panel lateral de siempre.
 */

type Vista = "dia" | "semana" | "mes" | "cronograma";
const VISTAS: { id: Vista; label: string }[] = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "cronograma", label: "Cronograma" },
];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DCORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DSEM = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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

export function CalendarioArena() {
  const appointments = useSalonStore((s) => s.appointments);
  const services = useSalonStore((s) => s.services);
  const equipo = useEquipo();
  const soloUno = esSoloUnProfesional(equipo);
  const carta = useMemo(() => selectServiceMap(services), [services]);
  const ahora = useAhora();

  const [anchor, setAnchor] = useState(() => inicioDelDia(new Date()));
  const [vista, setVista] = useState<Vista>("cronograma");
  const [seleccionada, setSeleccionada] = useState<Appointment | null>(null);
  const [prefill, setPrefill] = useState<{ date: Date; employeeId: EmployeeId } | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);

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
    if (vista === "mes") {
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
    } else {
      d.setDate(d.getDate() + n * (vista === "semana" ? 7 : 1));
    }
    setAnchor(d);
  }

  let titulo: string;
  if (vista === "semana") {
    const dias = diasDeSemana(anchor, equipo);
    const ult = dias[dias.length - 1];
    titulo = `Semana del ${dias[0].getDate()} al ${ult.getDate()} de ${MESES[ult.getMonth()]}`;
  } else if (vista === "mes") {
    titulo = `${capital(MESES[anchor.getMonth()])} de ${anchor.getFullYear()}`;
  } else {
    titulo = fechaTxt(anchor);
  }
  const porConfirmar = citasDia.filter((a) => a.status === "pending").length;
  const numCitas = citasDia.filter((a) => a.status !== "blocked").length;

  return (
    // Altura fija a la ventana para que Día, Semana y Mes tengan scroll
    // interno. El cronograma, en pantallas bajas, deja crecer la página: así
    // cada profesional conserva sus 110 px y el pie no aplasta la rejilla.
    <div
      className={cn(
        "flex flex-col md:h-[calc(100dvh-71px-52px)] md:min-h-[620px]",
        vista === "cronograma" && "md:[@media(max-height:879px)]:h-auto",
      )}
    >
      {/* Barra: navegación, título, resumen y vistas */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => mover(-1)} aria-label="Anterior" className="grid size-[42px] place-items-center rounded-full border border-input bg-card text-cafe-medio hover:bg-nata">
            <ChevronLeft className="size-[18px]" strokeWidth={1.6} />
          </button>
          <button type="button" onClick={() => setAnchor(inicioDelDia(new Date()))} className="h-[42px] rounded-full border border-input bg-card px-[18px] text-sm font-bold hover:bg-nata">
            Hoy
          </button>
          <button type="button" onClick={() => mover(1)} aria-label="Siguiente" className="grid size-[42px] place-items-center rounded-full border border-input bg-card text-cafe-medio hover:bg-nata">
            <ChevronRight className="size-[18px]" strokeWidth={1.6} />
          </button>
        </div>
        <h1 className="basis-full text-xl font-extrabold tracking-[-0.02em] md:basis-auto md:text-[26px]">{titulo}</h1>
        {(vista === "dia" || vista === "cronograma") && (
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex h-6 items-center rounded-full bg-nata px-2.5 text-[12.5px] font-bold text-cafe-medio tabular-nums">{numCitas} citas</span>
            <span className="inline-flex h-6 items-center rounded-full bg-salvia-clara px-2.5 text-[12.5px] font-bold text-hoja-tinta tabular-nums">{huecosDia.length} huecos libres</span>
            {porConfirmar > 0 && (
              <span className="inline-flex h-6 items-center rounded-full border-[1.5px] border-dashed border-moca bg-card px-2.5 text-[12.5px] font-bold text-primary tabular-nums">
                {porConfirmar} por confirmar
              </span>
            )}
          </div>
        )}
        <div role="tablist" aria-label="Vista del calendario" className="grid w-full grid-cols-4 gap-0.5 rounded-full border border-border bg-nata p-1 md:ml-auto md:inline-flex md:w-auto">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={vista === v.id}
              onClick={() => setVista(v.id)}
              className={cn(
                "h-[34px] rounded-full px-1 text-[13px] font-bold whitespace-nowrap text-cafe-medio md:px-[15px]",
                vista === v.id && "bg-card text-foreground shadow-[0_1px_3px_rgba(59,47,42,0.12)]",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Caja del calendario: leyenda + vista con scroll interno */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-k-linea-f bg-card">
        <Leyenda vista={vista} services={services} equipo={equipo} />
        {vista === "cronograma" && (
          <Cronograma dia={anchor} citas={citasDia} equipo={equipo} ahora={ahora} carta={carta} services={services} onCita={setSeleccionada} onHueco={abrirHueco} />
        )}
        {vista === "dia" && (
          <VistaDia dia={anchor} citas={citasDia} equipo={equipo} ahora={ahora} carta={carta} services={services} soloUno={soloUno} onCita={setSeleccionada} onHueco={abrirHueco} />
        )}
        {vista === "semana" && (
          <VistaSemana
            anchor={anchor}
            appointments={appointments}
            equipo={equipo}
            ahora={ahora}
            carta={carta}
            services={services}
            onCita={setSeleccionada}
            onDia={(d) => {
              setAnchor(d);
              setVista("cronograma");
            }}
          />
        )}
        {vista === "mes" && (
          <VistaMes
            anchor={anchor}
            appointments={appointments}
            equipo={equipo}
            ahora={ahora}
            onDia={(d) => {
              setAnchor(d);
              setVista("cronograma");
            }}
          />
        )}
      </div>

      {vista === "cronograma" && numCitas > 0 && (
        <PieCronograma dia={anchor} citas={citasDia} equipo={equipo} huecos={huecosDia} onHueco={abrirHueco} />
      )}
      <p className="mt-2.5 flex-none text-[12.5px] text-muted-foreground">
        Pulsa una cita para ver su detalle o un hueco «Libre» para crear una cita a esa hora. Borde discontinuo = por confirmar · rayado = pausa · ✓ = vino.
      </p>

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

function Leyenda({ vista, services, equipo }: { vista: Vista; services: Service[]; equipo: Employee[] }) {
  const activos = services.filter((s) => s.active !== false).slice(0, 6);
  const muestra = "inline-block size-3.5 rounded-[4px] border-l-[3px]";
  if (vista === "mes") {
    return (
      <div className="flex flex-none flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-k-linea-f bg-card px-4 py-2.5 text-[12.5px] font-semibold text-k-tinta2">
        <b className="text-k-tinta">Barras = ocupación de cada profesional</b>
        {equipo.map((e, i) => (
          <span key={e.id} className="flex items-center gap-1.5">
            <i className="inline-block size-3.5 rounded-[4px]" style={{ background: barraPro(i) }} />
            {e.name}
          </span>
        ))}
        <span className="hidden md:ml-auto md:inline">El número de la derecha son sus citas · pulsa un día para abrirlo</span>
      </div>
    );
  }
  return (
    <div className="flex flex-none flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-k-linea-f bg-card px-4 py-2.5 text-[12.5px] font-semibold text-k-tinta2">
      <b className="text-k-tinta">Servicio:</b>
      {activos.map((s) => {
        const n = indiceColorServicio(s.id, services);
        return (
          <span key={s.id} className="flex items-center gap-1.5">
            <i className={muestra} style={{ background: `var(--serv-${n})`, borderLeftColor: `var(--serv-${n}-borde)` }} />
            {s.name.split(/ y | \/ /)[0]}
          </span>
        );
      })}
      {vista === "semana" ? (
        <span className="md:ml-auto">
          Cada día tiene {equipo.length === 1 ? "un carril" : `${equipo.length} carriles`}: {equipo.map((e) => e.name).join(" · ")}
        </span>
      ) : (
        <>
          <span className="flex items-center gap-1.5 md:ml-auto">
            <i className="inline-block size-3.5 rounded-[4px] border-2 border-dashed border-k-tinta2 bg-card" />
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
      )}
    </div>
  );
}

const RAYADO = "repeating-linear-gradient(135deg,#F3F5F8 0 7px,#FAFBFC 7px 14px)";

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
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${a.clientName} · ${nombreServicio} · ${hora(a.start)}–${minutosAHora(ini + a.duration)}`}
      className={cn(
        "absolute flex flex-col overflow-hidden text-left leading-[1.28] text-k-tinta hover:shadow-[0_2px_8px_rgba(31,38,51,0.12)] hover:brightness-[0.97] [&>*]:shrink-0",
        variante === "semana" ? "rounded-[9px] border-l-[3px] px-1.5 py-[5px] text-[11.5px]" : "rounded-xl border-l-4 px-2.5 py-2 text-[13px]",
        variante !== "crono" && corta && "py-[3px]",
        variante === "crono" && corta && "px-[7px] py-[7px]",
        pendiente && "border-2 border-dashed border-k-tinta2 border-l-4",
        noVino && "opacity-55 line-through",
      )}
      style={{
        ...style,
        background: pendiente ? "var(--color-card)" : `var(--serv-${n})`,
        borderLeftColor: `var(--serv-${n}-borde)`,
        borderLeftStyle: "solid",
      }}
    >
      {vino && variante !== "semana" && (
        <span className="absolute top-[7px] right-2 rounded-md bg-white/80 px-1.5 text-[10.5px] font-bold text-[color:var(--k-vino)]">✓ vino</span>
      )}
      <b
        className={cn(
          "line-clamp-2 font-extrabold",
          variante === "semana" ? "text-[11.5px] leading-[1.2]" : corta && variante === "crono" ? "line-clamp-3 text-xs" : "text-[13px]",
          vino && variante !== "semana" && "pr-12",
        )}
      >
        {a.clientName || "Sin nombre"}
      </b>
      <span className={cn("font-bold text-k-tinta2 tabular-nums", variante === "semana" ? "text-[10.5px]" : corta ? "text-[11px]" : "text-xs")}>{rango}</span>
      {variante !== "semana" && (
        <span className={cn("line-clamp-2 text-k-tinta2", corta ? "text-[11px]" : "text-xs")}>
          {corta ? nombreServicio.split(/ y | \/ | \+ /)[0] : nombreServicio}
          {pendiente ? " · por confirmar" : ""}
        </span>
      )}
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

function BloqueHueco({ style, tramo, dosLineas, onClick }: { style: CSSProperties; tramo: Tramo; dosLineas: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Crear una cita a las ${minutosAHora(tramo.ini)}`}
      className="group absolute grid place-items-center rounded-xl border-[1.5px] border-dashed border-k-linea-f text-center text-xs font-bold text-k-gris hover:border-k-libre-b hover:bg-k-libre hover:text-k-libre-t"
      style={style}
    >
      <em className={cn("not-italic", !dosLineas && "opacity-0 group-hover:opacity-100")}>
        + Libre{dosLineas ? <br /> : " · "}
        <span className="font-semibold tabular-nums">
          {minutosAHora(tramo.ini)}–{minutosAHora(tramo.fin)}
        </span>
      </em>
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
  onCita,
  onHueco,
}: {
  dia: Date;
  citas: Appointment[];
  equipo: Employee[];
  ahora: Date;
  carta: Record<string, Service>;
  services: Service[];
  onCita: (a: Appointment) => void;
  onHueco: AbrirHueco;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const derecha = useRef<HTMLDivElement>(null);
  const h = horizonteDelDia(equipo, dia.getDay());
  const esHoy = mismoDia(dia, ahora);
  const minAhora = minutosDe(ahora);

  // Hoy, si la rejilla no cabe a lo ancho, arranca centrada en «ahora».
  useLayoutEffect(() => {
    const el = scroll.current;
    const der = derecha.current;
    if (!el || !der || !h || !esHoy) return;
    if (el.scrollWidth > el.clientWidth + 10) {
      el.scrollLeft = Math.max(0, (porcentaje(minAhora, h) / 100) * der.offsetWidth - 80);
    }
    // Solo al cambiar de día: no perseguir la línea de «ahora» cada minuto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia.getTime()]);

  if (!h) return <VacioDia dia={dia} />;
  const horas = (h.fin - h.ini) / 60;
  const filas = `44px repeat(${equipo.length}, minmax(110px, 1fr))`;
  const pos = (ini: number, dur: number): CSSProperties => ({
    left: `calc(${porcentaje(ini, h)}% + 2px)`,
    width: `calc(${(dur / (h.fin - h.ini)) * 100}% - 4px)`,
    top: 10,
    bottom: 10,
  });
  const fondo: CSSProperties = {
    backgroundImage: "linear-gradient(90deg,var(--k-linea) 1px,transparent 1px),linear-gradient(90deg,var(--k-linea-media) 1px,transparent 1px)",
    backgroundSize: `calc(100% / ${horas}) 100%, calc(100% / ${horas * 2}) 100%`,
  };
  const desde = esHoy ? minAhora : undefined;

  return (
    <div ref={scroll} className="relative min-h-0 flex-1 overflow-auto">
      <div className="grid h-full min-h-[376px] min-w-[1000px] grid-cols-[92px_1fr] md:min-w-[1100px] md:grid-cols-[168px_1fr]">
        <div className="sticky left-0 z-[8] grid border-r border-k-linea-f bg-card" style={{ gridTemplateRows: filas }}>
          <div className="flex items-center border-b border-k-linea-f bg-k-cab pl-4 text-[11px] font-bold tracking-[0.06em] text-k-tinta2 uppercase">Profesional</div>
          {equipo.map((e, i) => {
            const mias = citas.filter((a) => a.employeeId === e.id && a.status !== "blocked");
            return (
              <div key={e.id} className="flex items-center gap-1.5 border-b-2 border-k-linea-f px-2 last:border-b-0 md:gap-3 md:px-4">
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
                style={i === 0 ? { left: 8 } : { left: `${(i / horas) * 100}%`, transform: "translateX(-50%)" }}
              >
                {h.ini / 60 + i}:00
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
              <div key={e.id} className="relative border-b-2 border-k-linea-f last:border-b-0" style={fondo}>
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

/** Alto de una hora para que la rejilla llene la caja (64 px como mínimo). */
function useAltoHora(horas: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(72);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setPx(Math.max(64, Math.floor((el.clientHeight - 56 - 6) / Math.max(1, horas))));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [horas]);
  return { ref, px };
}

function ColumnaHoras({ h, px }: { h: Tramo; px: number }) {
  const horas = (h.fin - h.ini) / 60;
  return (
    <div className="relative border-r border-k-linea-f bg-card" style={{ height: horas * px }}>
      {Array.from({ length: horas }, (_, i) => (
        <span key={i} className="absolute right-2 text-xs font-bold text-k-tinta2 tabular-nums" style={{ top: i * px, transform: i === 0 ? "translateY(2px)" : "translateY(-50%)" }}>
          {h.ini / 60 + i}:00
        </span>
      ))}
    </div>
  );
}

function LineaAhora({ h, px, ahora }: { h: Tramo; px: number; ahora: Date }) {
  const m = minutosDe(ahora);
  if (m < h.ini || m > h.fin) return null;
  return <div className="pointer-events-none absolute right-0 left-0 z-[5] h-0.5 bg-k-ahora" style={{ top: ((m - h.ini) / 60) * px }} aria-hidden="true" />;
}

function useScrollAAhora(ref: React.RefObject<HTMLDivElement | null>, activo: boolean, y: number, clave: unknown) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !activo) return;
    if (el.scrollHeight > el.clientHeight + 10) el.scrollTop = Math.max(0, y - 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, activo]);
}

function VistaDia({
  dia,
  citas,
  equipo,
  ahora,
  carta,
  services,
  soloUno,
  onCita,
  onHueco,
}: {
  dia: Date;
  citas: Appointment[];
  equipo: Employee[];
  ahora: Date;
  carta: Record<string, Service>;
  services: Service[];
  soloUno: boolean;
  onCita: (a: Appointment) => void;
  onHueco: AbrirHueco;
}) {
  const h = horizonteDelDia(equipo, dia.getDay());
  const horas = h ? (h.fin - h.ini) / 60 : 10;
  const { ref, px } = useAltoHora(horas);
  const esHoy = mismoDia(dia, ahora);
  useScrollAAhora(ref, esHoy && !!h, h ? ((minutosDe(ahora) - h.ini) / 60) * px : 0, dia.getTime());
  if (!h) return <VacioDia dia={dia} />;
  const y = (m: number) => ((m - h.ini) / 60) * px;
  const pos = (ini: number, dur: number): CSSProperties => ({ top: y(ini) + 2, height: (dur / 60) * px - 4, left: 4, right: 4 });
  const desde = esHoy ? minutosDe(ahora) : undefined;
  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-auto">
      <div className="grid" style={{ gridTemplateColumns: `60px repeat(${equipo.length}, minmax(220px, 1fr))` }}>
        <div className="sticky top-0 z-[6] min-h-14 border-b border-k-linea-f bg-k-cab" />
        {equipo.map((e, i) => {
          const mias = citas.filter((a) => a.employeeId === e.id && a.status !== "blocked");
          return (
            <div key={e.id} className="sticky top-0 z-[6] flex min-h-14 items-center gap-2 border-b border-k-linea-f bg-k-cab px-2.5 font-bold text-k-tinta">
              {!soloUno && <AvatarPro e={e} i={i} size={32} />}
              <div className="leading-tight">
                <b>{e.name}</b>
                <small className="block font-semibold text-muted-foreground tabular-nums">
                  {mias.length} citas · {ocupacionDe(citas, e, dia.getDay())} %
                </small>
              </div>
            </div>
          );
        })}
        <ColumnaHoras h={h} px={px} />
        {equipo.map((e) => {
          const carriles = carrilesSolapados(citas.filter((a) => a.employeeId === e.id));
          const posCita = (a: Appointment): CSSProperties => {
            const { carril, total } = carriles.get(a.id) ?? { carril: 0, total: 1 };
            const base = pos(minutosDe(a.start), a.duration);
            if (total === 1) return base;
            return { ...base, right: "auto", left: `calc(4px + (100% - 8px) * ${carril / total})`, width: `calc((100% - 8px) / ${total} - 2px)` };
          };
          return (
          <div
            key={e.id}
            className="relative border-r border-k-linea-f last:border-r-0"
            style={{ height: horas * px, backgroundImage: "linear-gradient(var(--k-linea) 1px,transparent 1px)", backgroundSize: `100% ${px}px` }}
          >
            {pausasDe(e, dia.getDay()).map((p) => (
              <BloquePausa key={`p${p.ini}`} style={pos(p.ini, p.fin - p.ini)} />
            ))}
            {huecosDe(citas, e, dia.getDay(), { desde }).map((t) => (
              <BloqueHueco key={`h${t.ini}`} tramo={t} dosLineas={false} style={pos(t.ini, t.fin - t.ini)} onClick={() => onHueco(e.id, t.ini, dia)} />
            ))}
            {citas
              .filter((a) => a.employeeId === e.id)
              .map((a) =>
                a.status === "blocked" ? (
                  <BloquePausa key={a.id} texto={a.note || "Bloqueado"} style={posCita(a)} />
                ) : (
                  <BloqueCita key={a.id} a={a} carta={carta} services={services} variante="dia" style={posCita(a)} onClick={() => onCita(a)} />
                ),
              )}
            {esHoy && <LineaAhora h={h} px={px} ahora={ahora} />}
          </div>
          );
        })}
      </div>
    </div>
  );
}

function VistaSemana({
  anchor,
  appointments,
  equipo,
  ahora,
  carta,
  services,
  onCita,
  onDia,
}: {
  anchor: Date;
  appointments: Appointment[];
  equipo: Employee[];
  ahora: Date;
  carta: Record<string, Service>;
  services: Service[];
  onCita: (a: Appointment) => void;
  onDia: (d: Date) => void;
}) {
  const dias = useMemo(() => diasDeSemana(anchor, equipo), [anchor, equipo]);
  const h = horizonteDeDias(equipo, dias) ?? { ini: 600, fin: 1200 };
  const horas = (h.fin - h.ini) / 60;
  const { ref, px } = useAltoHora(horas);
  const hoyEnSemana = dias.some((d) => mismoDia(d, ahora));
  useScrollAAhora(ref, hoyEnSemana, ((minutosDe(ahora) - h.ini) / 60) * px, lunesDe(anchor).getTime());
  const n = Math.max(1, equipo.length);
  const carril = (e: EmployeeId) => Math.max(0, equipo.findIndex((x) => x.id === e));
  // Líneas: una por hora, y separadores finos entre carriles.
  const separadores = Array.from({ length: n - 1 }, (_, i) => {
    const p = ((i + 1) / n) * 100;
    return `transparent calc(${p}% - .5px), #F0F2F6 calc(${p}% - .5px), #F0F2F6 calc(${p}% + .5px), transparent calc(${p}% + .5px)`;
  }).join(", ");
  const fondo: CSSProperties = {
    height: horas * px,
    backgroundImage: `linear-gradient(var(--k-linea) 1px,transparent 1px)${n > 1 ? `, linear-gradient(90deg, ${separadores})` : ""}`,
    backgroundSize: `100% ${px}px${n > 1 ? ", 100% 100%" : ""}`,
  };
  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-auto">
      <div className="grid" style={{ gridTemplateColumns: `60px repeat(${dias.length}, minmax(170px, 1fr))` }}>
        <div className="sticky top-0 z-[6] min-h-14 border-b border-k-linea-f bg-k-cab" />
        {dias.map((d) => {
          const cuantas = citasDeCalendario(appointments, d).filter((a) => a.status !== "blocked").length;
          return (
            <button
              key={d.getTime()}
              type="button"
              onClick={() => onDia(d)}
              className={cn("sticky top-0 z-[6] flex min-h-14 flex-col items-start justify-center border-b border-k-linea-f px-2.5 text-left text-k-tinta", mismoDia(d, ahora) ? "bg-k-cab-hoy" : "bg-k-cab")}
            >
              <span>
                <b>
                  {DCORTO[d.getDay()]} <span className="tabular-nums">{d.getDate()}</span>
                </b>{" "}
                <small className="font-semibold text-muted-foreground tabular-nums">· {cuantas} {cuantas === 1 ? "cita" : "citas"}</small>
              </span>
              {n > 1 && (
                <span className="flex w-full text-[10.5px] font-bold text-k-tinta2">
                  {equipo.map((e) => (
                    <span key={e.id} className="flex-1 truncate">{e.name}</span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
        <ColumnaHoras h={h} px={px} />
        {dias.map((d) => {
          const citas = citasDeCalendario(appointments, d);
          const solapes = new Map(equipo.flatMap((e) => [...carrilesSolapados(citas.filter((a) => a.employeeId === e.id))]));
          return (
            <div key={d.getTime()} className="relative border-r border-k-linea-f last:border-r-0" style={fondo}>
              {citas.map((a) => {
                const ini = minutosDe(a.start);
                const c = carril(a.employeeId);
                const { carril: sub, total } = solapes.get(a.id) ?? { carril: 0, total: 1 };
                const ancho = 100 / n / total;
                const style: CSSProperties = {
                  top: ((ini - h.ini) / 60) * px + 2,
                  height: (a.duration / 60) * px - 4,
                  left: `calc(${(c / n) * 100 + sub * ancho}% + 2px)`,
                  width: `calc(${ancho}% - 4px)`,
                };
                return a.status === "blocked" ? (
                  <BloquePausa key={a.id} texto="" style={style} />
                ) : (
                  <BloqueCita key={a.id} a={a} carta={carta} services={services} variante="semana" style={style} onClick={() => onCita(a)} />
                );
              })}
              {mismoDia(d, ahora) && <LineaAhora h={h} px={px} ahora={ahora} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Mes ---------- */

function VistaMes({ anchor, appointments, equipo, ahora, onDia }: { anchor: Date; appointments: Appointment[]; equipo: Employee[]; ahora: Date; onDia: (d: Date) => void }) {
  const celdas = useMemo(() => celdasDelMes(anchor), [anchor]);
  const filas = celdas.length / 7;
  return (
    <div className="relative min-h-0 flex-1 overflow-auto">
      <div className="grid h-full min-w-[700px] grid-cols-7" style={{ gridTemplateRows: `auto repeat(${filas}, minmax(88px, 1fr))` }}>
        {DSEM.map((d) => (
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
                fuera ? "bg-[#FAFBFC] text-[#9AA2AF]" : "hover:bg-k-cab",
                hoy && "shadow-[inset_0_0_0_2px_var(--k-ahora)]",
              )}
            >
              <span className="flex items-center justify-between">
                <span className={cn("grid size-[26px] place-items-center rounded-full text-[13px] font-extrabold tabular-nums", hoy && "bg-k-ahora text-white")}>{d.getDate()}</span>
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
                        <i className="block h-[7px] flex-1 overflow-hidden rounded-full bg-[#EEF1F5]">
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
