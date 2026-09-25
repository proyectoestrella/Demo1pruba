/**
 * Traducción entre las filas de Supabase y los tipos que usa la app
 * (`mock/types.ts`), y la regla que decide si un salón es real o sigue siendo
 * una demo de venta.
 *
 * Vive aparte de `api/salons.functions.ts` a propósito: aquí no hay ni un
 * `createServerFn` ni un cliente de Supabase, solo funciones puras. Así se
 * puede probar con `bun test` sin levantar nada, y así el navegador puede usar
 * las mismas funciones que el servidor sin arrastrarse la service role key.
 */
import type {
  Appointment,
  AppointmentStatus,
  BookingAnswers,
  Client,
  EmployeeId,
  PaymentMethod,
  SalonProfile,
  WaitlistEntry,
} from "./mock/types";
import { isPenaltyActive } from "./plantones";
import { isManualBlockRecord, previousPenaltyState } from "./no-show";
import { parseBookingNote } from "./booking-answers";
import { parseDepositNote } from "./deposit-deadline";
import { leerOrigen } from "./origen-cita";

/** Fila de `appointments` tal y como la devuelve PostgREST. */
export interface AppointmentRow {
  id: string;
  local_id: string | null;
  client_id: string | null;
  client_name: string | null;
  service_id: string;
  employee_id: string;
  start_at: string;
  duration_min: number;
  price_eur: number | string;
  status: string;
  client_confirmed_at: string | null;
  note: string | null;
  /**
   * Columnas nuevas (cierre de caja y fianza por Bizum). Son opcionales en el
   * tipo a propósito: mientras el DDL no esté aplicado en producción,
   * PostgREST no las devuelve y la fila llega sin ellas — la agenda tiene que
   * seguir cargando igual.
   */
  payment_method?: string | null;
  paid_at?: string | null;
  deposit_requested_at?: string | null;
  deposit_received_at?: string | null;
  deposit_eur?: number | string | null;
  color_formula?: string | null;
  technical_notes?: string | null;
  reminder_sent_at?: string | null;
  /**
   * Lote 3 (26/09/2026): lo que antes iba codificado en `note` tiene columna
   * propia. Mientras la fila venga sin ellas (o a null, en filas anteriores al
   * relleno), se sigue leyendo el marcador de la nota.
   */
  booking_answers?: BookingAnswers | null;
  deposit_due_at?: string | null;
  deposit_period_hours?: number | null;
  origen?: string | null;
  updated_at?: string | null;
  /** Ciclo de vida de la señal (25/09/2026, lib/senal.ts). */
  deposit_status?: string | null;
  deposit_method?: string | null;
  deposit_received_eur?: number | string | null;
  deposit_applied_at?: string | null;
  deposit_applied_eur?: number | string | null;
  deposit_refunded_at?: string | null;
  deposit_refunded_eur?: number | string | null;
  deposit_retained_at?: string | null;
  deposit_note?: string | null;
}

/** Fila de `clients` tal y como la devuelve PostgREST. */
export interface ClientRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  penalty_eur: number | string | null;
  penalty_note: string | null;
  created_at: string;
  /** Igual que arriba: opcionales hasta que el DDL de la caducidad esté aplicado. */
  penalty_at?: string | null;
  penalty_keep?: boolean | null;
  penalty_block?: boolean | null;
  /** Lote 3: bloqueo manual con columna propia; antes iba en `penalty_note`. */
  manual_block?: boolean | null;
  tpv_code?: string | null;
  birthday?: string | null;
  updated_at?: string | null;
}

/** Fila de `waitlist` tal y como la devuelve PostgREST. */
export interface WaitlistRow {
  id: string;
  local_id: string | null;
  client_name: string;
  phone: string;
  service_id: string;
  preferred_employee_id: string;
  preferred_range: string;
  created_at: string;
}

