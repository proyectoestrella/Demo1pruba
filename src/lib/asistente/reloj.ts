/**
 * Día y hora del salón para un instante, con caché por tramos de 15 minutos.
 * `fechaEnZona` usa Intl y cuesta ~0,1 ms: con 3.300 citas por pregunta no
 * cabe en 20 ms. Todo desfase horario real es múltiplo de 15 minutos, así que
 * el tramo entero cae en el mismo día y la hora se deduce sumando minutos.
 */
import { fechaEnZona, horaEnZona } from "../zona-horaria";

const TRAMO = 15 * 60_000;
const DIAS = new Map<string, Map<number, string>>();
const HORAS = new Map<string, Map<number, number>>();

function ms(iso: string | Date): number {
  return typeof iso === "string" ? Date.parse(iso) : iso.getTime();
}

/** «AAAA-MM-DD» del salón. */
export function diaEnZona(iso: string | Date, timeZone: string): string {
  const t = ms(iso);
  const b = Math.floor(t / TRAMO);
  let m = DIAS.get(timeZone);
  if (!m) DIAS.set(timeZone, (m = new Map()));
  let d = m.get(b);
  if (d === undefined) {
    d = fechaEnZona(new Date(b * TRAMO), timeZone);
    if (m.size > 200_000) m.clear();
    m.set(b, d);
  }
  return d;
}

/** Minuto del día en el salón (0–1439). */
export function minutoEnZona(iso: string | Date, timeZone: string): number {
  const t = ms(iso);
  const b = Math.floor(t / TRAMO);
  let m = HORAS.get(timeZone);
  if (!m) HORAS.set(timeZone, (m = new Map()));
  let base = m.get(b);
  if (base === undefined) {
    const [h, mi] = horaEnZona(new Date(b * TRAMO), timeZone).split(":").map(Number);
    base = h * 60 + mi;
    if (m.size > 200_000) m.clear();
    m.set(b, base);
  }
  return base + Math.floor((t - b * TRAMO) / 60_000);
}

/** «9:05», «17:30». */
export function horaCorta(iso: string | Date, timeZone: string): string {
  const m = minutoEnZona(iso, timeZone);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
