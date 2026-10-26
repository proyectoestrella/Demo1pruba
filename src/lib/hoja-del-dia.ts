import type { Appointment } from "./mock/types";
import { ultimoColor } from "./colores";
import { fechaEnZona, ZONA_HORARIA_SALON } from "./zona-horaria";

export function fechaLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type DiaHoja = "hoy" | "manana" | string;

function esFechaIsoValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [year, month, day] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(year, month - 1, day));
  return fecha.getUTCFullYear() === year && fecha.getUTCMonth() === month - 1 && fecha.getUTCDate() === day;
}

export function vistaHoja(search: Record<string, unknown>): DiaHoja {
  if (search.dia === "manana") return "manana";
  if (typeof search.dia === "string" && esFechaIsoValida(search.dia)) return search.dia;
  return "hoy";
}

export function sumarDiasFecha(fecha: string, dias: number): string {
  const [year, month, day] = fecha.split("-").map(Number);
  const siguiente = new Date(Date.UTC(year, month - 1, day + dias));
  return siguiente.toISOString().slice(0, 10);
}

/** Resuelve los accesos rápidos y las fechas elegidas según el reloj del salón. */
export function fechaDeVistaHoja(
  dia: DiaHoja,
  ahora: Date,
  timeZone = ZONA_HORARIA_SALON,
): string {
  const hoy = fechaEnZona(ahora, timeZone);
  if (dia === "manana") return sumarDiasFecha(hoy, 1);
  return dia === "hoy" ? hoy : dia;
}

export function recordatoriosPendientesManana(
  citas: Appointment[],
  hoy: Date,
  timeZone = ZONA_HORARIA_SALON,
): number {
  const manana = fechaDeVistaHoja("manana", hoy, timeZone);
  return hojaDelDia(citas, manana, timeZone).filter(({ cita }) => !cita.reminderSentAt).length;
}

/** Visitas del día ordenadas por profesional y hora, con su última fórmula anterior. */
export function hojaDelDia(citas: Appointment[], fecha: string, timeZone?: string) {
  return citas
    .filter((a) =>
      (timeZone ? fechaEnZona(a.start, timeZone) : fechaLocal(new Date(a.start))) === fecha &&
      a.status !== "cancelled" &&
      a.status !== "blocked"
    )
    .sort((a, b) => a.employeeId.localeCompare(b.employeeId) || +new Date(a.start) - +new Date(b.start))
    .map((cita) => ({ cita, ultimoColor: ultimoColor(citas, cita.clientId, cita.start) }));
}
