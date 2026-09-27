/**
 * Lote 17: de una fila de `appointments` a lo que se lleva a los calendarios
 * externos conectados (Google / Apple), para los caminos del panel que NO
 * pasan por `syncAppointment`: el parche por campos (`syncAppointmentPatch`:
 * confirmar, mover, cambiar de profesional, cancelar) y el borrado
 * (`deleteAppointment`). Hasta ahora solo la cita NUEVA llegaba a Google; lo
 * que se hacía después con ella en el panel se quedaba en siShow.
 *
 * Mismo criterio que `syncAppointment`: la clave del mapeo es el `local_id`,
 * «cancelled» borra el evento y cualquier otro estado lo crea o actualiza.
 */
import type { CitaParaCalendario } from "../calendario-externo/tipos";

/** Columnas que cambian lo que se ve en el calendario externo. Cobros, señal, etc. no. */
export const COLUMNAS_QUE_VE_EL_CALENDARIO: readonly string[] = [
  "start_at",
  "duration_min",
  "employee_id",
  "status",
  "service_id",
  "note",
  "client_name",
];

export function parcheAfectaCalendario(columnas: Record<string, unknown>): boolean {
  return Object.keys(columnas).some((c) => COLUMNAS_QUE_VE_EL_CALENDARIO.includes(c));
}

/** `null` si a la fila le falta algo imprescindible (no se inventa una cita a medias). */
export function citaParaCalendarioDeFila(fila: Record<string, unknown>): CitaParaCalendario | null {
  const id = typeof fila.local_id === "string" && fila.local_id ? fila.local_id : null;
  const employeeId = typeof fila.employee_id === "string" && fila.employee_id ? fila.employee_id : null;
  const inicio = typeof fila.start_at === "string" ? Date.parse(fila.start_at) : NaN;
  const duracion = Number(fila.duration_min);
  if (!id || !employeeId || !Number.isFinite(inicio) || !Number.isFinite(duracion) || duracion <= 0) return null;
  const servicios = typeof fila.service_id === "string" ? fila.service_id.split(",").filter(Boolean) : [];
  return {
    id,
    clientName: (typeof fila.client_name === "string" && fila.client_name) || "Cliente",
    service: servicios.join(" + ") || "Cita",
    employeeId,
    start: new Date(inicio).toISOString(),
    duration: duracion,
    status: typeof fila.status === "string" ? fila.status : "confirmed",
    note: typeof fila.note === "string" ? fila.note : null,
  };
}

export function accionCalendarioDe(cita: CitaParaCalendario): "upsert" | "borrar" {
  return cita.status === "cancelled" ? "borrar" : "upsert";
}
