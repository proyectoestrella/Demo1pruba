/**
 * El "y además, sincroniza" de la store.
 *
 * Todas las acciones del panel siguen haciendo exactamente lo que hacían —
 * mutar el estado local, al instante, sin esperar a nadie — y llaman aquí
 * después. Este módulo no bloquea nunca: perder una sincronización es
 * molesto; bloquear al dueño delante de un cliente, no.
 *
 * Lo que sí ha cambiado es qué pasa cuando falla. Antes acababa solo en un
 * `console.error`: el dueño veía la cita movida en pantalla, cerraba el iPad
 * y jamás se enteraba de que ese cambio no había subido a ningún sitio. Ahora
 * cada fallo registra un aviso visible, en español llano y con botón de
 * reintentar — ver `lib/avisos-sync.ts` y `components/AvisosDeSincronizacion`.
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
  patchSalonProfile,
  saveClientNotes,
  saveSalonProfile,
  syncAppointment,
  syncWaitlistEntry,
} from "./api/salons.functions";
import { registrarAviso } from "./avisos-sync";
import type { Appointment, Client, SalonProfile, WaitlistEntry } from "./mock/types";
import { manualBlockNote } from "./no-show";
import { serializeBookingNote } from "./booking-answers";

/** Datos del cliente que acompañan a una cita cuando se conocen (reserva pública, cita por teléfono). */
export interface ClienteDeCita {
  name: string;
  phone: string;
  email?: string;
}

/**
 * Qué hacer cuando una subida falla: dejar rastro técnico en consola para
 * quien depure, y poner delante del dueño un aviso que entienda.
 *
 * `que` se redacta para caber en la frase de abajo y NO lleva jerga: «la cita
 * de Ana», «la lista de espera», «los datos de tu salón». Ni una palabra sobre
 * Supabase, ni códigos de error.
 *
 * `intentar` es la misma llamada otra vez: es lo que ejecuta el botón
 * «Reintentar». Si vuelve a fallar, vuelve a avisar — el bucle lo cierra el
 * dueño, no el código.
 */
function aviso(que: string, intentar: () => Promise<unknown>) {
  const manejar = (err: unknown) => {
    console.error(`Sync con Supabase fallida (${que}); el cambio sigue en local:`, err);
    registrarAviso(
      `No hemos podido guardar ${que}. Se ve en esta pantalla, pero todavía no está guardado.`,
      () => {
        intentar().catch(manejar);
      },
    );
  };
  return manejar;
}

/** Lanza la subida y, si falla, la convierte en un aviso reintentable. */
function subir(que: string, intentar: () => Promise<unknown>): void {
  intentar().catch(aviso(que, intentar));
}

/** Sube una cita (crear o modificar: es el mismo upsert). */
export function pushAppointment(
  slug: string | null,
  appt: Appointment,
  cliente?: ClienteDeCita,
): void {
  if (!slug) return;
  const quien = (cliente?.name ?? appt.clientName ?? "").trim();
  const payload = {
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
    note: serializeBookingNote(appt.note, appt.bookingAnswers) ?? null,
    paymentMethod: appt.paymentMethod ?? null,
    paidAt: appt.paidAt ?? null,
    depositRequestedAt: appt.depositRequestedAt ?? null,
    depositReceivedAt: appt.depositReceivedAt ?? null,
    depositEur: appt.depositEur ?? null,
  };
  subir(quien ? `la cita de ${quien}` : "la cita", () => syncAppointment({ data: payload }));
}

/** Borra una cita de verdad. */
export function pushAppointmentDeletion(slug: string | null, localId: string): void {
  if (!slug) return;
  subir("la cita que has borrado", () => deleteAppointmentFn({ data: { slug, localId } }));
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
  const payload = {
    slug,
    localId: entry.id,
    clientName: entry.clientName,
    phone: entry.phone ?? "",
    serviceId: entry.serviceId ?? "",
    preferredEmployeeId: String(entry.preferredEmployeeId ?? "any"),
    preferredRange: entry.preferredRange ?? "",
  };
  subir(`a ${entry.clientName || "esa persona"} en la lista de espera`, () =>
    syncWaitlistEntry({ data: payload }),
  );
}

/** Quita una entrada de la lista de espera (la borró el dueño, o se convirtió en cita). */
export function pushWaitlistDeletion(slug: string | null, localId: string): void {
  if (!slug) return;
  subir("el cambio en la lista de espera", () => deleteWaitlistEntry({ data: { slug, localId } }));
}

