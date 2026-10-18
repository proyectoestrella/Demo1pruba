/**
 * A4 y M4 de la auditoría independiente (18-oct-2026): la reserva pública
 * (syncAppointment sin sesión) con la función real y un Supabase de mentira.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";
import { salon, employees } from "../mock/salon";
import { datosReservaPublicaDesdeCarta } from "../reserva-publica";

let doble = crearDobleSupabase({});
const m1 = await mockTransitorio("../supabase.server", { getSupabaseServerClient: () => doble as never });
const m2 = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: (() => undefined) as never,
  getRequestUrl: (() => new URL("https://sishow.test/x")) as never,
});
beforeAll(() => { m1.activar(); m2.activar(); });
afterAll(() => { m1.desactivar(); m2.desactivar(); });
instalarDobleStart();
const S = await import("./salons.functions?doble");

const perfil = { ...salon };
const servicio = (await import("../mock/salon")).servicesForType("barberia", perfil.menu)[0];
const datos = datosReservaPublicaDesdeCarta(perfil as never, [servicio.id])!;

/** Próximo martes a las 11:00 Madrid, aprox. (UTC+1/+2: se prueba 10:00Z). */
function proximoDia(dow: number, horaUTC = 10) {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + 3);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(horaUTC, 0, 0, 0);
  return d.toISOString();
}
const reserva = (extra: Record<string, unknown> = {}) => ({
  slug: "real", localId: `loc-${Math.random()}`, clientName: "Atacante", clientPhone: "600111222", clientEmail: "atacante@malo.test",
  serviceIds: [servicio.id], employeeId: employees[0].id, startISO: proximoDia(2), durationMin: datos.durationMin, priceEur: datos.priceEur,
  status: "pending", privacyNoticeAccepted: true, ...extra,
});

beforeEach(() => {
  doble = crearDobleSupabase({
    salons: [{ slug: "real", profile: perfil }],
    clients: [{ id: "c1", salon_slug: "real", name: "Marta Pérez", phone: "600 111 222", phone_key: "600111222", email: "marta@real.test" }],
  });
});

describe("A4: la reserva pública no pisa los datos de una clienta existente", () => {
  it("reservar con el teléfono de Marta no cambia su nombre ni su correo", async () => {
    const r = await llamar<{ synced: boolean; reason?: string }>(S.syncAppointment, reserva());
    expect(r.reason).toBeUndefined();
    expect(r.synced).toBe(true);
    const marta = doble.tablas.clients.find((c) => c.id === "c1")!;
    expect(marta.name).toBe("Marta Pérez");
    expect(marta.email).toBe("marta@real.test");
  });
});

describe("A4: una clienta nueva sí se crea con los datos que da", () => {
  it("teléfono desconocido: ficha nueva con su nombre", async () => {
    const r = await llamar<{ synced: boolean }>(S.syncAppointment, reserva({ clientPhone: "699888777", clientName: "Nueva", clientEmail: "n@x.test" }));
    expect(r.synced).toBe(true);
    expect(doble.tablas.clients.find((c) => c.phone_key === "699888777")).toMatchObject({ name: "Nueva", email: "n@x.test" });
  });
});
