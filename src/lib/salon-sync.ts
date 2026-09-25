/**
 * El "y además, sincroniza" de la store.
 *
 * Todas las acciones del panel siguen haciendo exactamente lo que hacían —
 * mutar el estado local, al instante, sin esperar a nadie — y llaman aquí
 * después. El panel no bloquea nunca: perder una sincronización es
 * molesto; bloquear al dueño delante de un cliente, no. La reserva pública
 * de un salón real sí espera el guardado antes de confirmar a la clienta.
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
  saveClient,
  saveSalonProfile,
  syncAppointment,
  syncAppointmentPatch,
  syncWaitlistEntry,
} from "./api/salons.functions";
import { registrarAviso } from "./avisos-sync";
import type { Appointment, Client, SalonProfile, WaitlistEntry } from "./mock/types";
import { manualBlockNote } from "./no-show";

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
function subir(que: string, intentar: () => Promise<unknown>): Promise<void> {
  pendientes += 1;
  return intentar().then(() => {}, aviso(que, intentar)).finally(() => { pendientes -= 1; });
}

let pendientes = 0;
const altasPendientes = new Map<string, Promise<void>>();
/** Evita que una lectura antigua pise un cambio local aún en camino. */
export function sincronizacionPendiente(): boolean { return pendientes > 0; }

/** Sube una cita (crear o modificar: es el mismo upsert). */
export function pushAppointment(
  slug: string | null,
  appt: Appointment,
  cliente?: ClienteDeCita,
  opciones: OpcionesGuardado = {},
): void {
  if (!slug) return;
  const quien = (cliente?.name ?? appt.clientName ?? "").trim();
  subir(quien ? `la cita de ${quien}` : "la cita", async () => {
    if (appt.origen === "tpv123" && !cliente?.phone) await altasPendientes.get(`${slug}|${quien}`);
    return exigirGuardado(await syncAppointment({ data: appointmentPayload(slug, appt, cliente, opciones) }));
  });
}

/** Opciones del panel al guardar. Ver el contrato de solapes en lib/solape.ts. */
export interface OpcionesGuardado {
  permitirSolape?: boolean;
}

/**
 * Un `synced: false` con motivo (solape, bloqueo…) desde el panel no es un
 * guardado: se convierte en error para que `subir` enseñe el aviso con
 * reintento en vez de dar la cita por guardada.
 */
function exigirGuardado<T extends { synced: boolean; reason?: string }>(r: T): T {
  if (!r.synced && r.reason && r.reason !== "sin-fila") throw new Error(r.reason);
  return r;
}

function appointmentPayload(slug: string, appt: Appointment, cliente?: ClienteDeCita, opciones: OpcionesGuardado = {}) {
  return {
    slug,
    permitirSolape: opciones.permitirSolape === true,
    localId: appt.id,
    clientName: cliente?.name ?? appt.clientName ?? undefined,
    clientPhone: cliente?.phone,
    clientEmail: cliente?.email,
    importedFromTpv: appt.origen === "tpv123",
    serviceIds: appt.serviceIds ?? [],
    employeeId: appt.employeeId,
    startISO: appt.start,
    durationMin: appt.duration,
    priceEur: appt.priceEur,
    status: appt.status,
    clientConfirmedAt: appt.clientConfirmedAt ?? null,
    // Lote 3: la nota va limpia; respuestas, origen y plazo de la señal,
    // en sus campos. Si producción aún no tiene las columnas, el servidor
    // los vuelca a la nota con los marcadores de antes (filaSinLote3).
    note: appt.note ?? null,
    bookingAnswers: (appt.bookingAnswers as Record<string, string> | undefined) ?? null,
    origen: appt.origen ?? "sishow",
    depositDueAt: appt.depositDueAt ?? null,
    depositPeriodHours: appt.depositPeriodHours ?? null,
    paymentMethod: appt.paymentMethod ?? null,
    paidAt: appt.paidAt ?? null,
    depositRequestedAt: appt.depositRequestedAt ?? null,
    depositReceivedAt: appt.depositReceivedAt ?? null,
    depositEur: appt.depositEur ?? null,
    colorFormula: appt.colorFormula ?? null,
    technicalNotes: appt.technicalNotes ?? null,
    reminderSentAt: appt.reminderSentAt ?? null,
  };
}

/**
 * Parche por campos desde el panel: viaja SOLO lo que se ha tocado. Si el
 * servidor no encuentra la fila (alta aún en camino) o no tiene la columna,
 * se manda la cita entera como hasta ahora.
 */
export function pushAppointmentPatch(
  slug: string | null,
  appt: Appointment,
  patch: Partial<Appointment>,
  cliente?: ClienteDeCita,
  opciones: OpcionesGuardado = {},
): void {
  if (!slug) return;
  const quien = (cliente?.name ?? appt.clientName ?? "").trim();
  subir(quien ? `la cita de ${quien}` : "la cita", async () => {
    const r = await syncAppointmentPatch({ data: { slug, localId: appt.id, patch, permitirSolape: opciones.permitirSolape === true } });
    if (!r.synced && r.reason === "sin-fila") {
      return exigirGuardado(await syncAppointment({ data: appointmentPayload(slug, appt, cliente, opciones) }));
    }
    return exigirGuardado(r);
  });
}

/** La reserva pública espera la confirmación; un `synced: false` no es éxito. */
export async function guardarReservaPublica(
  slug: string,
  appt: Appointment,
  cliente: ClienteDeCita,
): Promise<void> {
  const resultado = await syncAppointment({ data: appointmentPayload(slug, appt, cliente) });
  if (!resultado.synced) {
    throw new Error("reason" in resultado ? resultado.reason : "RESERVA_NO_GUARDADA");
  }
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

/** Alta de ficha sin cita para los salones reales. */
export function pushClient(slug: string | null, cliente: Client): void {
  if (!slug) return;
  const clave = `${slug}|${cliente.name}`;
  const pending = subir(`la ficha de ${cliente.name}`, () => saveClient({ data: {
    slug, name: cliente.name, phone: cliente.phone, email: cliente.email, notes: cliente.notes, createdAt: cliente.createdAt,
  } }));
  altasPendientes.set(clave, pending);
  void pending.finally(() => { if (altasPendientes.get(clave) === pending) altasPendientes.delete(clave); });
}
