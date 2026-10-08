import type { Employee } from "./mock/types";

/**
 * Una lista ausente o vacía es deliberadamente «todos»: los perfiles creados
 * antes de esta función no pierden de golpe a ninguna profesional.
 */
export function profesionalHaceServicios(
  employeeId: string,
  serviceIds: string[],
  serviciosPorProfesional: Record<string, string[]> | undefined,
): boolean {
  const permitidos = serviciosPorProfesional?.[employeeId];
  return !permitidos?.length || serviceIds.every((id) => permitidos.includes(id));
}

/** Las únicas profesionales que pueden realizar TODOS los servicios elegidos. */
export function profesionalesParaServicios(
  employees: Employee[],
  serviceIds: string[],
  serviciosPorProfesional: Record<string, string[]> | undefined,
): Employee[] {
  return employees.filter((e) => profesionalHaceServicios(e.id, serviceIds, serviciosPorProfesional));
}
