/**
 * Relleno de las columnas del lote 3 a partir de lo que iba codificado en
 * `appointments.note` y `clients.penalty_note`. Funciones puras: las usa
 * `scripts/migrar-notas.ts` contra Supabase y se prueban aquí sin red. Usan
 * exactamente los mismos parsers que la aplicación, no expresiones regulares
 * propias: si el formato cambia, cambia en un solo sitio.
 */
import { parseBookingNote } from "./booking-answers";
import { parseDepositNote } from "./deposit-deadline";
import { leerOrigen } from "./origen-cita";
import { isManualBlockRecord, previousPenaltyState } from "./no-show";

export interface FilaCitaAMigrar {
  note: string | null;
  booking_answers?: unknown | null;
  deposit_due_at?: string | null;
  deposit_period_hours?: number | null;
  origen?: string | null;
}

/**
 * Parche para una cita, o null si no hay nada codificado en su nota. Solo
 * rellena columnas que estén a null: lo que ya tenga valor manda.
 */
export function parcheCitaDesdeNota(fila: FilaCitaAMigrar): Record<string, unknown> | null {
  if (!fila.note || !fila.note.includes("[siShow:")) return null;
  const senal = parseDepositNote(fila.note);
  const origen = leerOrigen(senal.note);
  const reserva = parseBookingNote(origen.note);
  const parche: Record<string, unknown> = { note: reserva.note ?? null };
  if (fila.booking_answers == null && reserva.answers) parche.booking_answers = reserva.answers;
  if (fila.deposit_due_at == null && senal.dueAt) parche.deposit_due_at = senal.dueAt;
  if (fila.deposit_period_hours == null && senal.hours) parche.deposit_period_hours = senal.hours;
  if (origen.origen === "tpv123" && fila.origen !== "tpv123") parche.origen = "tpv123";
  return parche;
}

export interface FilaClienteAMigrar {
  penalty_eur: number | string | null;
  penalty_note: string | null;
  manual_block?: boolean | null;
}

/**
 * Parche para una ficha con el bloqueo manual codificado en penalty_note:
 * enciende `manual_block` y devuelve la deuda a su estado anterior (nota,
 * caducidad y decisión de bloqueo). Null si no hay nada que migrar.
 */
export function parcheClienteDesdeNota(fila: FilaClienteAMigrar): Record<string, unknown> | null {
  if (!isManualBlockRecord(fila)) return null;
  const previo = previousPenaltyState(fila.penalty_note);
  const eur = Number(fila.penalty_eur ?? 0);
  return {
    manual_block: true,
    penalty_note: previo?.note ?? null,
    penalty_keep: previo?.keep ?? false,
    penalty_block: previo?.block ?? true,
    // El bloqueo manual «inventaba» una deuda de 0 € para poder existir.
    ...(eur > 0 ? {} : { penalty_eur: null, penalty_at: null }),
  };
}
