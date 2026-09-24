import type { Appointment } from "./mock/types";
import { ultimoColor } from "./colores";

export function fechaLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function vistaHoja(search: Record<string, unknown>): "hoy" | "manana" {
  return search.dia === "manana" ? "manana" : "hoy";
}

export function recordatoriosPendientesManana(citas: Appointment[], hoy: Date): number {
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);
  return hojaDelDia(citas, fechaLocal(manana)).filter(({ cita }) => !cita.reminderSentAt).length;
}

/** Visitas del día ordenadas por profesional y hora, con su última fórmula anterior. */
export function hojaDelDia(citas: Appointment[], fecha: string) {
  return citas
    .filter((a) => fechaLocal(new Date(a.start)) === fecha && a.status !== "cancelled" && a.status !== "blocked")
    .sort((a, b) => a.employeeId.localeCompare(b.employeeId) || +new Date(a.start) - +new Date(b.start))
    .map((cita) => ({ cita, ultimoColor: ultimoColor(citas, cita.clientId, cita.start) }));
}
