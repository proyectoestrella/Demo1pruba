/**
 * Horario semanal del salón.
 *
 * Siete cadenas, de lunes a domingo, en el formato que usa Google en su ficha
 * y que cualquiera entiende de un vistazo: "10:00–13:30, 17:00–20:00" o
 * "Cerrado". Se eligió texto y no estructura por dos razones: es lo que se
 * edita a mano en Ajustes sin necesitar un formulario de franjas, y ocupa poco
 * dentro del enlace de la demo.
 *
 * El modelo anterior solo admitía "lunes a viernes / sábado / domingo" con una
 * única franja, y la mayoría de peluquerías del rutero parten la jornada.
 */

export const DAY_LABELS_ES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export const CLOSED = "Cerrado";

/** Horario del salón de ejemplo: partido entre semana, mañana el sábado. */
export const DEFAULT_OPENING_HOURS: string[] = [
  "10:00–14:00, 16:00–20:00",
  "10:00–14:00, 16:00–20:00",
  "10:00–14:00, 16:00–20:00",
  "10:00–14:00, 16:00–20:00",
  "10:00–14:00, 16:00–20:00",
  "10:00–14:00",
  CLOSED,
];

export interface Range {
  /** Minutos desde medianoche. */
  start: number;
  end: number;
}

/** "10:00–13:30, 17:00–20:00" → franjas en minutos. Cualquier cosa rara → sin franjas. */
export function parseRanges(day: string | undefined): Range[] {
  if (!day) return [];
  const out: Range[] = [];
  for (const chunk of day.split(",")) {
    // Google usa guion largo (–); a mano se escribe guion corto o raya.
    const m = chunk.trim().match(/^(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})$/);
    if (!m) continue;
    const start = Number(m[1]) * 60 + Number(m[2]);
    let end = Number(m[3]) * 60 + Number(m[4]);
    // "22:00–02:00" cierra pasada la medianoche.
    if (end <= start) end += 24 * 60;
    if (start >= 0 && end > start) out.push({ start, end });
  }
  return out;
}

const fmt = (min: number) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Índice de hoy de 0 (lunes) a 6 (domingo). `Date.getDay()` empieza en domingo. */
export function todayIndex(now = new Date()): number {
  return (now.getDay() + 6) % 7;
}

/** Texto de la píldora del hero: "Abierto · cierra a las 20:00", "Cerrado · abre a las 17:00"… */
export function todayOpenInfo(openingHours: string[], now = new Date()): string {
  const ranges = parseRanges(openingHours[todayIndex(now)]);
  if (ranges.length === 0) return "Cerrado hoy";
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const r of ranges) {
    if (nowMin >= r.start && nowMin < r.end) return `Abierto · cierra a las ${fmt(r.end)}`;
  }
  const next = ranges.find((r) => nowMin < r.start);
  return next ? `Cerrado · abre a las ${fmt(next.start)}` : "Cerrado hoy";
}

export function isOpenNow(openingHours: string[], now = new Date()): boolean {
  return todayOpenInfo(openingHours, now).startsWith("Abierto");
}

/** Las siete filas del cuadro de horario, con etiqueta en español. */
export function weekSchedule(openingHours: string[]) {
  return DAY_LABELS_ES.map((label, i) => ({
    label,
    value: openingHours[i]?.trim() || CLOSED,
  }));
}

/**
 * Google devuelve `weekdayDescriptions` así: "lunes: 10:00–13:30, 17:00–20:00".
 * Se quita el nombre del día, que ya lo pone la tabla, y se normaliza "Cerrado".
 */
export function fromGoogleWeekdayDescriptions(
  descriptions: string[] | undefined,
): string[] | undefined {
  if (!descriptions || descriptions.length !== 7) return undefined;
  const out = descriptions.map((d) => {
    const value = d.replace(/^[^:]+:\s*/, "").trim();
    if (/^(cerrado|closed)$/i.test(value)) return CLOSED;
    // "Abierto las 24 horas" y variantes no son franjas: se dejan como texto.
    return value.replace(/\s*[–—-]\s*/g, "–");
  });
  return out;
}

/** Limpia lo que escribe alguien a mano en Ajustes para que siempre se pueda interpretar. */
export function normalizeDay(input: string): string {
  const v = input.trim();
  if (v === "" || /^(cerrado|closed|-|—)$/i.test(v)) return CLOSED;
  return v.replace(/\s*[–—-]\s*/g, "–").replace(/\s*,\s*/g, ", ");
}
