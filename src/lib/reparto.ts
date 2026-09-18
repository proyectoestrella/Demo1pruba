import type { Appointment, Employee } from "./mock/types";

/**
 * Reparto de agenda ("smartSpread", clave "k" del enlace de demo — ver
 * demo-profile.ts).
 *
 * Cardedal lleva 26 años de agenda a mano y quiere la app repartiendo sola:
 * todo el mundo pide "por seguridad" las 12:00–14:00 y la última hora, así
 * que el dueño ofrece por teléfono las 10 o las 11 y casi siempre aceptan.
 * "La agenda llena de 9 a 8, no de 12 a 2 con un 20% sin atender."
 *
 * Este módulo hace esa cuenta una sola vez, pura y con tests: cuánto hay
 * ocupado hora a hora de un día, qué huecos hay que marcar "con espera" y qué
 * horas más tranquilas ofrecer en su lugar. Lo usan tanto la reserva pública
 * (etiqueta + tarjeta de sugerencia) como el panel ("Cómo va el día" en Hoy).
 */

/** Franja "por seguridad": la gente la pide aunque esté libre en otro sitio. */
export const SECURITY_WINDOW = { start: 12, end: 14 } as const;

/** A partir de este % de profesionales ocupados, la hora cuenta como "con espera". */
export const HIGH_OCCUPANCY_PCT = 60;

/** Cuántas horas finales del día ofertado se tratan como "con espera" (la gente también las pide "por seguridad"). */
export const LAST_OFFERED_HOURS_COUNT = 2;

/** "2026-09-18" a partir de una fecha, en horario local (no UTC: toISOString desplaza el día). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * % de profesionales agendados durante una hora concreta de un día, sobre
 * los que trabajan esa hora. 0 si nadie trabaja esa hora (no hay franja que
 * pueda estar "con espera" si no hay nadie citando en ella).
 */
export function hourOccupancyPct(
  appointments: Appointment[],
  dateKey: string,
  hour: number,
  employees: Employee[],
): number {
  const weekday = new Date(`${dateKey}T00:00`).getDay();
  const working = employees.filter((e) => {
    const sched = e.schedule[weekday];
    return sched && hour >= sched.start && hour < sched.end;
  });
  if (working.length === 0) return 0;

  const hourStartMs = new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00`).getTime();
  const hourEndMs = hourStartMs + 60 * 60_000;
  const busy = working.filter((e) =>
    appointments.some((a) => {
      if (a.employeeId !== e.id) return false;
      if (a.status === "cancelled" || a.status === "no-show") return false;
      const aStart = +new Date(a.start);
      const aEnd = aStart + a.duration * 60_000;
      return aStart < hourEndMs && aEnd > hourStartMs;
    }),
  ).length;
  return Math.round((busy / working.length) * 100);
}

/** Última hora en punto del día que se sigue ofertando, aplicando el colchón de cierre (`lastSlotBufferMin`). */
export function offeredCloseMin(closeMin: number, bufferMin: number): number {
  return Math.max(0, closeMin - Math.max(0, bufferMin));
}

/** Las horas en punto que caen dentro de las últimas `count` horas ofertadas antes del cierre efectivo. */
export function lastOfferedHours(
  openMin: number,
  closeMinOffered: number,
  count = LAST_OFFERED_HOURS_COUNT,
): number[] {
  if (closeMinOffered <= openMin) return [];
  const lastHour = Math.floor((closeMinOffered - 1) / 60);
  const openHour = Math.floor(openMin / 60);
  const out: number[] = [];
  for (let h = lastHour; h >= openHour && out.length < count; h--) out.push(h);
  return out;
}

/**
 * Regla de "con espera" — documentada aquí porque no es solo ocupación:
 *   - la ocupación de esa hora es ≥ 60%, O
 *   - la hora cae dentro de las 12:00–14:00 ("por seguridad"), O
 *   - es una de las últimas horas que se siguen ofertando ese día.
 * Cualquiera de las tres basta: son señales independientes de que ahí se
 * amontona la gente, aunque ESE día en concreto la agenda esté floja.
 */
export function isBusyHour(hour: number, occupancyPct: number, lastHours: number[]): boolean {
  const inSecurityWindow = hour >= SECURITY_WINDOW.start && hour < SECURITY_WINDOW.end;
  return occupancyPct >= HIGH_OCCUPANCY_PCT || inSecurityWindow || lastHours.includes(hour);
}

export interface SpreadSlot {
  time: string; // "HH:mm"
  available: boolean;
  busy: boolean;
}

/**
 * Ante un hueco "con espera" que el cliente acaba de tocar: los 3 huecos
 * libres y tranquilos más cercanos ANTES de esa hora (en orden cronológico);
 * si no hay ninguno antes, los 3 más cercanos DESPUÉS. Nunca se le quita la
 * opción de quedarse con la hora que tocó — eso lo decide quien llama a esta
 * función, no ella.
 */
export function pickAlternativeSlots(
  slots: SpreadSlot[],
  chosenTime: string,
  max = 3,
): string[] {
  const idx = slots.findIndex((s) => s.time === chosenTime);
  if (idx < 0) return [];

  const before: string[] = [];
  for (let i = idx - 1; i >= 0 && before.length < max; i--) {
    const s = slots[i];
    if (s.available && !s.busy) before.unshift(s.time);
  }
  if (before.length > 0) return before;

  const after: string[] = [];
  for (let i = idx + 1; i < slots.length && after.length < max; i++) {
    const s = slots[i];
    if (s.available && !s.busy) after.push(s.time);
  }
  return after;
}

export interface HourBar {
  hour: number;
  occupancyPct: number;
  busy: boolean;
}

/** Las barras hora a hora de "Cómo va el día" (panel Hoy), en el rango horario en que trabaja alguien del equipo. */
export function dayOccupancyBars(
  appointments: Appointment[],
  dateKey: string,
  employees: Employee[],
  bufferMin = 0,
): HourBar[] {
  const weekday = new Date(`${dateKey}T00:00`).getDay();
  const opens = employees.map((e) => e.schedule[weekday]).filter((s): s is { start: number; end: number } => !!s);
  if (opens.length === 0) return [];
  const openMin = Math.min(...opens.map((o) => o.start)) * 60;
  const closeMin = Math.max(...opens.map((o) => o.end)) * 60;
  const closeMinOffered = offeredCloseMin(closeMin, bufferMin);
  const lastHours = lastOfferedHours(openMin, closeMinOffered);

  const out: HourBar[] = [];
  for (let h = Math.floor(openMin / 60); h < Math.ceil(closeMin / 60); h++) {
    const occupancyPct = hourOccupancyPct(appointments, dateKey, h, employees);
    out.push({ hour: h, occupancyPct, busy: isBusyHour(h, occupancyPct, lastHours) });
  }
  return out;
}
