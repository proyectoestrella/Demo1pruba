/**
 * Solapes en la agenda: una sola regla para la web pública, el panel y el
 * servidor.
 *
 * Contrato con FRONTEND (lote 3, decisión de Tomás):
 *   - La reserva PÚBLICA nunca solapa: el servidor la rechaza con
 *     `RESERVA_HUECO_OCUPADO` (ver reserva-publica.ts).
 *   - El PANEL puede solapar a propósito (un tinte haciendo efecto), pero
 *     con aviso explícito y confirmación. Antes de guardar, la pantalla
 *     llama a `solapaConAgenda(...)`; si devuelve citas, muestra el diálogo
 *     y, si la dueña confirma, pasa `{ permitirSolape: true }` a
 *     `addAppointment` / `updateAppointment`. Sin ese flag, el servidor
 *     rechaza con `RESERVA_SOLAPE_PANEL` y el panel enseña el aviso de «no
 *     guardada» con reintento.
 */
import type { Appointment, EmployeeId } from "./mock/types";

export const ERROR_SOLAPE_PANEL = "RESERVA_SOLAPE_PANEL";

export interface HuecoPedido {
  employeeId: EmployeeId | string;
  /** Instante ISO de inicio. */
  start: string;
  /** Minutos. */
  duration: number;
  /** La propia cita cuando se está moviendo: no se solapa consigo misma. */
  excluirId?: string;
}

/** ¿Cuenta esta cita como ocupación de la agenda? Canceladas y plantones, no. */
export function ocupaAgenda(status: string): boolean {
  return status !== "cancelled" && status !== "no-show";
}

/** Las citas de esa profesional que chocan con el hueco pedido (intervalos semiabiertos). */
export function solapaConAgenda(appointments: Appointment[], hueco: HuecoPedido): Appointment[] {
  const desde = Date.parse(hueco.start);
  const hasta = desde + hueco.duration * 60_000;
  return appointments.filter((a) => {
    if (a.id === hueco.excluirId) return false;
    if (a.employeeId !== hueco.employeeId) return false;
    if (!ocupaAgenda(a.status)) return false;
    const otroInicio = Date.parse(a.start);
    return otroInicio < hasta && otroInicio + a.duration * 60_000 > desde;
  });
}