/**
 * Últimos 9 dígitos del teléfono — la misma regla que `normalizePhone` en
 * `no-show.ts`, repetida aquí para que este módulo no dependa de aquel (lo usa
 * también el servidor, donde no pinta nada la política de plantón).
 */
export function phoneKey(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "").slice(-9);
}

/** Números que llegan de Postgres como cadena ("18.00") — `numeric` no es un number en JSON. */
function num(value: number | string | null | undefined, porDefecto = 0): number {
  if (value === null || value === undefined) return porDefecto;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : porDefecto;
}

/**
 * Fila → `Appointment`.
 *
 * `anonimo` es para la web pública: ahí las citas solo sirven para saber qué
 * huecos están pillados, así que el nombre del cliente y la nota interna NO
 * viajan al navegador de un desconocido.
 */
export function rowToAppointment(row: AppointmentRow, anonimo = false): Appointment {
  const deposit = anonimo ? {} : parseDepositNote(row.note);
  const origen = anonimo ? {} : leerOrigen(deposit.note);
  const booking = anonimo ? {} : parseBookingNote(origen.note);
  return {
    // El id que conoce el navegador es `local_id`; las filas antiguas (y las
    // que creó la reserva pública antes de esto) no lo tienen y caen al uuid.
    id: row.local_id ?? row.id,
    clientId: row.client_id ?? "",
    clientName: anonimo ? "Reservado" : (row.client_name ?? ""),
    serviceIds: row.service_id ? row.service_id.split(",").filter(Boolean) : [],
    employeeId: row.employee_id as EmployeeId,
    start: row.start_at,
    duration: num(row.duration_min),
    priceEur: num(row.price_eur),
    status: row.status as AppointmentStatus,
    clientConfirmedAt: row.client_confirmed_at ?? undefined,
    note: booking.note,
    // Columna nueva primero; el marcador de la nota solo si viene a null.
    bookingAnswers: anonimo ? undefined : (row.booking_answers ?? booking.answers),
    origen: row.origen === "tpv123" ? "tpv123" : (row.origen ? undefined : origen.origen),
    colorFormula: anonimo ? undefined : (row.color_formula ?? undefined),
    technicalNotes: anonimo ? undefined : (row.technical_notes ?? undefined),
    reminderSentAt: anonimo ? undefined : (row.reminder_sent_at ?? undefined),
    // Cómo se cobró y si hubo señal son cosa del salón: no viajan a la web
    // pública, igual que el nombre y la nota.
    paymentMethod: anonimo ? undefined : ((row.payment_method as PaymentMethod) ?? undefined),
    paidAt: anonimo ? undefined : (row.paid_at ?? undefined),
    depositRequestedAt: anonimo ? undefined : (row.deposit_requested_at ?? deposit.requestedAt),
    depositDueAt: row.deposit_due_at ?? deposit.dueAt,
    depositPeriodHours: (row.deposit_period_hours as Appointment["depositPeriodHours"]) ?? deposit.hours,
    depositReceivedAt: anonimo ? undefined : (row.deposit_received_at ?? deposit.receivedAt),
    depositEur: anonimo ? undefined : (row.deposit_eur == null ? deposit.eur : num(row.deposit_eur)),
    // La web pública no ve nada de la señal de otras clientas.
    ...(anonimo ? {} : {
      depositStatus: (row.deposit_status as Appointment["depositStatus"]) ?? undefined,
      depositMethod: (row.deposit_method as Appointment["depositMethod"]) ?? undefined,
      depositReceivedEur: row.deposit_received_eur == null ? undefined : num(row.deposit_received_eur),
      depositAppliedAt: row.deposit_applied_at ?? undefined,
      depositAppliedEur: row.deposit_applied_eur == null ? undefined : num(row.deposit_applied_eur),
      depositRefundedAt: row.deposit_refunded_at ?? undefined,
      depositRefundedEur: row.deposit_refunded_eur == null ? undefined : num(row.deposit_refunded_eur),
      depositRetainedAt: row.deposit_retained_at ?? undefined,
      depositNote: row.deposit_note ?? undefined,
    }),
  };
}

