/**
 * Cierre de caja del día.
 *
 * Lo pidieron Alfredo (6TREINTA, que quiere el desglose por barbero) y
 * Cardedal (que lleva 26 años cuadrando el día en papel). Es el cuaderno del
 * mostrador en digital: se marca cada cita como cobrada eligiendo a mano si
 * fue efectivo, Bizum o tarjeta, y al final del día se ve el total y el
 * reparto.
 *
 * NO procesa pagos, no se conecta a ningún banco y no comprueba nada: lo que
 * hay aquí es lo que alguien ha tecleado. Cualquier cifra que salga de aquí
 * es "lo apuntado", no "lo cobrado" — y así se dice en pantalla.
 *
 * Funciones puras (nada de store ni React) para poder probarlas con `bun test`.
 */
import type { Appointment, Employee, PaymentMethod } from "./mock/types";

export const PAYMENT_METHODS: PaymentMethod[] = ["efectivo", "bizum", "tarjeta"];

export interface CierreDeCaja {
  /** Citas del día que ya están marcadas como cobradas. */
  cobradas: Appointment[];
  /** Citas del día que tocaba cobrar y siguen sin marcar. */
  pendientes: Appointment[];
  /** Suma de lo cobrado. */
  total: number;
  /** Cuánto por cada forma de cobro. Las tres salen siempre, aunque sea a 0. */
  porMetodo: Record<PaymentMethod, number>;
  /** Cuánto ha hecho cada profesional, ordenado de más a menos. Incluye los "Sin cita". */
  porProfesional: { employeeId: string; nombre: string; total: number; citas: number }[];
}

function esMismoDia(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * ¿Es esta una cita que tocaba cobrar hoy?
 *
 * Las canceladas no, los plantones tampoco (no hubo servicio) y los bloqueos
 * de agenda menos. Un "Sin cita" sí: entró por la puerta y pagó como
 * cualquiera — por eso cuenta igual en el total y en el reparto por
 * profesional.
 */
export function esCobrable(a: Appointment): boolean {
  return a.status !== "cancelled" && a.status !== "no-show" && a.status !== "blocked";
}

export function cierreDelDia(
  appts: Appointment[],
  employees: Employee[],
  dia: Date = new Date(),
): CierreDeCaja {
  const delDia = appts.filter((a) => esMismoDia(new Date(a.start), dia) && esCobrable(a));
  const cobradas = delDia.filter((a) => !!a.paidAt);
  const pendientes = delDia.filter((a) => !a.paidAt);

  const porMetodo: Record<PaymentMethod, number> = { efectivo: 0, bizum: 0, tarjeta: 0 };
  for (const a of cobradas) {
    const metodo = a.paymentMethod ?? "efectivo";
    porMetodo[metodo] += a.priceEur;
  }

  const acumulado = new Map<string, { total: number; citas: number }>();
  for (const a of cobradas) {
    const actual = acumulado.get(a.employeeId) ?? { total: 0, citas: 0 };
    acumulado.set(a.employeeId, { total: actual.total + a.priceEur, citas: actual.citas + 1 });
  }

  const porProfesional = [...acumulado.entries()]
    .map(([employeeId, v]) => ({
      employeeId,
      // Un profesional borrado del equipo puede seguir teniendo citas viejas:
      // mejor su id que una fila sin nombre.
      nombre: employees.find((e) => e.id === employeeId)?.name ?? employeeId,
      total: v.total,
      citas: v.citas,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    cobradas,
    pendientes,
    total: cobradas.reduce((s, a) => s + a.priceEur, 0),
    porMetodo,
    porProfesional,
  };
}
