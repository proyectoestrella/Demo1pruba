import type { Appointment, Employee } from "./mock/types";
import { franjasProfesional } from "./horario-equipo";
import { toDateKey } from "./reparto";

/**
 * Cálculos puros del calendario «Arena» (DESIGN.md): qué horas abarca un día,
 * dónde están las pausas, qué huecos quedan libres, cuánto va ocupada cada
 * profesional y qué días enseñan la semana y el mes. Sin React ni store.
 *
 * Todo se mide en minutos desde medianoche, como las franjas del equipo.
 */

export type Tramo = { ini: number; fin: number };

export function minutosDe(fecha: Date | string): number {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.getHours() * 60 + d.getMinutes();
}

export function mismoDia(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

export function inicioDelDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Citas que se pintan en el calendario de un día: todo menos las canceladas.
 * Los bloqueos (`blocked`) sí se pintan, como pausa, porque ocupan agenda.
 */
/**
 * Las mismas citas que `citasDeCalendario`, agrupadas por día (clave
 * AAAA-MM-DD) y ordenadas, en una sola pasada. La rejilla la calcula una vez
 * por lista de citas: cambiar de semana o hacer scroll no vuelve a recorrer
 * toda la agenda (3.300 citas en la demo) por cada columna.
 */
export function citasPorDia(appts: Appointment[]): Map<string, Appointment[]> {
  const mapa = new Map<string, { t: number; a: Appointment }[]>();
  for (const a of appts) {
    if (a.status === "cancelled") continue;
    const d = new Date(a.start);
    const clave = toDateKey(d);
    const lista = mapa.get(clave);
    const item = { t: +d, a };
    if (lista) lista.push(item);
    else mapa.set(clave, [item]);
  }
  const out = new Map<string, Appointment[]>();
  for (const [k, l] of mapa) out.set(k, l.sort((x, y) => x.t - y.t).map((x) => x.a));
  return out;
}

export function citasDeCalendario(appts: Appointment[], dia: Date): Appointment[] {
  const clave = toDateKey(dia);
  return appts
    .filter((a) => a.status !== "cancelled" && toDateKey(new Date(a.start)) === clave)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
}

/**
 * Horas que enseña el calendario un día: de la primera entrada a la última
 * salida del equipo, redondeadas a la hora. `null` si nadie trabaja.
 */
export function horizonteDelDia(equipo: Employee[], weekday: number): Tramo | null {
  const franjas = equipo.flatMap((e) => franjasProfesional(e, weekday));
  if (franjas.length === 0) return null;
  const ini = Math.min(...franjas.map((f) => f.start));
  const fin = Math.max(...franjas.map((f) => f.end));
  return { ini: Math.floor(ini / 60) * 60, fin: Math.ceil(fin / 60) * 60 };
}

/** El horizonte de varios días juntos (la semana): la unión de todos. */
export function horizonteDeDias(equipo: Employee[], dias: Date[]): Tramo | null {
  const tramos = dias
    .map((d) => horizonteDelDia(equipo, d.getDay()))
    .filter((t): t is Tramo => t !== null);
  if (tramos.length === 0) return null;
  return { ini: Math.min(...tramos.map((t) => t.ini)), fin: Math.max(...tramos.map((t) => t.fin)) };
}

/** Pausas de una profesional: los huecos entre sus franjas (la comida). */
export function pausasDe(e: Employee, weekday: number): Tramo[] {
  const franjas = [...franjasProfesional(e, weekday)].sort((a, b) => a.start - b.start);
  const out: Tramo[] = [];
  for (let i = 1; i < franjas.length; i++) {
    if (franjas[i].start > franjas[i - 1].end) out.push({ ini: franjas[i - 1].end, fin: franjas[i].start });
  }
  return out;
}

/**
 * Huecos libres de al menos `minMin` minutos de una profesional en un día.
 * `desde` (minutos) recorta lo que ya ha pasado: el hueco empieza en el
 * siguiente cuarto de hora y los que ya terminaron no salen.
 */
export function huecosDe(
  citasDelDia: Appointment[],
  e: Employee,
  weekday: number,
  opciones: { desde?: number; minMin?: number } = {},
): Tramo[] {
  const minMin = opciones.minMin ?? 30;
  const desde = opciones.desde === undefined ? undefined : Math.ceil(opciones.desde / 15) * 15;
  const ocupadas = citasDelDia
    .filter((a) => a.employeeId === e.id)
    .map((a) => {
      const ini = minutosDe(a.start);
      return { ini, fin: ini + a.duration };
    })
    .sort((x, y) => x.ini - y.ini);
  const out: Tramo[] = [];
  for (const franja of franjasProfesional(e, weekday)) {
    let cursor = desde === undefined ? franja.start : Math.max(franja.start, desde);
    for (const o of ocupadas) {
      if (o.fin <= cursor || o.ini >= franja.end) continue;
      if (o.ini - cursor >= minMin) out.push({ ini: cursor, fin: o.ini });
      cursor = Math.max(cursor, o.fin);
    }
    if (franja.end - cursor >= minMin) out.push({ ini: cursor, fin: franja.end });
  }
  return out;
}

/** Minutos reservados sobre la jornada de una profesional, en porcentaje (0-100). */
export function ocupacionDe(citasDelDia: Appointment[], e: Employee, weekday: number): number {
  const franjas = franjasProfesional(e, weekday);
  const jornada = franjas.reduce((s, f) => s + (f.end - f.start), 0);
  if (jornada === 0) return 0;
  let reservado = 0;
  for (const a of citasDelDia) {
    if (a.employeeId !== e.id || a.status === "blocked") continue;
    const ini = minutosDe(a.start);
    const fin = ini + a.duration;
    for (const f of franjas) reservado += Math.max(0, Math.min(fin, f.end) - Math.max(ini, f.start));
  }
  return Math.min(100, Math.round((reservado / jornada) * 100));
}

export function lunesDe(d: Date): Date {
  const x = inicioDelDia(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/**
 * Días que enseña la semana: los de lunes a domingo en que trabaja alguien
 * del equipo. Un día cerrado sería una columna vacía (PeluChic cierra los
 * lunes). Si el horario no dice nada, de lunes a sábado.
 */
export function diasDeSemana(anchor: Date, equipo: Employee[]): Date[] {
  const lunes = lunesDe(anchor);
  const todos = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d;
  });
  const abiertos = todos.filter((d) => equipo.some((e) => franjasProfesional(e, d.getDay()).length > 0));
  return abiertos.length > 0 ? abiertos : todos.slice(0, 6);
}

/**
 * Celdas del mes empezando en lunes: cinco o seis semanas, sin una última
 * fila que sea entera del mes siguiente.
 */
export function celdasDelMes(anchor: Date): Date[] {
  const primero = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const inicio = lunesDe(primero);
  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    if (i >= 35 && d.getMonth() !== anchor.getMonth()) break;
    out.push(d);
  }
  return out;
}

