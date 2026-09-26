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
import type { Cambio } from "./cambios";
import { guardarCambio, marcarAvisoEnviadoServidor } from "./api/cambios.functions";
import {
  borrarPago as borrarPagoApi,
  cerrarCaja as cerrarCajaApi,
  listarPagos as listarPagosApi,
  registrarPago as registrarPagoApi,
  type CierreCaja,
} from "./api/pagos.functions";
import type { Appointment, Client, SalonProfile, WaitlistEntry } from "./mock/types";
import type { Pago } from "./pagos";
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

/**
 * Reintentos automáticos (barrido de calidad 2026-09-26). Un corte de red o
 * un 5xx de paso no deberían llegar al dueño como aviso: se reintenta solo,
 * con espera creciente, y solo si sigue fallando aparece el aviso con su
 * botón. Todo lo que se reintenta es idempotente en el servidor (upsert por
 * id local, borrado por id, pagos y cambios con `ignoreDuplicates`), así que
 * repetir la llamada no duplica nada. La única alta que NO lo es —la ficha
 * sin teléfono, que es un `insert`— pasa `reintentable: false`.
 */
export const ESPERAS_REINTENTO_MS = [1_000, 3_000, 9_000] as const;
let esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Solo para pruebas: sustituye la espera entre reintentos (p. ej. por 0 ms). */
export function esperaDeReintentoParaPruebas(fn: ((ms: number) => Promise<void>) | null): void {
  esperar = fn ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
}

/** El servidor contestó y dijo que no (solape, bloqueo…): reintentar no lo arregla. */
class RechazoDelServidor extends Error {}

async function conReintentos(intentar: () => Promise<unknown>): Promise<unknown> {
  for (let i = 0; ; i++) {
    try {
      return await intentar();
    } catch (err) {
      if (err instanceof RechazoDelServidor || i >= ESPERAS_REINTENTO_MS.length) throw err;
      await esperar(ESPERAS_REINTENTO_MS[i]);
    }
  }
}

/**
 * Cola por id local: dos cambios seguidos de la misma cita suben en orden.
 * Sin esto, un primer parche que falla y se reintenta segundos después podía
 * llegar DETRÁS del segundo y pisarlo con un valor viejo.
 */
const colas = new Map<string, Promise<unknown>>();

/** Pone `tarea` en la cola de `clave` (o la lanza ya si no hay clave). */
function encolar(clave: string | undefined, tarea: () => Promise<unknown>): Promise<unknown> {
  const anterior = clave ? colas.get(clave) : undefined;
  const turno = anterior ? anterior.then(tarea, tarea) : tarea();
  if (clave) {
    const marca = turno.then(() => {}, () => {});
    colas.set(clave, marca);
    void marca.then(() => { if (colas.get(clave) === marca) colas.delete(clave); });
  }
  return turno;
}

/**
 * Generaciones de escritura por id local y por campo (segunda pasada del
 * barrido). Un reintento —automático o del botón del aviso— de un cambio
 * VIEJO no puede pisar lo que un cambio posterior de la misma cita ya dejó:
 *  - una subida entera se salta si después hubo otra escritura de esa cita;
 *  - un parche solo manda los campos que nadie ha vuelto a tocar después.
 */
let generacion = 0;
const ultimaDeClave = new Map<string, number>();
const ultimaDeCampo = new Map<string, number>();
function nuevaGeneracion(clave: string, campos: string[] | "todos"): number {
  const g = ++generacion;
  ultimaDeClave.set(clave, g);
  if (campos === "todos") ultimaDeCampo.set(`${clave}|*`, g);
  else for (const c of campos) ultimaDeCampo.set(`${clave}|${c}`, g);
  return g;
}
const hayPosterior = (clave: string, g: number) => (ultimaDeClave.get(clave) ?? 0) > g;
function camposVigentes<T extends object>(clave: string, g: number, patch: T): Partial<T> {
  const todos = ultimaDeCampo.get(`${clave}|*`) ?? 0;
  return Object.fromEntries(
    Object.entries(patch).filter(([k]) => (ultimaDeCampo.get(`${clave}|${k}`) ?? 0) === g && todos < g),
  ) as Partial<T>;
}

