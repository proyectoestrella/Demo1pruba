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
  Client,
  EmployeeId,
  PaymentMethod,
  SalonProfile,
  WaitlistEntry,
} from "./mock/types";
import { isPenaltyActive } from "./plantones";

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
    note: anonimo ? undefined : (row.note ?? undefined),
    // Cómo se cobró y si hubo señal son cosa del salón: no viajan a la web
    // pública, igual que el nombre y la nota.
    paymentMethod: anonimo ? undefined : ((row.payment_method as PaymentMethod) ?? undefined),
    paidAt: anonimo ? undefined : (row.paid_at ?? undefined),
    depositRequestedAt: anonimo ? undefined : (row.deposit_requested_at ?? undefined),
    depositReceivedAt: anonimo ? undefined : (row.deposit_received_at ?? undefined),
    depositEur: anonimo ? undefined : (row.deposit_eur == null ? undefined : num(row.deposit_eur)),
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
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? undefined,
    createdAt: row.created_at,
    notes: row.notes ?? undefined,
    penaltyEur: penalty > 0 ? penalty : undefined,
    penaltyNote: row.penalty_note ?? undefined,
    penaltyAt: row.penalty_at ?? undefined,
    penaltyKeep: row.penalty_keep ?? undefined,
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
 * Cliente con penalización pendiente dentro de una lista de filas, buscando
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
  return rows.find((r) => phoneKey(r.phone) === target && isPenaltyActive(rowToClient(r), now));
}
