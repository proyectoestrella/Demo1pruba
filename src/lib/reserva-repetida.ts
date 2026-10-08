import { profesionalHaceServicios } from "./servicios-profesional";

/** Datos mínimos que guarda el atajo «Repetir mi última cita». */
export interface UltimaReserva {
  serviceIds: string[];
  employeeId: string;
}

/**
 * El atajo solo puede reaparecer si la carta y la profesional siguen siendo
 * compatibles. Que la profesional siga existiendo no basta: su especialidad
 * puede haber cambiado desde la última visita.
 */
export function ultimaReservaEsRepetible(
  booking: UltimaReserva | null | undefined,
  serviceMap: Record<string, unknown>,
  employeeIds: Iterable<string>,
  serviciosPorProfesional?: Record<string, string[]>,
): boolean {
  if (!booking || booking.serviceIds.length === 0) return false;
  const empleados = new Set(employeeIds);
  return (
    booking.serviceIds.every((id) => Boolean(serviceMap[id])) &&
    empleados.has(booking.employeeId) &&
    profesionalHaceServicios(booking.employeeId, booking.serviceIds, serviciosPorProfesional)
  );
}
