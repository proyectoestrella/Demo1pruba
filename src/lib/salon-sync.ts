/**
 * El "y además, sincroniza" de la store.
 *
 * Todas las acciones del panel siguen haciendo exactamente lo que hacían —
 * mutar el estado local, al instante, sin esperar a nadie — y llaman aquí
 * después. Este módulo es fire-and-forget: si Supabase falla, se escribe en
 * consola y la app sigue. Perder una sincronización es molesto; bloquear al
 * dueño delante de un cliente, no.
 *
 * Nada de esto se ejecuta si el salón no es real: `slug` llega `null` desde la
 * store (`realSalonSlug`) para las ~54 demos de venta, y todas las funciones de
 * aquí salen por la primera línea sin tocar la red.
 *
 * No importa la store para evitar el ciclo store → sync → store: el slug y los
 * datos se los pasa siempre quien llama.
 */
import {
  applyClientPenalty,
  clearClientPenalty,
  deleteAppointment as deleteAppointmentFn,
  deleteWaitlistEntry,
  saveClientNotes,
  saveSalonProfile,
  syncAppointment,
  syncWaitlistEntry,
} from "./api/salons.functions";
import type { Appointment, Client, SalonProfile, WaitlistEntry } from "./mock/types";

/** Datos del cliente que acompañan a una cita cuando se conocen (reserva pública, cita por teléfono). */
export interface ClienteDeCita {
  name: string;
  phone: string;
  email?: string;
}

function aviso(que: string) {
  return (err: unknown) => {
    // El cambio YA está aplicado en local: esto solo avisa de que no subió.
    console.error(`Sync con Supabase fallida (${que}); el cambio sigue en local:`, err);
  };
}

/** Sube una cita (crear o modificar: es el mismo upsert). */
export function pushAppointment(
  slug: string | null,
  appt: Appointment,
  cliente?: ClienteDeCita,
): void {
  if (!slug) return;
  syncAppointment({
    data: {
      slug,
      localId: appt.id,
      clientName: cliente?.name ?? appt.clientName ?? undefined,
      clientPhone: cliente?.phone,
      clientEmail: cliente?.email,
      serviceIds: appt.serviceIds ?? [],
      employeeId: appt.employeeId,
      startISO: appt.start,
      durationMin: appt.duration,
      priceEur: appt.priceEur,
      status: appt.status,
      clientConfirmedAt: appt.clientConfirmedAt ?? null,
      note: appt.note ?? null,
      paymentMethod: appt.paymentMethod ?? null,
      paidAt: appt.paidAt ?? null,
      depositRequestedAt: appt.depositRequestedAt ?? null,
      depositReceivedAt: appt.depositReceivedAt ?? null,
      depositEur: appt.depositEur ?? null,
    },
  }).catch(aviso(`cita ${appt.id}`));
}

/** Borra una cita de verdad. */
export function pushAppointmentDeletion(slug: string | null, localId: string): void {
  if (!slug) return;
  deleteAppointmentFn({ data: { slug, localId } }).catch(aviso(`borrado de cita ${localId}`));
}

/**
 * Sube una entrada de la lista de espera (crear o modificar: mismo upsert).
 *
 * Hasta ahora la lista de espera no subía a ningún sitio: en un salón real
 * eso significaba que lo que el dueño apuntaba se perdía en cuanto recargaba,
 * y que mientras tanto seguía viendo las cuatro entradas de ejemplo del seed.
 */
export function pushWaitlistEntry(slug: string | null, entry: WaitlistEntry | undefined): void {
  if (!slug || !entry) return;
  syncWaitlistEntry({
    data: {
      slug,
      localId: entry.id,
      clientName: entry.clientName,
      phone: entry.phone ?? "",
      serviceId: entry.serviceId ?? "",
      preferredEmployeeId: String(entry.preferredEmployeeId ?? "any"),
      preferredRange: entry.preferredRange ?? "",
    },
  }).catch(aviso(`lista de espera ${entry.id}`));
}

/** Quita una entrada de la lista de espera (la borró el dueño, o se convirtió en cita). */
export function pushWaitlistDeletion(slug: string | null, localId: string): void {
  if (!slug) return;
  deleteWaitlistEntry({ data: { slug, localId } }).catch(
    aviso(`borrado en lista de espera ${localId}`),
  );
}

/** Sube el perfil del salón (Ajustes). */
export function pushSalonProfile(slug: string | null, profile: SalonProfile): void {
  if (!slug) return;
  saveSalonProfile({
    data: { slug, profile: profile as unknown as Record<string, unknown> },
  }).catch(aviso("perfil del salón"));
}

/** Sube la penalización de un cliente. Sin teléfono no hay ficha que marcar. */
export function pushPenalty(
  slug: string | null,
  cliente: Client | undefined,
  eur: number,
  note?: string,
): void {
  if (!slug || !cliente?.phone) return;
  applyClientPenalty({
    data: {
      slug,
      clientId: cliente.id,
      phone: cliente.phone,
      name: cliente.name,
      eur,
      note,
      penaltyAt: cliente.penaltyAt ?? null,
      penaltyKeep: cliente.penaltyKeep ?? false,
    },
  }).catch(aviso(`penalización de ${cliente.name}`));
}

/** Cierra la penalización de un cliente (cobrada o perdonada). */
export function pushPenaltyCleared(
  slug: string | null,
  cliente: Client | undefined,
  note?: string,
): void {
  if (!slug || !cliente?.phone) return;
  clearClientPenalty({
    data: { slug, clientId: cliente.id, phone: cliente.phone, note },
  }).catch(aviso(`fin de penalización de ${cliente.name}`));
}

/** Sube las indicaciones del salón sobre un cliente. */
export function pushClientNotes(slug: string | null, cliente: Client | undefined): void {
  if (!slug || !cliente?.phone) return;
  saveClientNotes({ data: { slug, phone: cliente.phone, notes: cliente.notes ?? "" } }).catch(
    aviso(`notas de ${cliente.name}`),
  );
}
