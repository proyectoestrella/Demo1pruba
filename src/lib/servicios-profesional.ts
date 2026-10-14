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

/* ---------- Edición en lote de los servicios de una profesional ---------- */

export interface ResumenCambioServicios {
  añadidos: string[];
  quitados: string[];
  hayCambios: boolean;
  /** «+3 / −1», o «Sin cambios». */
  texto: string;
}

/** Diferencia entre lo que hace ahora y lo que se ha marcado en el borrador. */
export function resumenCambioServicios(inicial: string[], borrador: string[]): ResumenCambioServicios {
  const antes = new Set(inicial);
  const despues = new Set(borrador);
  const añadidos = [...despues].filter((id) => !antes.has(id));
  const quitados = [...antes].filter((id) => !despues.has(id));
  const partes = [añadidos.length ? `+${añadidos.length}` : "", quitados.length ? `−${quitados.length}` : ""].filter(Boolean);
  return { añadidos, quitados, hayCambios: partes.length > 0, texto: partes.length ? partes.join(" / ") : "Sin cambios" };
}

/** Citas futuras (no canceladas) de esa profesional que incluyen alguno de los servicios que se le quitan. */
export function citasFuturasAfectadas(
  quitados: string[],
  citas: { id: string; employeeId: string; start: string; status: string; serviceIds: string[]; bloqueOcupado?: true }[],
  employeeId: string,
  ahora: Date,
): { id: string; serviceIds: string[] }[] {
  if (!quitados.length) return [];
  return citas.filter(
    (c) =>
      c.employeeId === employeeId &&
      !c.bloqueOcupado &&
      c.status !== "cancelled" &&
      Date.parse(c.start) > ahora.getTime() &&
      c.serviceIds.some((s) => quitados.includes(s)),
  );
}

/**
 * El mapa `serviciosPorProfesional` tras guardar: si marca toda la carta se
 * borra la entrada («todos»), para no llenar el perfil con copias de la carta.
 * Devuelve `undefined` si el mapa queda vacío.
 */
export function mapaServiciosTrasGuardar(
  mapa: Record<string, string[]> | undefined,
  employeeId: string,
  elegidos: string[],
  cartaIds: string[],
): Record<string, string[]> | undefined {
  const validos = elegidos.filter((id) => cartaIds.includes(id));
  const siguiente = { ...(mapa ?? {}) };
  if (validos.length === cartaIds.length) delete siguiente[employeeId];
  else siguiente[employeeId] = validos;
  return Object.keys(siguiente).length ? siguiente : undefined;
}
