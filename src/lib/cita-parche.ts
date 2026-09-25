/**
 * Traducción de un `Partial<Appointment>` del panel a las columnas de
 * `appointments`, y la nota «legado» para esquemas sin las columnas del
 * lote 3.
 *
 * Es el corazón del parche por campos: el panel manda SOLO lo que ha
 * tocado, y el servidor escribe SOLO esas columnas. Así dos aparatos que
 * tocan campos distintos de la misma cita no se pisan (cobro en el iPad,
 * hora en el móvil). Si tocan el MISMO campo, gana el último; `updated_at`
 * queda como dato para saber cuándo fue.
 */
import type { Appointment, BookingAnswers } from "./mock/types";
import { serializeBookingNote } from "./booking-answers";
import { serializeDepositNote } from "./deposit-deadline";
import { serializarOrigen } from "./origen-cita";

/** Campo del tipo → columna. Lo que no está aquí no viaja en un parche. */
const COLUMNA: Record<string, string> = {
  clientName: "client_name",
  serviceIds: "service_id",
  employeeId: "employee_id",
  start: "start_at",
  duration: "duration_min",
  priceEur: "price_eur",
  status: "status",
  clientConfirmedAt: "client_confirmed_at",
  note: "note",
  bookingAnswers: "booking_answers",
  origen: "origen",
  paymentMethod: "payment_method",
  paidAt: "paid_at",
  depositRequestedAt: "deposit_requested_at",
  depositDueAt: "deposit_due_at",
  depositPeriodHours: "deposit_period_hours",
  depositReceivedAt: "deposit_received_at",
  depositEur: "deposit_eur",
  colorFormula: "color_formula",
  technicalNotes: "technical_notes",
  reminderSentAt: "reminder_sent_at",
};

/** Solo las claves que el parche trae, traducidas; `undefined` pasa a null (borrar el valor). */
export function columnasDeParche(patch: Partial<Appointment>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(patch)) {
    const columna = COLUMNA[campo];
    if (!columna) continue;
    if (campo === "serviceIds") out[columna] = ((valor as string[] | undefined) ?? []).join(",");
    else if (campo === "origen") out[columna] = valor ?? "sishow";
    else out[columna] = valor ?? null;
  }
  return out;
}

/**
 * La nota con los marcadores de antes, para escribir en un esquema que aún
 * no tiene las columnas del lote 3. Se calcula a partir de la fila (nota
 * limpia + columnas) para no perder nada mientras el DDL no esté aplicado.
 */
export function notaLegado(fila: Record<string, unknown>): string | null {
  const nota = (fila.note as string | null | undefined) ?? undefined;
  const conRespuestas = serializeBookingNote(nota, (fila.booking_answers as BookingAnswers | null | undefined) ?? undefined);
  const conOrigen = serializarOrigen(conRespuestas, fila.origen === "tpv123" ? "tpv123" : undefined);
  const conSenal = serializeDepositNote(conOrigen, {
    depositDueAt: (fila.deposit_due_at as string | null | undefined) ?? undefined,
    depositPeriodHours: (fila.deposit_period_hours as number | null | undefined) ?? undefined,
    depositRequestedAt: (fila.deposit_requested_at as string | null | undefined) ?? undefined,
    depositReceivedAt: (fila.deposit_received_at as string | null | undefined) ?? undefined,
    depositEur: (fila.deposit_eur as number | null | undefined) ?? undefined,
  });
  return conSenal ?? null;
}

/** Columnas del lote 3 que, si faltan en el esquema, se vuelcan a la nota legado. */
export const COLUMNAS_LOTE3_CITA = ["booking_answers", "deposit_due_at", "deposit_period_hours", "origen", "updated_at"];

/** Quita las columnas del lote 3 y deja la nota con marcadores en su lugar. */
export function filaSinLote3(fila: Record<string, unknown>): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...fila, note: notaLegado(fila) };
  for (const c of COLUMNAS_LOTE3_CITA) delete copia[c];
  return copia;
}
