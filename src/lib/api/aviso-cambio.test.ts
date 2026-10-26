/** «Tu cita ha cambiado» sin repeticiones (26-oct tarde): mover, deshacer, volver a la hora avisada. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";
import { salon } from "../mock/salon";

let doble = crearDobleSupabase({});
const enviados: Array<{ para: string; asunto: string }> = [];
const gerente = { tipo: "miembro", userId: "u1", rol: "gerente", employeeId: null, displayName: "María" };
const m1 = await mockTransitorio("../supabase.server", { getSupabaseServerClient: () => doble as never });
const m2 = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: (() => undefined) as never,
  getRequestUrl: (() => new URL("https://sishow.test/x")) as never,
});
const m3 = await mockTransitorio("./autorizacion.server", {
  exigirAcceso: (async () => gerente) as never,
  acceso: (async () => gerente) as never,
  exigirAccesoOdemo: (async () => gerente) as never,
});
// Correo: proveedor Resend con un fetch de mentira (sin red): cada envío queda en `enviados`.
const fetchReal = globalThis.fetch;
const entornoPrevio = { RESEND_API_KEY: process.env.RESEND_API_KEY, REMINDER_FROM_EMAIL: process.env.REMINDER_FROM_EMAIL };
beforeAll(() => {
  m1.activar(); m2.activar(); m3.activar();
  process.env.RESEND_API_KEY = "prueba"; process.env.REMINDER_FROM_EMAIL = "PeluChic <a@b.es>";
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    const cuerpo = JSON.parse(init?.body ?? "{}");
    enviados.push({ para: String(cuerpo.to), asunto: String(cuerpo.subject) });
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  }) as typeof fetch;
});
afterAll(() => {
  m1.desactivar(); m2.desactivar(); m3.desactivar();
  globalThis.fetch = fetchReal;
  process.env.RESEND_API_KEY = entornoPrevio.RESEND_API_KEY; process.env.REMINDER_FROM_EMAIL = entornoPrevio.REMINDER_FROM_EMAIL;
  if (entornoPrevio.RESEND_API_KEY === undefined) delete process.env.RESEND_API_KEY;
  if (entornoPrevio.REMINDER_FROM_EMAIL === undefined) delete process.env.REMINDER_FROM_EMAIL;
});
instalarDobleStart();
const S = await import("./salons.functions?avisocambio");

const dentro = (dias: number, hora: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + dias); d.setUTCHours(hora, 0, 0, 0); return d.toISOString(); };
beforeEach(() => {
  enviados.length = 0;
  doble = crearDobleSupabase({
    salons: [{ slug: "real", profile: { ...salon, name: "PeluChic", phone: "666 77 67 31" } }],
    clients: [{ id: "c1", salon_slug: "real", name: "Lucía", phone: "+34600111222", phone_key: "600111222", email: "lucia@x.es" }],
    appointments: [{ id: "a1", salon_slug: "real", local_id: "l1", client_id: "c1", client_name: "Lucía", employee_id: "e", service_id: "", start_at: dentro(3, 9), duration_min: 30, status: "confirmed" }],
  });
});
const mover = (startISO: string, deshacer = false) =>
  llamar<{ synced: boolean }>(S.syncAppointmentPatch, { slug: "real", localId: "l1", patch: { start: startISO }, permitirSolape: true, ...(deshacer ? { origen: "deshacer" } : {}) });

describe("aviso de cambio de hora", () => {
  it("mover → un correo; deshacer justo después → otro correo (ya sabía la hora nueva); deshacer sin aviso previo → ninguno", async () => {
    await mover(dentro(3, 10));
    expect(enviados).toHaveLength(1);
    await mover(dentro(3, 9), true);
    expect(enviados).toHaveLength(2);
  });
  it("volver a la hora ya avisada no repite el correo", async () => {
    await mover(dentro(3, 10));
    await mover(dentro(3, 11));
    await mover(dentro(3, 11));
    expect(enviados).toHaveLength(2);
    await mover(dentro(3, 11));
    expect(enviados).toHaveLength(2);
  });
  it("un deshacer de un cambio del que no se avisó no manda nada", async () => {
    await mover(dentro(3, 9), true);
    expect(enviados).toHaveLength(0);
  });
});
