/**
 * La ventana «Cobrar» de una cita (14b): cuánto queda por cobrar y cómo se
 * reparte en pagos. Puro: lo prueba cobro-panel.test.ts. Los pagos los
 * apunta la store de BACKEND (`registrarPago`); el de la señal aplicada lo
 * crea el servidor al marcar la cita cobrada, así que aquí no se cuenta.
 */
import type { Appointment, PaymentMethod } from "./mock/types";

/** Lo que ya pagó por señal (recibida o ya descontada) y no hay que volver a cobrar. */
export function senalYaPagada(c: Pick<Appointment, "depositAppliedEur" | "depositReceivedEur" | "depositRefundedEur">): number {
  if ((c.depositAppliedEur ?? 0) > 0) return c.depositAppliedEur ?? 0;
  const recibida = (c.depositReceivedEur ?? 0) - (c.depositRefundedEur ?? 0);
  return Math.max(0, recibida);
}

/** El importe que se propone cobrar: precio de carta menos la señal ya pagada, nunca negativo. */
export function importeACobrar(c: Pick<Appointment, "priceEur" | "depositAppliedEur" | "depositReceivedEur" | "depositRefundedEur">): number {
  return Math.max(0, Math.round((c.priceEur - senalYaPagada(c)) * 100) / 100);
}

export interface LineaCobro {
  importeEur: number;
  metodo: PaymentMethod;
}

/** Lee «25», «25,50» o «25.5» como euros; vacío o raro = NaN. */
export function leerEuros(t: string): number {
  const n = Number(t.trim().replace(/\s|€/g, "").replace(",", "."));
  return t.trim() === "" ? Number.NaN : n;
}

export interface PlanCobro {
  lineas: LineaCobro[];
  propina: number;
  total: number;
  /** El método de la línea mayor: es el que queda en la cita (markPaid). */
  metodoPrincipal: PaymentMethod;
  error: string | null;
}

/** Valida y resume lo que hay en la ventana antes de apuntarlo. */
export function planDeCobro(lineas: Array<{ importe: string; metodo: PaymentMethod }>, propinaTexto: string): PlanCobro {
  const ls = lineas.map((l) => ({ importeEur: leerEuros(l.importe), metodo: l.metodo }));
  const propina = propinaTexto.trim() ? leerEuros(propinaTexto) : 0;
  const base = { lineas: ls, propina, total: 0, metodoPrincipal: ls[0]?.metodo ?? "efectivo" };
  if (ls.some((l) => !Number.isFinite(l.importeEur) || l.importeEur < 0)) return { ...base, error: "Escribe cuánto se cobra en cada forma de pago." };
  if (!Number.isFinite(propina) || propina < 0) return { ...base, error: "La propina tiene que ser un importe, por ejemplo 2 o 2,50." };
  const util = ls.filter((l) => l.importeEur > 0);
  if (util.length === 0 && propina === 0) return { ...base, error: "No hay nada que cobrar." };
  if (new Set(util.map((l) => l.metodo)).size < util.length) return { ...base, error: "Las dos formas de pago son iguales: júntalas en una." };
  const total = Math.round((util.reduce((t, l) => t + l.importeEur, 0) + propina) * 100) / 100;
  const principal = [...util].sort((a, b) => b.importeEur - a.importeEur)[0]?.metodo ?? base.metodoPrincipal;
  return { lineas: util, propina, total, metodoPrincipal: principal, error: null };
}
