import { describe, expect, it } from "bun:test";
import {
  CalDAVNoDisponible,
  CredencialCalDAVInvalida,
  borrarEventoCalDAV,
  descubrirCalendarioPrincipal,
  guardarEvento,
  leerCtag,
  listarRecursos,
} from "./apple-caldav";

const CRED = { appleId: "noelia@icloud.com", appPassword: "abcd-efgh-ijkl-mnop", baseUrl: "https://caldav.test" };

const XML_PRINCIPAL = `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:"><D:response><D:href>/</D:href>
  <D:propstat><D:prop><D:current-user-principal><D:href>/123/principal/</D:href></D:current-user-principal></D:prop>
  <D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>`;

const XML_HOME = `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:response><D:href>/123/principal/</D:href>
  <D:propstat><D:prop><C:calendar-home-set><D:href>/123/calendars/</D:href></C:calendar-home-set></D:prop>
  <D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>`;

const XML_CALENDARIOS = `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">
  <D:response><D:href>/123/calendars/inbox/</D:href>
    <D:propstat><D:prop><D:displayname>Inbox</D:displayname><D:resourcetype><D:collection/><C:schedule-inbox/></D:resourcetype></D:prop>
    <D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>
  <D:response><D:href>/123/calendars/home/</D:href>
    <D:propstat><D:prop><D:displayname>Casa</D:displayname><D:resourcetype><D:collection/><C:calendar/></D:resourcetype><CS:getctag>"ctag-1"</CS:getctag></D:prop>
    <D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>
</D:multistatus>`;

function xmlCtag(valor: string): string {
  return `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:" xmlns:CS="http://calendarserver.org/ns/">
  <D:response><D:href>/123/calendars/home/</D:href><D:propstat><D:prop><CS:getctag>"${valor}"</CS:getctag></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>
</D:multistatus>`;
}

const XML_RECURSOS = `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:">
  <D:response><D:href>/123/calendars/home/</D:href><D:propstat><D:prop/><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>
  <D:response><D:href>/123/calendars/home/evt-1.ics</D:href><D:propstat><D:prop><D:getetag>"etag-1"</D:getetag></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>
</D:multistatus>`;

function fetchFalso(guion: Array<(url: string, init?: RequestInit) => { status: number; body?: string; headers?: Record<string, string> }>) {
  let i = 0;
  const llamadas: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init });
    const r = guion[Math.min(i++, guion.length - 1)](url, init);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => r.body ?? "",
      headers: new Headers(r.headers ?? {}),
    } as Response;
  }) as typeof fetch;
  return { impl, llamadas };
}

describe("descubrirCalendarioPrincipal", () => {
  it("encadena principal → home → calendarios y elige el que tiene C:calendar (no la inbox)", async () => {
    const { impl, llamadas } = fetchFalso([
      () => ({ status: 207, body: XML_PRINCIPAL }),
      () => ({ status: 207, body: XML_HOME }),
      () => ({ status: 207, body: XML_CALENDARIOS }),
    ]);
    const r = await descubrirCalendarioPrincipal(CRED, impl);
    expect(r).toEqual({ href: "/123/calendars/home/", displayName: "Casa", ctag: '"ctag-1"' });
    expect(llamadas[0].init!.headers).toMatchObject({ Depth: "0" });
    expect((llamadas[0].init!.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
  });

  it("credenciales rechazadas: distingue 401 de un fallo de red", async () => {
    const { impl } = fetchFalso([() => ({ status: 401 })]);
    await expect(descubrirCalendarioPrincipal(CRED, impl)).rejects.toThrow(CredencialCalDAVInvalida);
  });

  it("un 5xx se reporta como servidor no disponible, no como credenciales malas", async () => {
    const { impl } = fetchFalso([() => ({ status: 503 })]);
    await expect(descubrirCalendarioPrincipal(CRED, impl)).rejects.toThrow(CalDAVNoDisponible);
  });

  it("sin calendario-home-set, devuelve null en vez de lanzar", async () => {
    const { impl } = fetchFalso([
      () => ({ status: 207, body: XML_PRINCIPAL }),
      () => ({ status: 207, body: `<D:multistatus xmlns:D="DAV:"></D:multistatus>` }),
    ]);
    expect(await descubrirCalendarioPrincipal(CRED, impl)).toBeNull();
  });
});

describe("ctag y recursos", () => {
  it("leerCtag detecta el cambio de ctag entre dos sondeos", async () => {
    const { impl: impl1 } = fetchFalso([() => ({ status: 207, body: xmlCtag("ctag-1") })]);
    const ctag1 = await leerCtag(CRED, "/123/calendars/home/", impl1);
    const { impl: impl2 } = fetchFalso([() => ({ status: 207, body: xmlCtag("ctag-2") })]);
    const ctag2 = await leerCtag(CRED, "/123/calendars/home/", impl2);
    expect(ctag1).toBe('"ctag-1"');
    expect(ctag2).toBe('"ctag-2"');
    expect(ctag1).not.toBe(ctag2);
  });

  it("listarRecursos trae href+etag de cada evento, sin la propia colección", async () => {
    const { impl } = fetchFalso([() => ({ status: 207, body: XML_RECURSOS })]);
    const recursos = await listarRecursos(CRED, "/123/calendars/home/", impl);
    expect(recursos).toEqual([{ href: "/123/calendars/home/evt-1.ics", etag: '"etag-1"' }]);
  });
});

describe("guardarEvento / borrarEventoCalDAV", () => {
  it("una creación manda If-None-Match: *", async () => {
    const { impl, llamadas } = fetchFalso([() => ({ status: 201, headers: { etag: '"etag-nuevo"' } })]);
    const r = await guardarEvento(CRED, "/123/calendars/home/evt-2.ics", "BEGIN:VCALENDAR...", null, impl);
    expect(r.etag).toBe('"etag-nuevo"');
    expect((llamadas[0].init!.headers as Record<string, string>)["If-None-Match"]).toBe("*");
  });

  it("una actualización manda If-Match con el etag previo", async () => {
    const { impl, llamadas } = fetchFalso([() => ({ status: 204 })]);
    await guardarEvento(CRED, "/123/calendars/home/evt-1.ics", "BEGIN:VCALENDAR...", '"etag-1"', impl);
    expect((llamadas[0].init!.headers as Record<string, string>)["If-Match"]).toBe('"etag-1"');
  });

  it("un 412 es un conflicto de ETag, no un error genérico", async () => {
    const { impl } = fetchFalso([() => ({ status: 412 })]);
    await expect(guardarEvento(CRED, "/x.ics", "...", '"vieja"', impl)).rejects.toThrow(/ETag/);
  });

  it("borrar un evento ya borrado (404) no falla", async () => {
    const { impl } = fetchFalso([() => ({ status: 404 })]);
    await expect(borrarEventoCalDAV(CRED, "/x.ics", '"e"', impl)).resolves.toBeUndefined();
  });
});
