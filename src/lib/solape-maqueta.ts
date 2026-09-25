import type { Appointment } from "./mock/types";

/**
 * TEMPORAL · maqueta del contrato de BACKEND (auditoría del lote 2, sección
 * E1). La función de verdad es `solapaConAgenda` en `src/lib/solape.ts` de la
 * rama de BACKEND, con esta MISMA firma. Al fusionar, se borra este fichero y
 * los imports pasan a `@/lib/solape`; la pantalla no cambia.
 *
 * Semántica acordada: devuelve las citas de esa profesional que chocan con
 * el tramo pedido. Canceladas y plantones no cuentan; un bloqueo sí. Al
 * mover una cita se pasa su `id` en `excluirId` para no chocar consigo misma.
 */
export function solapaConAgenda(
  appointments: Appointment[],
  pedida: { employeeId: string; start: string; duration: number; excluirId?: string },
): Appointment[] {
  const ini = +new Date(pedida.start);
  const fin = ini + Math.max(1, pedida.duration) * 60_000;
  return appointments.filter((a) => {
    if (a.id === pedida.excluirId) return false;
    if (a.employeeId !== pedida.employeeId) return false;
    if (a.status === "cancelled" || a.status === "no-show") return false;
    const aIni = +new Date(a.start);
    const aFin = aIni + Math.max(1, a.duration) * 60_000;
    return aIni < fin && ini < aFin;
  });
}

/**
 * TEMPORAL · el tercer parámetro de `addAppointment` / `updateAppointment`
 * que añade BACKEND. Hoy la store de esta rama no lo acepta: la capa lo
 * construye y lo deja preparado en el sitio exacto donde hay que pasarlo.
 */
export interface OpcionesGuardadoCita {
  permitirSolape?: boolean;
}
