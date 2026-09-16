import type { AppointmentStatus } from "./mock/types";

/**
 * Estados de una cita, en un solo sitio.
 *
 * Antes había dos listas distintas —`app.appointments.tsx` sin "cancelada" y
 * `AppointmentDetailSheet.tsx` con ella—, así que el mismo desplegable ofrecía
 * opciones diferentes según desde dónde se abriera la cita.
 *
 * Ojo con lo que significa "confirmada": es el estado que lleva el SALÓN, no
 * una confirmación del cliente. Que el cliente haya dicho que viene se guarda
 * aparte, en `Appointment.clientConfirmedAt`.
 */
export const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: "pending", label: "Pendiente de confirmar" },
  { value: "confirmed", label: "Confirmada" },
  { value: "completed", label: "Completada" },
  { value: "no-show", label: "No asistió" },
  { value: "cancelled", label: "Cancelada" },
];

/** `blocked` existe en el tipo pero no es un estado que el usuario elija. */
export const SELECTABLE_STATUSES = STATUS_OPTIONS.map((o) => o.value);