/** Lanza la subida y, si falla (tras los reintentos automáticos), la convierte en un aviso reintentable. */
function subir(que: string, intentar: () => Promise<unknown>, claveLocal?: string, reintentable = true): Promise<void> {
  pendientes += 1;
  if (claveLocal) sinGuardar.add(claveLocal);
  const unaVez = async () => {
    await intentar();
    if (claveLocal) sinGuardar.delete(claveLocal);
  };
  // El botón «Reintentar» también pasa por la cola de la cita: nunca adelanta
  // a un cambio que esté subiendo en ese momento.
  const desdeAviso = () => encolar(claveLocal, unaVez);
  return encolar(claveLocal, () => (reintentable ? conReintentos(unaVez) : unaVez()))
    .then(() => {}, aviso(que, desdeAviso))
    .finally(() => { pendientes -= 1; });
}

let pendientes = 0;
const altasPendientes = new Map<string, Promise<void>>();
/**
 * Ids locales (`cita:<id>`, `cliente:<id>`, `espera:<id>`) con un cambio que
 * todavía no ha llegado a Supabase: en camino o fallido con aviso. El
 * refresco del panel no debe pisarlos con la versión antigua del servidor.
 */
const sinGuardar = new Set<string>();
/** Evita que una lectura antigua pise un cambio local aún en camino. */
export function sincronizacionPendiente(): boolean { return pendientes > 0; }
/** ¿Tiene esta cita/ficha un cambio local que aún no está guardado? */
export function cambioSinGuardar(clave: string): boolean { return sinGuardar.has(clave); }
/** Solo para pruebas. */
export function olvidarCambiosSinGuardar(): void { sinGuardar.clear(); }

/** Sube una cita (crear o modificar: es el mismo upsert). */
export function pushAppointment(
  slug: string | null,
  appt: Appointment,
  cliente?: ClienteDeCita,
  opciones: OpcionesGuardado = {},
): void {
  if (!slug) return;
  const quien = (cliente?.name ?? appt.clientName ?? "").trim();
  const g = nuevaGeneracion(`cita:${appt.id}`, "todos");
  subir(quien ? `la cita de ${quien}` : "la cita", async () => {
    // Un reintento de la cita entera tras otro cambio de ella la pisaría con la versión vieja.
    if (hayPosterior(`cita:${appt.id}`, g)) return;
    if (appt.origen === "tpv123" && !cliente?.phone) await altasPendientes.get(`${slug}|${quien}`);
    return exigirGuardado(await syncAppointment({ data: appointmentPayload(slug, appt, cliente, opciones) }));
  }, `cita:${appt.id}`);
}

/** Opciones del panel al guardar. Ver el contrato de solapes en lib/solape.ts. */
export interface OpcionesGuardado {
  permitirSolape?: boolean;
  /** «deshacer»: el parche deshace un cambio (auditoría en la cita, lote 9b). */
  origen?: "deshacer";
}

/**
 * Un `synced: false` con motivo (solape, bloqueo…) desde el panel no es un
 * guardado: se convierte en error para que `subir` enseñe el aviso con
 * reintento en vez de dar la cita por guardada.
 */
