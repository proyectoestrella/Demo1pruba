/**
 * Cliente CalDAV mínimo, sobre `fetch`, para iCloud (Apple no tiene webhooks:
 * se sondea cada 5 min desde el cron — ver `src/routes/api.calendario-externo.cron.ts`).
 *
 * Por qué no `tsdav`: ver docs/contrato-calendarios.md §7.
 *
 * Flujo de descubrimiento estándar de CalDAV (RFC 4791 / RFC 5397):
 *   1. PROPFIND en la raíz → `current-user-principal`.
 *   2. PROPFIND en el principal → `calendar-home-set`.
 *   3. PROPFIND (Depth:1) en el home → los calendarios, cada uno con su ctag.
 *
 * Sincronización con ctag/etag (v1; sync-collection queda para más adelante):
 *   - Se guarda el `ctag` del calendario. Si no ha cambiado, no hay nada que
 *     traer y no se listan recursos.
 *   - Si cambió, PROPFIND (Depth:1) sobre el calendario trae href+etag de
 *     CADA evento; comparado con lo que se tenía guardado (`calendario_mapeo_eventos`
 *     / `calendario_bloqueos_externos`) salen los añadidos, cambiados y
 *     borrados (los que ya no aparecen en la lista).
 */
import { buscarUno, parsearMultistatus, tieneEtiqueta } from "./xml-minimo";

export interface CredencialCalDAV {
  appleId: string;
  appPassword: string;
  /** Por defecto `https://caldav.icloud.com`; parametrizable para tests u otro proveedor CalDAV. */
  baseUrl?: string;
}

const BASE_POR_DEFECTO = "https://caldav.icloud.com";

function cabeceras(cred: CredencialCalDAV, extra: Record<string, string> = {}): Record<string, string> {
  const auth = Buffer.from(`${cred.appleId}:${cred.appPassword}`).toString("base64");
  return { Authorization: `Basic ${auth}`, ...extra };
}

/** Credenciales rechazadas por el servidor: se distingue de un fallo de red para dar el mensaje correcto. */
export class CredencialCalDAVInvalida extends Error {}
/** El servidor no ha respondido bien (red, 5xx…): distinto de credenciales malas. */
export class CalDAVNoDisponible extends Error {}

async function propfind(
  url: string,
  cred: CredencialCalDAV,
  cuerpo: string,
  depth: "0" | "1",
  fetchImpl: typeof fetch,
): Promise<string> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "PROPFIND",
      headers: cabeceras(cred, { Depth: depth, "Content-Type": "application/xml; charset=utf-8" }),
      body: cuerpo,
    });
  } catch (err) {
    throw new CalDAVNoDisponible(`No se pudo conectar con ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 401 || res.status === 403) throw new CredencialCalDAVInvalida("Credenciales rechazadas por iCloud.");
  if (!res.ok && res.status !== 207) throw new CalDAVNoDisponible(`iCloud respondió ${res.status} en ${url}.`);
  return res.text();
}

export interface CalendarioDescubierto {
  href: string;
  displayName: string | null;
  ctag: string | null;
}

/**
 * Descubre el primer calendario "de verdad" (no la agenda de tareas, no la
 * inbox de invitaciones) de la cuenta. Es lo único que necesita v1: conectar
 * el calendario principal de la profesional.
 */
export async function descubrirCalendarioPrincipal(
  cred: CredencialCalDAV,
  fetchImpl: typeof fetch = fetch,
): Promise<CalendarioDescubierto | null> {
  const base = cred.baseUrl ?? BASE_POR_DEFECTO;

  const xmlPrincipal = await propfind(
    base,
    cred,
    `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`,
    "0",
    fetchImpl,
  );
  const principal = buscarUno(parsearMultistatus(xmlPrincipal)[0]?.propsOk ?? "", "current-user-principal");
  const principalHref = principal ? buscarUno(principal, "href") : null;
  if (!principalHref) return null;

  const xmlHome = await propfind(
    new URL(principalHref, base).toString(),
    cred,
    `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`,
    "0",
    fetchImpl,
  );
  const homeSet = buscarUno(parsearMultistatus(xmlHome)[0]?.propsOk ?? "", "calendar-home-set");
  const homeHref = homeSet ? buscarUno(homeSet, "href") : null;
  if (!homeHref) return null;

  const xmlCalendarios = await propfind(
    new URL(homeHref, base).toString(),
    cred,
    `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/"><d:prop><d:displayname/><d:resourcetype/><cs:getctag/></d:prop></d:propfind>`,
    "1",
    fetchImpl,
  );
  const respuestas = parsearMultistatus(xmlCalendarios);
  const calendarios = respuestas.filter((r) => tieneEtiqueta(r.propsOk, "calendar") && !tieneEtiqueta(r.propsOk, "schedule-inbox"));
  if (!calendarios.length) return null;
  const elegido = calendarios[0];
  return {
    href: elegido.href,
    displayName: buscarUno(elegido.propsOk, "displayname"),
    ctag: buscarUno(elegido.propsOk, "getctag"),
  };
}

