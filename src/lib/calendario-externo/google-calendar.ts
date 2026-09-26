/**
 * Llamadas a la API de Google Calendar ya con el access token en la mano
 * (renovarlo es cosa de `google-oauth.ts` + `servicio-sincronizacion.ts`).
 * Todo con `fetchImpl` inyectado — nada de red real en los tests.
 *
 * `SISHOW_PROP` es la marca que se deja en `extendedProperties.private` de
 * cada evento que escribe siShow: al releer el calendario (freebusy o
 * incremental) es lo que distingue "esto lo escribí yo" de "esto lo puso la
 * profesional a mano" — sin eso, importar el propio evento como si fuera un
 * bloqueo externo duplicaría cada cita en su calendario.
 */
const API = "https://www.googleapis.com/calendar/v3";
export const SISHOW_PROP = "sishowCitaId";

export interface EventoGoogleInput {
  citaId: string;
  resumen: string;
  inicioISO: string;
  finISO: string;
  descripcion?: string;
}

export interface EventoGoogle {
  id: string;
  status: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

/** Convierte un `EventoGoogle` en lo que necesita `diffBloqueosExternos` (servicio-sincronizacion.ts). */
export function comoEventoExternoListado(ev: EventoGoogle): {
  eventoExternoId: string;
  intervalo: { start: string; end: string } | null;
  resumen: string | null;
  citaIdPropio: string | null;
} {
  const inicio = ev.start?.dateTime ?? ev.start?.date;
  const fin = ev.end?.dateTime ?? ev.end?.date;
  const intervalo = ev.status !== "cancelled" && inicio && fin ? { start: inicio, end: fin } : null;
  return {
    eventoExternoId: ev.id,
    intervalo,
    resumen: ev.summary ?? null,
    citaIdPropio: ev.extendedProperties?.private?.[SISHOW_PROP] ?? null,
  };
}

function cuerpoEvento(evento: EventoGoogleInput) {
  return {
    summary: evento.resumen,
    description: evento.descripcion,
    start: { dateTime: evento.inicioISO },
    end: { dateTime: evento.finISO },
    iCalUID: `${evento.citaId}@sishow.app`,
    extendedProperties: { private: { [SISHOW_PROP]: evento.citaId } },
  };
}

async function comprobar(res: Response, contexto: string): Promise<void> {
  if (!res.ok) throw new Error(`Google Calendar (${contexto}): ${res.status} ${(await res.text()).slice(0, 300)}`);
}

export async function crearEvento(
  accessToken: string,
  calendarId: string,
  evento: EventoGoogleInput,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string }> {
  const res = await fetchImpl(`${API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpoEvento(evento)),
  });
  await comprobar(res, "crear");
  const json = (await res.json()) as { id: string };
  return { id: json.id };
}

export async function actualizarEvento(
  accessToken: string,
  calendarId: string,
  eventId: string,
  evento: EventoGoogleInput,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpoEvento(evento)),
  });
  // Un 404 aquí significa que el evento ya no existe en Google (lo borró la
  // profesional a mano). No es un fallo de siShow: se trata como si hubiera
  // que recrearlo, y es la capa de arriba quien decide eso.
  if (res.status === 404 || res.status === 410) throw new EventoGoogleNoExiste(eventId);
  await comprobar(res, "actualizar");
}

export class EventoGoogleNoExiste extends Error {
  constructor(readonly eventId: string) {
    super(`El evento ${eventId} ya no existe en Google Calendar.`);
  }
}

export async function borrarEvento(
  accessToken: string,
  calendarId: string,
  eventId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // Ya borrado (a mano, o por un reintento) no es un error: el estado final es el mismo.
  if (res.status === 404 || res.status === 410 || res.status === 204 || res.ok) return;
  await comprobar(res, "borrar");
}

export interface ResultadoIncremental {
  necesitaResync: false;
  items: EventoGoogle[];
  nextSyncToken: string | null;
}
export interface NecesitaResync {
  necesitaResync: true;
}

/**
 * Lista los cambios desde `syncToken`. Si Google responde 410 (token
 * caducado o inválido — puede pasar tras mucho tiempo sin sincronizar), hay
 * que tirar el token y hacer un resync completo: lo dice `necesitaResync`.
 */
export async function listarEventosIncremental(
  accessToken: string,
  calendarId: string,
  syncToken: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoIncremental | NecesitaResync> {
  const items: EventoGoogle[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;
  for (;;) {
    const params = new URLSearchParams({ singleEvents: "true" });
    if (syncToken) params.set("syncToken", syncToken);
    else params.set("timeMin", new Date(0).toISOString());
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetchImpl(`${API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 410) return { necesitaResync: true };
    await comprobar(res, "listar");
    const json = (await res.json()) as { items: EventoGoogle[]; nextPageToken?: string; nextSyncToken?: string };
    items.push(...json.items);
    if (json.nextPageToken) {
      pageToken = json.nextPageToken;
      continue;
    }
    nextSyncToken = json.nextSyncToken ?? null;
    break;
  }
  return { necesitaResync: false, items, nextSyncToken };
}

export interface HuecoOcupado {
  inicio: string;
  fin: string;
}

/** Solo "ocupado/libre" — nunca el título ni el detalle del evento (scope `calendar.freebusy`). */
export async function consultarOcupado(
  accessToken: string,
  calendarId: string,
  desdeISO: string,
  hastaISO: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HuecoOcupado[]> {
  const res = await fetchImpl(`${API}/freeBusy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: desdeISO, timeMax: hastaISO, items: [{ id: calendarId }] }),
  });
  await comprobar(res, "freebusy");
  const json = (await res.json()) as { calendars: Record<string, { busy: Array<{ start: string; end: string }> }> };
  const busy = json.calendars[calendarId]?.busy ?? [];
  return busy.map((b) => ({ inicio: b.start, fin: b.end }));
}

export interface CanalWatch {
  id: string;
  resourceId: string;
  expirationMs: number | null;
}

/** Suscribe un canal de notificaciones push (`events.watch`). Google avisa a `address` cuando algo cambia. */
export async function iniciarWatch(
  accessToken: string,
  calendarId: string,
  args: { canalId: string; address: string; tokenCanal?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<CanalWatch> {
  const res = await fetchImpl(`${API}/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: args.canalId, type: "web_hook", address: args.address, token: args.tokenCanal }),
  });
  await comprobar(res, "watch");
  const json = (await res.json()) as { resourceId: string; expiration?: string };
  return { id: args.canalId, resourceId: json.resourceId, expirationMs: json.expiration ? Number(json.expiration) : null };
}

export async function pararWatch(
  accessToken: string,
  canal: { id: string; resourceId: string },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(`${API}/channels/stop`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: canal.id, resourceId: canal.resourceId }),
  });
  if (res.status === 404 || res.ok) return;
  await comprobar(res, "stop-watch");
}
