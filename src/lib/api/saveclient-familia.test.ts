/**
 * Alta de una clienta con el teléfono de otra persona de la familia
 * (25-oct noche: Olga Carriches, código 000100, la dio de alta Anca a mano y
 * no quedó: el servidor la fundía con la titular del teléfono).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";
import { salon } from "../mock/salon";

let doble = crearDobleSupabase({});
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
beforeAll(() => { m1.activar(); m2.activar(); m3.activar(); });
afterAll(() => { m1.desactivar(); m2.desactivar(); m3.desactivar(); });
instalarDobleStart();
const S = await import("./salons.functions?familia");

beforeEach(() => {
  doble = crearDobleSupabase({
    salons: [{ slug: "real", profile: { ...salon } }],
    clients: [{ id: "c1", salon_slug: "real", name: "Ana López", phone: "+34600111222", phone_key: "600111222" }],
  });
});

describe("saveClient con teléfono de la familia", () => {
  it("crea la ficha de Olga aparte (mismo teléfono, sin phone_key) y no toca la de Ana", async () => {
    const r = await llamar<{ synced: boolean }>(S.saveClient, { slug: "real", name: "Olga Carriches", phone: "600111222" });
    expect(r.synced).toBe(true);
    expect(doble.tablas.clients.find((c) => c.id === "c1")).toMatchObject({ name: "Ana López", phone_key: "600111222" });
    expect(doble.tablas.clients.find((c) => c.name === "Olga Carriches")).toMatchObject({ phone_key: null, phone: "+34600111222" });
  });
  it("guardar otra vez a Olga no crea otra ficha", async () => {
    await llamar(S.saveClient, { slug: "real", name: "Olga Carriches", phone: "600111222" });
    await llamar(S.saveClient, { slug: "real", name: "Olga Carriches", phone: "600111222", email: "olga@x.es" });
    expect(doble.tablas.clients.filter((c) => c.name === "Olga Carriches")).toHaveLength(1);
  });
  it("la misma persona con su teléfono sigue siendo su ficha", async () => {
    await llamar(S.saveClient, { slug: "real", name: "Ana", phone: "600111222", email: "ana@x.es" });
    expect(doble.tablas.clients).toHaveLength(1);
  });
});
