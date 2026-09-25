import type { Appointment, Employee, Service } from "./mock/types";
import { franjasProfesional } from "./horario-equipo";
import { toDateKey } from "./reparto";

/**
 * Cálculos puros de la pantalla «Hoy» (identidad «Arena»): qué citas son de
 * hoy, cuáles están en curso, cuántos huecos quedan y qué color le toca a
 * cada servicio. Sin React ni store, para que se puedan probar a secas.
 */

/** Citas de un día concreto que cuentan como agenda (ni canceladas ni bloqueos). */
export function citasDelDia(appts: Appointment[], dia: Date): Appointment[] {
  const clave = toDateKey(dia);
  return appts
    .filter(
      (a) =>
        toDateKey(new Date(a.start)) === clave &&
        a.status !== "cancelled" &&
        a.status !== "blocked",
    )
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
}

export function finDe(a: Appointment): number {
  return +new Date(a.start) + a.duration * 60_000;
}

/** Empezada y sin terminar a la hora dada. */
export function enCurso(a: Appointment, ahora: Date): boolean {
  return +new Date(a.start) <= +ahora && finDe(a) > +ahora;
}

/** Ya terminada a la hora dada. */
export function terminada(a: Appointment, ahora: Date): boolean {
  return finDe(a) <= +ahora;
}

/**
 * Huecos libres de al menos `minMin` minutos desde `ahora` hasta el cierre
 * de cada profesional, contando lo que ya hay en la agenda del día.
 */
export function huecosLibresDesde(
  citasHoy: Appointment[],
  equipo: Employee[],
  ahora: Date,
  minMin = 30,
): { total: number; cierre: number | null } {
  const dia = ahora.getDay();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  let total = 0;
  let cierre: number | null = null;
  for (const e of equipo) {
    for (const franja of franjasProfesional(e, dia)) {
      cierre = cierre === null ? franja.end : Math.max(cierre, franja.end);
      const ocupadas = citasHoy
        .filter((a) => a.employeeId === e.id)
        .map((a) => {
          const d = new Date(a.start);
          const ini = d.getHours() * 60 + d.getMinutes();
          return { ini, fin: ini + a.duration };
        })
        .sort((x, y) => x.ini - y.ini);
      let cursor = Math.max(franja.start, minutosAhora);
      for (const o of ocupadas) {
        if (o.fin <= cursor) continue;
        if (o.ini - cursor >= minMin) total += 1;
        cursor = Math.max(cursor, o.fin);
      }
      if (franja.end - cursor >= minMin) total += 1;
    }
  }
  return { total, cierre };
}

export function minutosAHora(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** «45 min», «1 h», «1 h 30». */
export function duracionCorta(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

/** «en 20 min», «en 2 h 20». Vacío si ya ha empezado. */
export function faltaPara(a: Appointment, ahora: Date): string {
  const min = Math.round((+new Date(a.start) - +ahora) / 60_000);
  if (min <= 0) return "";
  return `en ${duracionCorta(min)}`;
}

/** Mismos valores que el desplegable de duración del panel, para elegir con un toque. */
export const DURACIONES_MIN = [15, 30, 40, 45, 60, 75, 90, 120, 150, 180];

/**
 * Cuatro duraciones alrededor de la propuesta: la propuesta y sus vecinas,
 * para que confirmar una solicitud sea un toque y no un desplegable.
 */
export function opcionesDeDuracion(propuesta: number, todas = DURACIONES_MIN): number[] {
  const lista = [...new Set([...todas, propuesta])].filter((n) => n > 0).sort((a, b) => a - b);
  const i = lista.indexOf(propuesta);
  let desde = Math.max(0, i - 1);
  const hasta = Math.min(lista.length, desde + 4);
  desde = Math.max(0, hasta - 4);
  return lista.slice(desde, hasta);
}

/** Límites de la duración escrita a mano («Otra…»): de 5 min a 8 h, en pasos de 5. */
export const DURACION_MINIMA = 5;
export const DURACION_MAXIMA = 480;

/**
 * Lee una duración escrita a mano en «Otra…» y la valida. Acepta minutos
 * («150», «90 min»), horas y minutos («2:30», «2 h 30», «2h30», «1 h 5 min»)
 * y horas solas («2 h»). Devuelve los minutos o el motivo, dicho para ella.
 */
export function minutosPersonalizados(texto: string): { minutos: number } | { error: string } {
  const t = texto.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return { error: "Escribe la duración, por ejemplo 2:30 o 150." };
  let minutos: number | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,3})(?: ?min(?:utos)?\.?)?$/.exec(t))) minutos = Number(m[1]);
  else if ((m = /^(\d{1,2}):(\d{2})$/.exec(t))) minutos = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = /^(\d{1,2}) ?h(?:oras?)?\.?(?: ?y)?(?: ?(\d{1,2})(?: ?min(?:utos)?\.?)?)?$/.exec(t))) minutos = Number(m[1]) * 60 + Number(m[2] ?? 0);
  if (minutos === null) return { error: "No lo entiendo: escribe por ejemplo 2:30, 2 h 30 o 150." };
  if (minutos < DURACION_MINIMA) return { error: "Como mínimo, 5 minutos." };
  if (minutos > DURACION_MAXIMA) return { error: "Como máximo, 8 horas." };
  if (minutos % 5 !== 0) return { error: "En pasos de 5 minutos: por ejemplo 2:30 o 2:35." };
  return { minutos };
}

