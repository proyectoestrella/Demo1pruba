import { describe, expect, it } from "bun:test";
import { buscarTodos, buscarUno, parsearMultistatus, tieneEtiqueta } from "./xml-minimo";

const MULTISTATUS_CALENDARIOS = `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:CS="http://calendarserver.org/ns/" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/123456/calendars/home/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Casa</D:displayname>
        <D:resourcetype><D:collection/><C:calendar/></D:resourcetype>
        <CS:getctag>"ctag-abc-1"</CS:getctag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/123456/calendars/inbox/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Inbox</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

const MULTISTATUS_ETAGS = `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/123456/calendars/home/</D:href>
    <D:propstat><D:prop/><D:status>HTTP/1.1 200 OK</D:status></D:propstat>
  </D:response>
  <D:response>
    <D:href>/123456/calendars/home/evt-1.ics</D:href>
    <D:propstat>
      <D:prop><D:getetag>"etag-1"</D:getetag></D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/123456/calendars/home/evt-borrado.ics</D:href>
    <D:propstat>
      <D:prop/>
      <D:status>HTTP/1.1 404 Not Found</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

describe("buscarTodos / buscarUno", () => {
  it("ignora el prefijo de namespace", () => {
    expect(buscarUno("<d:href>/a/b</d:href>", "href")).toBe("/a/b");
    expect(buscarUno("<href>/a/b</href>", "href")).toBe("/a/b");
  });

  it("reconoce una etiqueta autocerrada", () => {
    expect(tieneEtiqueta("<D:collection/>", "collection")).toBe(true);
    expect(tieneEtiqueta("<D:calendar/>", "resourcetype")).toBe(false);
  });

  it("buscarTodos devuelve todas las apariciones", () => {
    expect(buscarTodos(MULTISTATUS_CALENDARIOS, "href")).toHaveLength(2);
  });
});

describe("parsearMultistatus", () => {
  it("separa cada response y solo trae las props del propstat 200", () => {
    const rs = parsearMultistatus(MULTISTATUS_CALENDARIOS);
    expect(rs).toHaveLength(2);
    expect(rs[0].href).toBe("/123456/calendars/home/");
    expect(buscarUno(rs[0].propsOk, "displayname")).toBe("Casa");
    expect(tieneEtiqueta(rs[0].propsOk, "collection")).toBe(true);
    expect(buscarUno(rs[0].propsOk, "getctag")).toBe('"ctag-abc-1"');
  });

  it("distingue un calendario real (con C:calendar) de la inbox", () => {
    const rs = parsearMultistatus(MULTISTATUS_CALENDARIOS);
    const esCalendario = (r: (typeof rs)[number]) => tieneEtiqueta(r.propsOk, "calendar");
    expect(rs.filter(esCalendario)).toHaveLength(1);
    expect(rs.filter(esCalendario)[0].href).toBe("/123456/calendars/home/");
  });

  it("una respuesta 404 no aporta props (evento ya borrado)", () => {
    const rs = parsearMultistatus(MULTISTATUS_ETAGS);
    const borrado = rs.find((r) => r.href.includes("evt-borrado"));
    expect(borrado?.propsOk).toBe("");
  });

  it("saca el etag de cada recurso", () => {
    const rs = parsearMultistatus(MULTISTATUS_ETAGS);
    const evento = rs.find((r) => r.href.includes("evt-1.ics"));
    expect(buscarUno(evento!.propsOk, "getetag")).toBe('"etag-1"');
  });
});
