/**
 * Caja: los pagos reales del salón (lote 11).
 *
 * Mismo principio que la señal (contrato v4.1, cláusula Quinta): siShow
 * NUNCA recibe, guarda ni mueve dinero. Esto es el cuaderno del mostrador en
 * digital — lo que la dueña o su encargada han anotado que ha entrado — para
 * poder cuadrar el día y sacarlo para la gestoría. Nunca es un ticket ni una
 * factura: eso queda fuera de Verifactu a propósito (ver docs/contrato-caja.md §6).
 *
 * Funciones puras: sin red, sin store. El acceso a Supabase vive en
 * `src/lib/api/pagos.functions.ts`. Ver el contrato completo en
 * `docs/contrato-caja.md`.
 */
import type { Appointment, PaymentMethod } from "./mock/types";

/** Mismos tres valores que `PaymentMethod` (cierre de caja de cita): un solo vocabulario para el dinero. */
export type MetodoPago = PaymentMethod;
export const METODOS_PAGO: MetodoPago[] = ["efectivo", "tarjeta", "bizum"];

export type ConceptoPago = "servicio" | "producto" | "propina" | "senal" | "ajuste";
export type OrigenPago = "sishow" | "tpv123";

export interface Pago {
  /** uuid; lo genera quien lo crea (navegador o importador), nunca el servidor. */
  id: string;
  /** local_id de la cita, si el pago viene de una. */
  appointmentId?: string;
  clientId?: string;
  /** Para pintar sin tener que cruzar con `clients` (útil justo tras importar). */
  clientName?: string;
  importeEur: number;
  metodo: MetodoPago;
  concepto: ConceptoPago;
  /** employeeId de quien lo cobró. */
  cobradoPor?: string;
  nota?: string;
  origen: OrigenPago;
  /** Evita duplicar: la señal aplicada y el importador de TPV 123 la usan. */
  refExterna?: string;
  /** ISO: cuándo se cobró (no cuándo se tecleó). */
  fecha: string;
  /** ISO. */
  createdAt: string;
}

function redondeoCentimo(n: number): number {
  return Math.round(n * 100) / 100;
}

export function totalPagos(pagos: Pago[]): number {
  return redondeoCentimo(pagos.reduce((s, p) => s + p.importeEur, 0));
}

export function pagosPorMetodo(pagos: Pago[]): Record<MetodoPago, number> {
  const out: Record<MetodoPago, number> = { efectivo: 0, tarjeta: 0, bizum: 0 };
  for (const p of pagos) out[p.metodo] = redondeoCentimo(out[p.metodo] + p.importeEur);
  return out;
}

/** `Map<appointmentId, importeEur>`: lo que se ha cobrado de verdad por cada cita. */
export function agruparPagosPorCita(pagos: Pago[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of pagos) {
    if (!p.appointmentId) continue;
    out.set(p.appointmentId, redondeoCentimo((out.get(p.appointmentId) ?? 0) + p.importeEur));
  }
  return out;
}

/**
 * Lo cobrado real de una cita, si hay algún pago suyo; si no, el
 * comportamiento de siempre (`fallbackEur`, normalmente `priceEur` o lo que
 * ya calculaba `cobradoHoy`). Así un salón que aún no usa Caja no ve cambiar
 * ni una cifra.
 */
export function cobradoDeCita(appointmentId: string, pagosPorCita: Map<string, number>, fallbackEur: number): number {
  const real = pagosPorCita.get(appointmentId);
  return real !== undefined ? real : fallbackEur;
}

/** Ref. estable del pago que crea la señal APLICADA: idéntica al aplicar, desaplicar y reaplicar. */
export function refSenalAplicada(appointmentId: string): string {
  return `senal:${appointmentId}`;
}

/**
 * El pago (sin `id` ni `createdAt`, los pone quien lo persiste) que
 * corresponde a la señal ya aplicada al cobrar (`depositAppliedEur` en
 * `senal.ts`). `null` si no hay nada que apuntar. Lo llama el SERVIDOR al
 * cobrar, nunca el navegador: siShow no decide esto, solo lo refleja.
 */
export function pagoDeSenalAplicada(
  cita: Pick<Appointment, "id" | "clientId" | "clientName" | "depositAppliedEur" | "depositMethod">,
  ahora: Date = new Date(),
): Omit<Pago, "id" | "createdAt"> | null {
  const importe = cita.depositAppliedEur ?? 0;
  if (importe <= 0) return null;
  const metodo: MetodoPago = cita.depositMethod === "efectivo" || cita.depositMethod === "tarjeta" ? cita.depositMethod : "bizum";
  return {
    appointmentId: cita.id,
    clientId: cita.clientId || undefined,
    clientName: cita.clientName || undefined,
    importeEur: importe,
    metodo,
    concepto: "senal",
    origen: "sishow",
    refExterna: refSenalAplicada(cita.id),
    fecha: ahora.toISOString(),
  };
}

/* ------------------------------------------------------------------------ */
/* Cierre del día (a partir de payments, distinto del cierreDelDia de caja.ts) */
/* ------------------------------------------------------------------------ */

function fechaISODia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function esMismoDiaISO(fechaISO: string, dia: Date): boolean {
  return fechaISO.slice(0, 10) === fechaISODia(dia);
}

export interface EsperadoDelDia {
  fecha: string; // YYYY-MM-DD
  porMetodo: Record<MetodoPago, number>;
  total: number;
}

/** Lo que "debería haber" según lo apuntado en `payments`, para un día. Cálculo puro. */
export function esperadoDelDia(pagos: Pago[], dia: Date = new Date()): EsperadoDelDia {
  const delDia = pagos.filter((p) => esMismoDiaISO(p.fecha, dia));
  return { fecha: fechaISODia(dia), porMetodo: pagosPorMetodo(delDia), total: totalPagos(delDia) };
}

export interface Descuadre {
  efectivoContado: number;
  efectivoEsperado: number;
  descuadre: number;
}

/** `descuadre = contado - esperado`: positivo sobra, negativo falta. */
export function calcularDescuadre(efectivoContado: number, efectivoEsperado: number): Descuadre {
  return { efectivoContado, efectivoEsperado, descuadre: redondeoCentimo(efectivoContado - efectivoEsperado) };
}