/** Posición horizontal (0-100) de un minuto dentro del horizonte. */
export function porcentaje(min: number, h: Tramo): number {
  return ((min - h.ini) / (h.fin - h.ini)) * 100;
}

/** Iniciales para el avatar de la profesional: «María» → «MA». */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/**
 * Reparte en carriles las citas que se pisan (la agenda real las tiene: una
 * cita puesta encima de otra, o una que se alarga). Devuelve, por cita, su
 * carril y cuántos carriles tiene su grupo de solapes, para dividir el alto o
 * el ancho sin que ninguna tape a otra.
 */
export function carrilesSolapados(citas: Appointment[]): Map<string, { carril: number; total: number }> {
  const orden = [...citas].sort((a, b) => +new Date(a.start) - +new Date(b.start) || b.duration - a.duration);
  const out = new Map<string, { carril: number; total: number }>();
  let grupo: { id: string; carril: number }[] = [];
  let finesCarril: number[] = [];
  let finGrupo = -Infinity;
  const cerrar = () => {
    const total = Math.max(1, finesCarril.length);
    for (const g of grupo) out.set(g.id, { carril: g.carril, total });
    grupo = [];
    finesCarril = [];
  };
  for (const a of orden) {
    const ini = +new Date(a.start);
    const fin = ini + a.duration * 60_000;
    if (ini >= finGrupo) {
      cerrar();
      finGrupo = -Infinity;
    }
    let carril = finesCarril.findIndex((f) => f <= ini);
    if (carril === -1) {
      carril = finesCarril.length;
      finesCarril.push(fin);
    } else {
      finesCarril[carril] = fin;
    }
    grupo.push({ id: a.id, carril });
    finGrupo = Math.max(finGrupo, fin);
  }
  cerrar();
  return out;
}