/**
 * Sube el perfil ENTERO del salón. Solo para quien de verdad tenga delante el
 * perfil completo y recién leído — hoy, nadie desde la store.
 *
 * Ver `pushSalonProfilePatch` para el camino normal, y el comentario de
 * `patchSalonProfile` en api/salons.functions.ts para por qué importa.
 */
export function pushSalonProfile(slug: string | null, profile: SalonProfile): void {
  if (!slug) return;
  subir("los datos de tu salón", () =>
    saveSalonProfile({ data: { slug, profile: profile as unknown as Record<string, unknown> } }),
  );
}

/**
 * Sube SOLO lo que ha cambiado del perfil.
 *
 * Es el camino que usa `updateSalonProfile`: así un navegador con el perfil
 * viejo guardado en `localStorage` ya no puede revertir un campo que cambió
 * otro dispositivo, porque ese campo ni siquiera viaja.
 */
export function pushSalonProfilePatch(slug: string | null, patch: Partial<SalonProfile>): void {
  if (!slug) return;
  const claves = Object.keys(patch).filter(
    (k) => (patch as Record<string, unknown>)[k] !== undefined,
  );
  // Un `updateSalonProfile({})` no tiene por qué tocar la red.
  if (claves.length === 0) return;
  subir("los datos de tu salón", () =>
    patchSalonProfile({ data: { slug, patch: patch as unknown as Record<string, unknown> } }),
  );
}

/** Sube la penalización de un cliente. Sin teléfono no hay ficha que marcar. */
export function pushPenalty(
  slug: string | null,
  cliente: Client | undefined,
  eur: number,
  note?: string,
): void {
  if (!slug || !cliente?.phone) return;
  const payload = {
    slug,
    clientId: cliente.id,
    phone: cliente.phone,
    name: cliente.name,
    eur,
    note,
    penaltyAt: cliente.penaltyAt ?? null,
    penaltyKeep: cliente.penaltyKeep ?? false,
    // `undefined` sube como `true`: una deuda sin decisión explícita
    // bloquea, igual que se comportaba antes de que existiera la opción.
    penaltyBlock: cliente.penaltyBlock !== false,
  };
  subir(`la deuda de ${cliente.name}`, () => applyClientPenalty({ data: payload }));
}

/** Cierra la penalización de un cliente (cobrada o perdonada). */
export function pushPenaltyCleared(
  slug: string | null,
  cliente: Client | undefined,
  note?: string,
): void {
  if (!slug || !cliente?.phone) return;
  subir(`la deuda saldada de ${cliente.name}`, () =>
    clearClientPenalty({ data: { slug, clientId: cliente.id, phone: cliente.phone, note } }),
  );
}

/** Persiste un bloqueo manual en las columnas existentes y conserva la deuda previa. */
export function pushManualBlock(
  slug: string | null,
  cliente: Client | undefined,
  blocked: boolean,
): void {
  if (!slug || !cliente?.phone) return;
  if (blocked) {
    subir(`el bloqueo manual de ${cliente.name}`, () =>
      applyClientPenalty({
        data: {
          slug,
          clientId: cliente.id,
          phone: cliente.phone,
          name: cliente.name,
          eur: cliente.penaltyEur ?? 0,
          note: manualBlockNote(cliente),
          penaltyAt: cliente.penaltyAt ?? null,
          penaltyKeep: true,
          penaltyBlock: true,
        },
      }),
    );
  } else {
    subir(`el desbloqueo de ${cliente.name}`, () =>
      (cliente.penaltyEur ?? 0) > 0
        ? applyClientPenalty({
            data: {
              slug,
              clientId: cliente.id,
              phone: cliente.phone,
              name: cliente.name,
              eur: cliente.penaltyEur ?? 0,
              note: cliente.penaltyNote,
              penaltyAt: cliente.penaltyAt ?? null,
              penaltyKeep: cliente.penaltyKeep ?? false,
              penaltyBlock: cliente.penaltyBlock !== false,
            },
          })
        : clearClientPenalty({ data: { slug, clientId: cliente.id, phone: cliente.phone } }),
    );
  }
}

/** Sube las indicaciones del salón sobre un cliente. */
export function pushClientNotes(slug: string | null, cliente: Client | undefined): void {
  if (!slug || !cliente?.phone) return;
  subir(`las notas de ${cliente.name}`, () =>
    saveClientNotes({ data: { slug, phone: cliente.phone, notes: cliente.notes ?? "" } }),
  );
}