/** El ctag actual del calendario, para saber si hace falta listar recursos. */
export async function leerCtag(cred: CredencialCalDAV, calendarHref: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const base = cred.baseUrl ?? BASE_POR_DEFECTO;
  const xml = await propfind(
    new URL(calendarHref, base).toString(),
    cred,
    `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/"><d:prop><cs:getctag/></d:prop></d:propfind>`,
    "0",
    fetchImpl,
  );
  return buscarUno(parsearMultistatus(xml)[0]?.propsOk ?? "", "getctag");
}

export interface RecursoCalDAV {
  href: string;
  etag: string;
}

/** href + etag de cada evento del calendario (Depth:1). No trae el contenido. */
export async function listarRecursos(cred: CredencialCalDAV, calendarHref: string, fetchImpl: typeof fetch = fetch): Promise<RecursoCalDAV[]> {
  const base = cred.baseUrl ?? BASE_POR_DEFECTO;
  const xml = await propfind(
    new URL(calendarHref, base).toString(),
    cred,
    `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/></d:prop></d:propfind>`,
    "1",
    fetchImpl,
  );
  return parsearMultistatus(xml)
    .filter((r) => r.href !== calendarHref && !r.href.endsWith("/") && buscarUno(r.propsOk, "getetag"))
    .map((r) => ({ href: r.href, etag: buscarUno(r.propsOk, "getetag")! }));
}

/** El VEVENT completo de un recurso (para leer sus fechas al importar un bloqueo). */
export async function leerEvento(cred: CredencialCalDAV, href: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const base = cred.baseUrl ?? BASE_POR_DEFECTO;
  let res: Response;
  try {
    res = await fetchImpl(new URL(href, base).toString(), { method: "GET", headers: cabeceras(cred) });
  } catch (err) {
    throw new CalDAVNoDisponible(`No se pudo leer ${href}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 401 || res.status === 403) throw new CredencialCalDAVInvalida("Credenciales rechazadas por iCloud.");
  if (!res.ok) throw new CalDAVNoDisponible(`iCloud respondió ${res.status} al leer ${href}.`);
  return res.text();
}

/**
 * Escribe (crea o actualiza) un VEVENT. `etagPrevio` evita pisar un cambio
 * hecho a mano en Apple entre que se leyó y se escribió (`If-Match`); en una
 * creación no se manda (`If-None-Match: *`, no pisa uno que ya exista con
 * ese nombre de recurso).
 */
export async function guardarEvento(
  cred: CredencialCalDAV,
  href: string,
  icsBody: string,
  etagPrevio: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<{ etag: string | null }> {
  const base = cred.baseUrl ?? BASE_POR_DEFECTO;
  const headers = cabeceras(cred, { "Content-Type": "text/calendar; charset=utf-8" });
  if (etagPrevio) headers["If-Match"] = etagPrevio;
  else headers["If-None-Match"] = "*";
  let res: Response;
  try {
    res = await fetchImpl(new URL(href, base).toString(), { method: "PUT", headers, body: icsBody });
  } catch (err) {
    throw new CalDAVNoDisponible(`No se pudo escribir ${href}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 401 || res.status === 403) throw new CredencialCalDAVInvalida("Credenciales rechazadas por iCloud.");
  if (res.status === 412) throw new ConflictoEtag(href);
  if (!res.ok) throw new CalDAVNoDisponible(`iCloud respondió ${res.status} al guardar ${href}.`);
  return { etag: res.headers.get("etag") };
}

export class ConflictoEtag extends Error {
  constructor(readonly href: string) {
    super(`El evento ${href} cambió en iCloud desde la última lectura (ETag no coincide).`);
  }
}

export async function borrarEventoCalDAV(
  cred: CredencialCalDAV,
  href: string,
  etagPrevio: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const base = cred.baseUrl ?? BASE_POR_DEFECTO;
  const headers = cabeceras(cred);
  if (etagPrevio) headers["If-Match"] = etagPrevio;
  let res: Response;
  try {
    res = await fetchImpl(new URL(href, base).toString(), { method: "DELETE", headers });
  } catch (err) {
    throw new CalDAVNoDisponible(`No se pudo borrar ${href}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 404 || res.ok) return;
  if (res.status === 401 || res.status === 403) throw new CredencialCalDAVInvalida("Credenciales rechazadas por iCloud.");
  throw new CalDAVNoDisponible(`iCloud respondió ${res.status} al borrar ${href}.`);
}