/** Ajusta a la rejilla de 5 minutos y a los límites (5 min a 8 h). */
export function acotarDuracion(minutos: number): number {
  return Math.min(DURACION_MAXIMA, Math.max(DURACION_MINIMA, Math.round(minutos / 5) * 5));
}

/** Seis pasteles fríos del calendario, uno por servicio, por orden de la carta. */
export const COLORES_SERVICIO = 6;

/**
 * Índice de color (1..6) de un servicio según su posición en la carta. Los
 * servicios que no están en la carta reciben el último color.
 */
export function indiceColorServicio(serviceId: string | undefined, servicios: Service[]): number {
  const i = servicios.findIndex((s) => s.id === serviceId);
  return i < 0 ? COLORES_SERVICIO : (i % COLORES_SERVICIO) + 1;
}

/** Variable CSS del borde (el color «fuerte») del servicio: `var(--serv-3-borde)`. */
export function colorServicio(serviceId: string | undefined, servicios: Service[]): string {
  return `var(--serv-${indiceColorServicio(serviceId, servicios)}-borde)`;
}

/** Saludo según la hora, sin punto: se completa con el nombre. */
export function saludoPara(hora: number): string {
  if (hora < 6) return "Buenas noches";
  if (hora < 13) return "Buenos días";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * La frase bajo el saludo: cómo va el día y quién está ahora en el salón.
 * Ejemplo: «Vais por la mitad del día. Ahora mismo están Adriana con su
 * peinado de novia y Lucía en tratamiento capilar.»
 */
export function fraseDelDia(
  citasHoy: Appointment[],
  ahora: Date,
  nombreServicio: (a: Appointment) => string,
): string {
  if (citasHoy.length === 0) return "Hoy no hay citas en la agenda.";
  const hechas = citasHoy.filter((a) => terminada(a, ahora)).length;
  const ratio = hechas / citasHoy.length;
  const progreso =
    ratio === 0
      ? "Empieza el día."
      : ratio < 0.35
        ? "El día acaba de arrancar."
        : ratio < 0.65
          ? "Vais por la mitad del día."
          : ratio < 1
            ? "Queda la recta final del día."
            : "Día terminado.";
  const ahoraMismo = citasHoy.filter((a) => enCurso(a, ahora));
  if (ahoraMismo.length === 0) return progreso;
  const nombre = (a: Appointment) => (a.clientName || "una clienta").split(/\s+/)[0];
  const partes = ahoraMismo.map((a) => `${nombre(a)} con ${nombreServicio(a).toLowerCase()}`);
  const lista =
    partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
  return `${progreso} Ahora mismo ${ahoraMismo.length === 1 ? "está" : "están"} ${lista}.`;
}
