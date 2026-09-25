/**
 * La zona horaria del salón, en un solo sitio.
 *
 * El servidor corre en UTC (Vercel) y el navegador de quien reserva en la
 * suya. La agenda de un salón se lee y se escribe SIEMPRE en la del salón:
 * «las 10:00 del lunes» es un hueco de la agenda, no un instante relativo a
 * quien mira. Todo lo que convierta entre «fecha y hora de la agenda» e
 * instantes ISO pasa por aquí.
 */
export const ZONA_HORARIA_SALON = "Europe/Madrid";

/** La zona del perfil, o la de por defecto si no la tiene o no es válida. */
export function zonaDelSalon(perfil: { timeZone?: string } | null | undefined): string {
  const tz = perfil?.timeZone?.trim();
  if (!tz) return ZONA_HORARIA_SALON;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return ZONA_HORARIA_SALON;
  }
}

const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function partes(iso: string | Date, timeZone: string) {
  const lista = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const v = (t: string) => lista.find((p) => p.type === t)?.value ?? "";
  return {
    weekday: DIAS.indexOf(v("weekday")),
    year: Number(v("year")),
    month: Number(v("month")),
    day: Number(v("day")),
    hour: Number(v("hour")) % 24,
    minute: Number(v("minute")),
  };
}

/** Día de la semana (como `Date.getDay()`) y minuto del día de un instante, en la zona del salón. */
export function momentoLocal(iso: string | Date, timeZone = ZONA_HORARIA_SALON): { weekday: number; minuto: number } {
  const p = partes(iso, timeZone);
  return { weekday: p.weekday, minuto: p.hour * 60 + p.minute };
}

/** "YYYY-MM-DD" de un instante visto desde la zona del salón. */
export function fechaEnZona(iso: string | Date, timeZone = ZONA_HORARIA_SALON): string {
  const p = partes(iso, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Desfase de la zona respecto a UTC en minutos, en el instante dado. */
function desfaseMin(instante: number, timeZone: string): number {
  const p = partes(new Date(instante), timeZone);
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((comoUtc - instante) / 60_000);
}

/**
 * «El día D a las HH:mm en la agenda del salón» → instante ISO.
 *
 * Es la inversa de `momentoLocal`/`fechaEnZona`. Se calcula el desfase de la
 * zona en ese instante y se corrige una segunda vez para acertar en los
 * cambios de hora.
 */
export function isoDelSalon(fecha: string, hora: string, timeZone = ZONA_HORARIA_SALON): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const pared = Date.UTC(y, m - 1, d, hh, mm);
  let instante = pared - desfaseMin(pared, timeZone) * 60_000;
  instante = pared - desfaseMin(instante, timeZone) * 60_000;
  return new Date(instante).toISOString();
}

/** "HH:mm" de un instante en la zona del salón. */
export function horaEnZona(iso: string | Date, timeZone = ZONA_HORARIA_SALON): string {
  const p = partes(iso, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
