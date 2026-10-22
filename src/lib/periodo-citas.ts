import { rangoDePeriodo, type Rango } from "./periodos";
import { ZONA_HORARIA_SALON } from "./zona-horaria";
import type { Appointment } from "./mock/types";

/**
 * Periodo de la pantalla Citas: filtra la lista Y lo que se exporta (22-oct,
 * antes solo cambiaba el archivo y la lista enseñaba otra cosa). Los cortes
 * son días naturales en la zona del salón (Europe/Madrid por defecto), con el
 * rango `[inicio, fin)` de `lib/periodos.ts`: «Últimos 7 días» es hoy y los
 * seis anteriores, enteros, incluidas las citas de más tarde hoy.
 */
export type PeriodoCitasId = "todo" | "hoy" | "7d" | "30d" | "mes" | "mes-anterior";

export const PERIODOS_CITAS: { id: PeriodoCitasId; label: string; archivo: string }[] = [
  { id: "todo", label: "Todas las fechas", archivo: "todas" },
  { id: "hoy", label: "Hoy", archivo: "hoy" },
  { id: "7d", label: "Últimos 7 días", archivo: "ultimos-7-dias" },
  { id: "30d", label: "Últimos 30 días", archivo: "ultimos-30-dias" },
  { id: "mes", label: "Este mes", archivo: "este-mes" },
  { id: "mes-anterior", label: "Mes pasado", archivo: "mes-pasado" },
];

export const PERIODO_CITAS_POR_DEFECTO: PeriodoCitasId = "todo";

const DIA_MS = 86_400_000;

/** El rango del periodo, o `null` para «Todas las fechas» (sin corte). */
export function rangoDeCitas(id: PeriodoCitasId, now: Date = new Date(), timeZone: string = ZONA_HORARIA_SALON): Rango | null {
  if (id === "todo") return null;
  const hoy = rangoDePeriodo("hoy", now, null, timeZone);
  if (id === "hoy") return hoy;
  if (id === "mes") return rangoDePeriodo("mes", now, null, timeZone);
  if (id === "mes-anterior") {
    const este = rangoDePeriodo("mes", now, null, timeZone);
    // Un instante del último día del mes pasado basta para sacar su mes entero.
    const pasado = rangoDePeriodo("mes", new Date(+este.inicio - DIA_MS / 2), null, timeZone);
    return { inicio: pasado.inicio, fin: este.inicio };
  }
  const dias = id === "7d" ? 7 : 30;
  // Mediodía del primer día: así un cambio de hora en medio no corre un día.
  const primerDia = new Date(+hoy.inicio - (dias - 1) * DIA_MS + DIA_MS / 2);
  return { inicio: rangoDePeriodo("hoy", primerDia, null, timeZone).inicio, fin: hoy.fin };
}

export function enRango(a: Pick<Appointment, "start">, rango: Rango | null): boolean {
  if (!rango) return true;
  const t = +new Date(a.start);
  return t >= +rango.inicio && t < +rango.fin;
}

/** Las citas del periodo (canceladas incluidas: la lista las enseña y el filtro de estado decide). */
export function citasDelPeriodo<T extends Pick<Appointment, "start">>(citas: T[], id: PeriodoCitasId, now: Date = new Date(), timeZone: string = ZONA_HORARIA_SALON): T[] {
  const rango = rangoDeCitas(id, now, timeZone);
  return rango ? citas.filter((a) => enRango(a, rango)) : citas;
}
