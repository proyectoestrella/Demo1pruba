import type { Appointment, Employee } from "./mock/types";
import { franjasProfesional, huecosDeProfesionales, trabajaEn } from "./horario-equipo";

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
    return trabajaEn(e, weekday, hour * 60 + 30);
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

/* ------------------------------------------------------------------------
 * Franjas prioritarias del dueño (clave "y" del enlace de demo — ver
 * demo-profile.ts). Cardedal quiere poder marcar, por ejemplo, "9:00-11:00"
 * como el hueco que se enseña primero en el paso 3 ("te atendemos antes y
 * sin esperar"), con el resto de horas siempre accesibles detrás de un "Ver
 * todas las horas" — nunca ocultas del todo, para no perder la reserva.
 * ---------------------------------------------------------------------- */

export interface PriorityRange {
  startMin: number;
  endMin: number;
}

/** Como máximo 3 franjas: más que eso deja de ser "prioridad" y vuelve a ser "todo el horario". */
export const MAX_PRIORITY_RANGES = 3;

const PRIORITY_RANGE_RE = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "09:00-11:00" → minutos desde medianoche. `null` si el formato es inválido o el rango está al revés/vacío. */
export function parsePriorityRange(raw: string): PriorityRange | null {
  const m = PRIORITY_RANGE_RE.exec(raw.trim());
  if (!m) return null;
  const startMin = Number(m[1]) * 60 + Number(m[2]);
  const endMin = Number(m[3]) * 60 + Number(m[4]);
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

/** Inverso de `parsePriorityRange`, para volver a dejarlo en forma "HH:mm-HH:mm" tras validar. */
export function formatPriorityRange(r: PriorityRange): string {
  const fmt = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
  return `${fmt(r.startMin)}-${fmt(r.endMin)}`;
}

/** ¿Cae la hora "HH:mm" dentro de alguna de las franjas prioritarias del dueño? */
export function isPriorityTime(time: string, ranges: string[] | undefined): boolean {
  if (!ranges?.length) return false;
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
  const minutes = h * 60 + m;
  return ranges.some((raw) => {
    const r = parsePriorityRange(raw);
    return r ? minutes >= r.startMin && minutes < r.endMin : false;
  });
}

/* ------------------------------------------------------------------------
 * "Repetir mi última cita" (patrón Booksy): hace falta saber, sin que el
 * cliente pase por los pasos 1-3, cuál es el próximo hueco libre para el
 * mismo servicio y profesional que la última vez. Es la misma cuenta que ya
 * hace `DateTimeStep` día a día dentro del componente — aquí en forma pura
 * para poder llamarla antes de montar el wizard y para poder probarla.
 * ---------------------------------------------------------------------- */

export interface NextSlot {
  dateKey: string; // "2026-09-25"
  time: string; // "HH:mm"
}

/**
 * Primer hueco libre, a partir de `fromDate` (hoy si no se indica), para un
 * profesional concreto o "any" (cualquiera del equipo). Recorre como mucho
 * `maxDays` días; `undefined` si no encuentra nada en ese horizonte (agenda
 * llena o el profesional/franja ya no existen).
 */
export function findNextAvailableSlot(
  employees: Employee[],
  appointments: Appointment[],
  durationMin: number,
  employeeChoice: string | "any",
  opts: {
    smartSpread?: boolean;
    lastSlotBufferMin?: number;
    fromDate?: Date;
    maxDays?: number;
  } = {},
): NextSlot | undefined {
  const relevantEmployees =
    employeeChoice === "any" ? employees : employees.filter((e) => e.id === employeeChoice);
  if (relevantEmployees.length === 0) return undefined;

  const lastSlotBufferMin = opts.lastSlotBufferMin ?? 0;
  const maxDays = opts.maxDays ?? 30;
  const start = opts.fromDate ? new Date(opts.fromDate) : new Date();
  start.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const date = new Date(start);
    date.setDate(date.getDate() + dayOffset);
    const weekday = date.getDay();
    const dateKey = toDateKey(date);

    const opens = relevantEmployees.flatMap((e) => franjasProfesional(e, weekday));
    if (opens.length === 0) continue;

    // Cierre "de verdad": el del salón (todo el equipo), no solo el del
    // profesional elegido — igual que en DateTimeStep.
    const salonOpens = employees.flatMap((e) => franjasProfesional(e, weekday));
    const salonCloseMin =
      salonOpens.length > 0 ? Math.max(...salonOpens.map((o) => o.end)) : undefined;
    const closeMinOffered =
      salonCloseMin !== undefined ? offeredCloseMin(salonCloseMin, lastSlotBufferMin) : undefined;

    for (const minutesOfDay of huecosDeProfesionales(relevantEmployees, weekday, durationMin)) {
        if (closeMinOffered !== undefined && minutesOfDay >= closeMinOffered) continue;
        const h = Math.floor(minutesOfDay / 60);
        const m = minutesOfDay % 60;
        const timeStr = `${pad2(h)}:${pad2(m)}`;
        const iso = new Date(`${dateKey}T${timeStr}:00`).toISOString();
        const free = relevantEmployees.some(
          (e) => !isSlotTakenLocal(appointments, e.id, iso, durationMin),
        );
        if (free) return { dateKey, time: timeStr };
    }
  }
  return undefined;
}

/**
 * Copia local de `isSlotTaken` (lib/store.ts): mismas reglas — una cita
 * "cancelled" o "no-show" no ocupa hueco — pero sin importar la store, para
 * que este módulo se pueda probar con `bun test` sin levantar zustand.
 */
function isSlotTakenLocal(
  appointments: Appointment[],
  employeeId: string,
  startISO: string,
  durationMin: number,
): boolean {
  const start = +new Date(startISO);
  const end = start + durationMin * 60_000;
  return appointments.some((a) => {
    if (a.employeeId !== employeeId) return false;
    if (a.status === "cancelled" || a.status === "no-show") return false;
    const aStart = +new Date(a.start);
    const aEnd = aStart + a.duration * 60_000;
    return aStart < end && aEnd > start;
  });
}

/** Las barras hora a hora de "Cómo va el día" (panel Hoy), en el rango horario en que trabaja alguien del equipo. */
export function dayOccupancyBars(
  appointments: Appointment[],
  dateKey: string,
  employees: Employee[],
  bufferMin = 0,
): HourBar[] {
  const weekday = new Date(`${dateKey}T00:00`).getDay();
  const opens = employees.flatMap((e) => franjasProfesional(e, weekday));
  if (opens.length === 0) return [];
  const openMin = Math.min(...opens.map((o) => o.start));
  const closeMin = Math.max(...opens.map((o) => o.end));
  const closeMinOffered = offeredCloseMin(closeMin, bufferMin);
  const lastHours = lastOfferedHours(openMin, closeMinOffered);

  const out: HourBar[] = [];
  for (let h = Math.floor(openMin / 60); h < Math.ceil(closeMin / 60); h++) {
    const occupancyPct = hourOccupancyPct(appointments, dateKey, h, employees);
    out.push({ hour: h, occupancyPct, busy: isBusyHour(h, occupancyPct, lastHours) });
  }
  return out;
}