function exigirGuardado<T extends { synced: boolean; reason?: string }>(r: T): T {
  if (!r.synced && r.reason && r.reason !== "sin-fila") throw new RechazoDelServidor(r.reason);
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
    depositStatus: appt.depositStatus ?? null,
    depositMethod: appt.depositMethod ?? null,
    depositReceivedEur: appt.depositReceivedEur ?? null,
    depositAppliedAt: appt.depositAppliedAt ?? null,
    depositAppliedEur: appt.depositAppliedEur ?? null,
    depositRefundedAt: appt.depositRefundedAt ?? null,
    depositRefundedEur: appt.depositRefundedEur ?? null,
    depositRetainedAt: appt.depositRetainedAt ?? null,
    depositNote: appt.depositNote ?? null,
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
  const g = nuevaGeneracion(`cita:${appt.id}`, Object.keys(patch));
  subir(quien ? `la cita de ${quien}` : "la cita", async () => {
    const vigente = camposVigentes(`cita:${appt.id}`, g, patch);
    if (Object.keys(vigente).length === 0) return; // todo lo de este parche ya lo cambió otro posterior
    const r = await syncAppointmentPatch({
      data: { slug, localId: appt.id, patch: vigente, permitirSolape: opciones.permitirSolape === true, ...(opciones.origen ? { origen: opciones.origen } : {}) },
    });
    if (!r.synced && r.reason === "sin-fila") {
      if (hayPosterior(`cita:${appt.id}`, g)) return exigirGuardado({ ...r, reason: undefined });
      return exigirGuardado(await syncAppointment({ data: appointmentPayload(slug, appt, cliente, opciones) }));
    }
    return exigirGuardado(r);
  }, `cita:${appt.id}`);
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
          manualBlock: true,
        },
      }),
    );
  } else {
    subir(`el desbloqueo de ${cliente.name}`, () =>
      (cliente.penaltyEur ?? 0) > 0
        ? applyClientPenalty({
            data: {
              slug,
              manualBlock: false,
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
        : clearClientPenalty({ data: { slug, clientId: cliente.id, phone: cliente.phone, manualBlock: false } }),
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
    tpvCode: cliente.tpvCode, birthday: cliente.birthday,
  } }), undefined, Boolean(cliente.phone)); // sin teléfono es un insert: no se repite solo
  altasPendientes.set(clave, pending);
  void pending.finally(() => { if (altasPendientes.get(clave) === pending) altasPendientes.delete(clave); });
}

/** Sube un cambio del historial (lote 9). La autora la pone el servidor. */
export function pushCambio(slug: string | null, c: Cambio): void {
  if (!slug) return;
  subir(`el historial («${c.resumen}»)`, () =>
    guardarCambio({
      data: {
        slug,
        cambio: {
          id: c.id, tipo: c.tipo, entidad: c.entidad, idEntidad: c.idEntidad, antes: c.antes, despues: c.despues,
          resumen: c.resumen, fecha: c.fecha, deshaceA: c.deshaceA, avisoEnviado: c.avisoEnviado,
        },
      },
    }),
  );
}

export function pushAvisoEnviado(slug: string | null, cambioId: string): void {
  if (!slug) return;
  subir("el aviso a la clienta", () => marcarAvisoEnviadoServidor({ data: { slug, cambioId } }));
}

/* ---------------------------------------------------------------------- */
/* Caja (lote 11)                                                         */
/* ---------------------------------------------------------------------- */

/** Sube un pago (alta manual). Idempotente por `id`. */
export function pushPago(slug: string | null, pago: Pago): void {
  if (!slug) return;
  subir("el pago", () =>
    registrarPagoApi({
      data: {
        slug,
        pago: {
          id: pago.id, appointmentId: pago.appointmentId, clientId: pago.clientId, clientName: pago.clientName,
          importeEur: pago.importeEur, metodo: pago.metodo, concepto: pago.concepto, cobradoPor: pago.cobradoPor,
          nota: pago.nota, refExterna: pago.refExterna, fecha: pago.fecha,
        },
      },
    }),
  );
}

export function pushPagoDeletion(slug: string | null, id: string): void {
  if (!slug) return;
  subir("el pago borrado", () => borrarPagoApi({ data: { slug, id } }));
}

/**
 * Sustituye `payments` por lo que haya en el servidor para ese rango (como
 * `listarCambios`: no forma parte de la carga inicial del salón). En una
 * demo no hay nada que pedir: se resuelve con `null` sin tocar la red.
 */
export async function cargarPagosDeServidor(slug: string | null, desde: string, hasta: string): Promise<Pago[] | null> {
  if (!slug) return null;
  const r = await listarPagosApi({ data: { slug, desde, hasta } });
  return r.pagos as Pago[];
}

/** `null` en demo: no hay servidor que calcule el esperado del día. */
export async function cerrarCajaEnServidor(
  slug: string | null,
  fecha: string,
  efectivoContado: number,
  nota?: string,
): Promise<CierreCaja | null> {
  if (!slug) return null;
  return cerrarCajaApi({ data: { slug, fecha, efectivoContado, nota } });
}
