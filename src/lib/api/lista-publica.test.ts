/** B5: la web pública solo necesita bloques próximos y anónimos. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";

let doble = crearDobleSupabase({});
const dbMock = await mockTransitorio("@/lib/supabase.server", { getSupabaseServerClient: () => doble as never });
const cabecerasMock = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: (() => undefined) as never,
  getRequestUrl: (() => new URL("https://sishow.test/s/real")) as never,
});
beforeAll(() => { dbMock.activar(); cabecerasMock.activar(); });
afterAll(() => { dbMock.desactivar(); cabecerasMock.desactivar(); });
instalarDobleStart();
const S = await import("./salons.functions?lista-publica");

beforeEach(() => {
  doble = crearDobleSupabase({
    salons: [{ slug: "real", profile: {} }],
    appointments: [
      { id: "pasada", local_id: "pasada", salon_slug: "real", client_id: "cliente-pasado", client_name: "Ana Pasada", service_id: "tinte", employee_id: "e1", start_at: "2000-01-01T10:00:00Z", duration_min: 45, price_eur: 80, status: "confirmed", deposit_due_at: "2000-01-01T12:00:00Z", deposit_period_hours: 2 },
      { id: "futura", local_id: "futura", salon_slug: "real", client_id: "cliente-futuro", client_name: "Ana Futura", service_id: "corte", employee_id: "e1", start_at: "2099-01-01T10:00:00Z", duration_min: 45, price_eur: 80, status: "confirmed", deposit_due_at: "2099-01-01T12:00:00Z", deposit_period_hours: 2 },
    ],
  });
});

describe("B5: listSalonData pública", () => {
  it("no expone el historial ni identificadores, servicio o datos de señal", async () => {
    const r = await llamar<{ appointments: Array<Record<string, unknown>> }>(S.listSalonData, { slug: "real", vista: "publica" });
    expect(r.appointments).toHaveLength(1);
    expect(r.appointments[0]).toMatchObject({ id: "futura", clientName: "Reservado", clientId: "", serviceIds: [] });
    expect(r.appointments[0].depositDueAt).toBeUndefined();
    expect(r.appointments[0].depositPeriodHours).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain("Ana Futura");
    expect(JSON.stringify(r)).not.toContain("cliente-futuro");
  });
});