/**
 * Fila → `WaitlistEntry`. Igual que en las citas, el id que conoce el
 * navegador es `local_id`; las filas sin él caen a su uuid.
 */
export function rowToWaitlist(row: WaitlistRow): WaitlistEntry {
  return {
    id: row.local_id ?? row.id,
    clientName: row.client_name,
    phone: row.phone,
    serviceId: row.service_id,
    preferredEmployeeId: (row.preferred_employee_id || "any") as WaitlistEntry["preferredEmployeeId"],
    preferredRange: row.preferred_range ?? "",
    createdAt: row.created_at,
  };
}

/** Fila → `Client`. El id local pasa a ser el uuid de Supabase: es opaco, da igual. */
export function rowToClient(row: ClientRow): Client {
  const penalty = num(row.penalty_eur, 0);
  // Bloqueo manual: columna propia (lote 3) o, en filas sin rellenar, el
  // JSON dentro de penalty_note.
  const bloqueoEnNota = isManualBlockRecord(row);
  const previo = bloqueoEnNota ? previousPenaltyState(row.penalty_note) : null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? "",
    email: row.email ?? undefined,
    createdAt: row.created_at,
    notes: row.notes ?? undefined,
    manualBlock: row.manual_block === true || bloqueoEnNota,
    tpvCode: row.tpv_code ?? undefined,
    birthday: row.birthday ?? undefined,
    penaltyEur: penalty > 0 ? penalty : undefined,
    penaltyNote: previo ? previo.note : row.penalty_note ?? undefined,
    penaltyAt: row.penalty_at ?? undefined,
    penaltyKeep: previo ? previo.keep : row.penalty_keep ?? undefined,
    penaltyBlock: previo ? previo.block : row.penalty_block ?? undefined,
  };
}

/**
 * La regla que enciende (o no) todo el backend.
 *
 * Si Supabase devuelve un perfil para este slug, el salón es REAL: ese perfil
 * manda sobre lo que hubiera en el navegador y sobre lo que traiga el enlace
 * `?d=…`, porque es la única fuente que existe en los dos dispositivos.
 *
 * Si devuelve `null`, el slug sigue siendo una demo de venta de las ~54 del
 * rutero: se devuelve el perfil que ya se estaba pintando, sin tocar nada.
 *
 * Se separa en una función pura para poder probar exactamente esto: que un
 * `null` NO pisa, y que un perfil SÍ.
 */
export function resolveActiveProfile(
  actual: SalonProfile,
  deSupabase: SalonProfile | null | undefined,
): { profile: SalonProfile; real: boolean } {
  if (!deSupabase) return { profile: actual, real: false };
  // El slug lo fija el servidor, no el jsonb: si alguien guardó el perfil con
  // otro slug dentro, la fila manda igual y el enlace seguiría funcionando.
  return { profile: deSupabase, real: true };
}

/**
 * Cliente con bloqueo manual o penalización pendiente dentro de una lista de filas, buscando
 * por teléfono normalizado. Lo usa el servidor para responder a la reserva
 * pública sin mandarle la agenda de clientes entera a un desconocido.
 */
export function findPenaltyRow(
  rows: ClientRow[],
  phone: string,
  now: Date = new Date(),
): ClientRow | undefined {
  const target = phoneKey(phone);
  if (target.length < 9) return undefined;
  // El bloqueo caduca solo a los 30 días (ver lib/plantones.ts): la deuda
  // sigue en la ficha, pero a partir de ahí esta persona vuelve a poder
  // reservar sola. Se comprueba con la MISMA función que usa el panel, para
  // que la web pública y la ficha no puedan decir cosas distintas.
  return rows.find((r) => {
    if (phoneKey(r.phone) !== target) return false;
    const client = rowToClient(r);
    return client.manualBlock || isPenaltyActive(client, now);
  });
}
