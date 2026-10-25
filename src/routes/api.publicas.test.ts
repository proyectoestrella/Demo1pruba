/**
 * Rutas de servidor públicas: autenticación por secreto/token. Se ejecutan
 * los handlers reales; solo se sustituyen Supabase y los trabajos que
 * enviarían correos o sincronizarían calendarios.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "@/lib/api/doble-supabase";
import { mockTransitorio } from "@/lib/api/doble-start";

let doble = crearDobleSupabase({});
let trabajos = { recordatorios: 0, senales: 0, polling: 0, notificacionesGoogle: 0 };
const TOKEN_CANAL = "token-watch-de-prueba";
const ms = [
  await mockTransitorio("@/lib/supabase.server", { getSupabaseServerClient: () => doble as never }),
  await mockTransitorio("@/lib/api/recordatorios.server", {
    enviarRecordatoriosDeManana: (async () => { trabajos.recordatorios++; return { enviados: 0 }; }) as never,
    leerFiltroRecordatorios: (() => ({})) as never,
  }),
  await mockTransitorio("@/lib/api/senales-vencidas.server", {
    liberarSenalesVencidasDeTodos: (async () => { trabajos.senales++; return { liberadas: 0 }; }) as never,
  }),
  await mockTransitorio("@/lib/calendario-externo/calendario-externo.server", {
    sincronizarPollingDeRespaldo: (async () => { trabajos.polling++; return { procesadas: 0, errores: 0 }; }) as never,
    procesarNotificacionGoogle: (async (_canal: string, token: string) => {
      if (token !== TOKEN_CANAL) return false;
      trabajos.notificacionesGoogle++;
      return true;
    }) as never,
  }),
];
beforeAll(() => ms.forEach((m) => m.activar()));
afterAll(() => ms.forEach((m) => m.desactivar()));

const rutas = {
  recordatorios: (await import("./api.recordatorios")).Route,
  senales: (await import("./api.senales-vencidas")).Route,
  cron: (await import("./api.calendario-externo.cron")).Route,
  calendario: (await import("./api.calendario")).Route,
  webhookGoogle: (await import("./api.calendario-externo.google.webhook")).Route,
};
const handlers = (r: unknown) => (r as { options: { server: { handlers: Record<string, (c: { request: Request }) => Promise<Response>> } } }).options.server.handlers;

const SECRETO = "secreto-de-prueba-123";
const original = process.env.CRON_SECRET;
beforeEach(() => { trabajos = { recordatorios: 0, senales: 0, polling: 0, notificacionesGoogle: 0 }; });
afterEach(() => { if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original; });

const pedir = (r: unknown, url: string, init?: RequestInit, m: "GET" | "POST" = "GET") =>
  handlers(r)[m]({ request: new Request(url, { method: m, ...init }) });

describe.each([["recordatorios", "/api/recordatorios", "recordatorios"], ["senales", "/api/senales-vencidas", "senales"], ["cron", "/api/calendario-externo/cron", "polling"]] as const)("cron %s", (nombre, ruta, contador) => {
  const u = `https://sishow.test${ruta}`;
  it("sin CRON_SECRET en el entorno: 401 aunque se mande vacío y no ejecuta nada", async () => {
    delete process.env.CRON_SECRET;
    expect((await pedir(rutas[nombre], u)).status).toBe(401);
    expect((await pedir(rutas[nombre], `${u}?token=`)).status).toBe(401);
    expect((await pedir(rutas[nombre], u, { headers: { authorization: "Bearer " } })).status).toBe(401);
    expect(trabajos[contador]).toBe(0);
  });
  it("secreto ausente, erróneo o de otra longitud: 401", async () => {
    process.env.CRON_SECRET = SECRETO;
    for (const req of [[u], [`${u}?token=mal`], [`${u}?token=${SECRETO}x`], [u, { headers: { authorization: "Bearer otro" } }], [u, { headers: { authorization: SECRETO } }]] as const)
      expect((await pedir(rutas[nombre], req[0], req[1] as RequestInit | undefined)).status).toBe(401);
    expect(trabajos[contador]).toBe(0);
  });
  it("solo Authorization Bearer admite el secreto; ?token= no lo ejecuta", async () => {
    process.env.CRON_SECRET = SECRETO;
    expect((await pedir(rutas[nombre], u, { headers: { authorization: `Bearer ${SECRETO}` } })).status).toBe(200);
    expect((await pedir(rutas[nombre], `${u}?token=${SECRETO}`, undefined, "POST")).status).toBe(401);
    expect(trabajos[contador]).toBe(1);
  });
});

describe("webhook Google: token del canal", () => {
  const url = "https://sishow.test/api/calendario-externo/google/webhook";

  it("rechaza la notificación sin X-Goog-Channel-Token y no sincroniza", async () => {
    const r = await pedir(rutas.webhookGoogle, url, { headers: { "x-goog-channel-id": "canal-1" } }, "POST");
    expect(r.status).toBe(401);
    expect(trabajos.notificacionesGoogle).toBe(0);
  });

  it("solo sincroniza cuando el token del canal es válido", async () => {
    expect((await pedir(rutas.webhookGoogle, url, { headers: { "x-goog-channel-id": "canal-1", "x-goog-channel-token": "otro" } }, "POST")).status).toBe(401);
    expect((await pedir(rutas.webhookGoogle, url, { headers: { "x-goog-channel-id": "canal-1", "x-goog-channel-token": TOKEN_CANAL } }, "POST")).status).toBe(200);
    expect(trabajos.notificacionesGoogle).toBe(1);
  });
});

describe("/api/calendario (feed ICS por token)", () => {
  const TA = "A".repeat(43), TB = "B".repeat(43);
  const perfil = { name: "Salón A", tagline: "peluquería", menu: [] };
  // Fechas relativas: con fechas fijas el test caducaba al pasar el día (ventana del feed = desde ahora).
  const enDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
  beforeEach(() => {
    doble = crearDobleSupabase({
      calendar_subscriptions: [{ salon_slug: "a", token: TA }, { salon_slug: "b", token: TB }],
      salons: [{ slug: "a", profile: perfil }, { slug: "b", profile: { ...perfil, name: "Salón B" } }],
      appointments: [
        { id: "1", local_id: "l1", salon_slug: "a", client_name: "Clienta de A", service_id: "", employee_id: "e", start_at: enDias(1), duration_min: 30, status: "confirmed" },
        { id: "2", local_id: "l2", salon_slug: "b", client_name: "Clienta de B", service_id: "", employee_id: "e", start_at: enDias(1), duration_min: 30, status: "confirmed" },
        { id: "3", local_id: "l3", salon_slug: "a", client_name: "Cancelada de A", service_id: "", employee_id: "e", start_at: enDias(2), duration_min: 30, status: "cancelled" },
        { id: "4", local_id: "historica", salon_slug: "a", client_name: "Clienta histórica", service_id: "", employee_id: "e", start_at: "2000-01-01T09:00:00Z", duration_min: 30, status: "confirmed" },
        { id: "5", local_id: "lejana", salon_slug: "a", client_name: "Clienta lejana", service_id: "", employee_id: "e", start_at: "2099-01-01T09:00:00Z", duration_min: 30, status: "confirmed" },
      ],
    });
  });
  const feed = (q: string) => pedir(rutas.calendario, `https://sishow.test/api/calendario${q}`);

  it("sin token, con token corto, con caracteres raros o profesional inválida: 404", async () => {
    for (const q of ["", "?token=", "?token=abc", `?token=${"A".repeat(42)}`, `?token=${"A".repeat(43)}%00`, `?token=${TA}&profesional=../x`]) {
      const r = await feed(q);
      expect(r.status).toBe(404);
      expect(r.headers.get("cache-control")).toBe("no-store");
    }
  });
  it("token con forma válida pero desconocido: 404 (no distingue de inexistente)", async () => {
    expect((await feed(`?token=${"C".repeat(43)}`)).status).toBe(404);
  });
  it("token del salón A: solo citas próximas, confirmadas y sin datos de clienta o servicio", async () => {
    const r = await feed(`?token=${TA}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const ics = await r.text();
    expect(ics).toContain("UID:l1@sishow");
    expect(ics).not.toContain("l2@sishow");
    expect(ics).not.toContain("l3@sishow");
    expect(ics).not.toContain("historica@sishow");
    expect(ics).not.toContain("lejana@sishow");
    expect(ics).not.toContain("Clienta de A");
    expect(ics).not.toContain("Servicio");
    const citas = doble.consultas.find((c) => c.tabla === "appointments")!;
    expect(citas.filtros).toContainEqual(["salon_slug", "a"]);
  });
  it("enlace personal firmado (25-oct noche): solo sus citas, con servicio y sin clienta; manipularlo da 404", async () => {
    const { firmaCalendarioProfesional } = await import("@/lib/calendario-firma.server");
    doble.tablas.appointments.push(
      { id: "6", local_id: "deotra", salon_slug: "a", client_name: "Clienta de otra", service_id: "", employee_id: "otra", start_at: enDias(1), duration_min: 30, status: "confirmed" },
    );
    const k = await firmaCalendarioProfesional(TA, "a", "e");
    const r = await feed(`?s=a&profesional=e&k=${k}`);
    expect(r.status).toBe(200);
    const ics = await r.text();
    expect(ics).toContain("UID:l1@sishow");
    expect(ics).not.toContain("deotra@sishow");
    expect(ics).not.toContain("Clienta");
    // Validación estructural iCalendar (RFC 5545): CRLF, pares BEGIN/END, campos obligatorios y líneas ≤ 75 octetos.
    const lineas = ics.split("\r\n");
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(lineas[0]).toBe("BEGIN:VCALENDAR");
    expect(lineas.filter((l) => l === "BEGIN:VEVENT").length).toBe(lineas.filter((l) => l === "END:VEVENT").length);
    for (const l of lineas) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    // Con la firma de «e» no se ve a «otra» ni se puede usar con otro salón.
    expect((await feed(`?s=a&profesional=otra&k=${k}`)).status).toBe(404);
    expect((await feed(`?s=b&profesional=e&k=${k}`)).status).toBe(404);
    expect((await feed(`?s=a&profesional=e&k=${"A".repeat(43)}`)).status).toBe(404);
  });
  it("error de la base: 503 sin detalles", async () => {
    doble = crearDobleSupabase({}, { errorEn: { calendar_subscriptions: "relación secreta" } });
    const r = await feed(`?token=${TA}`);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("secreta");
  });
});
