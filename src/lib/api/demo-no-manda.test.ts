/**
 * A1 y A2 de la auditoría independiente (18-oct-2026): "demo" NO es "este
 * slug no existe en salons". Quien no tiene sesión no puede escribir bajo un
 * slug inexistente, ni bajo uno real si la consulta a `salons` falla.
 * Se ejecutan las funciones reales con un Supabase de mentira.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";

let cabecera: string | null = null;
let doble = crearDobleSupabase({});
let sinBackend = false;
const m1 = await mockTransitorio("../supabase.server", { getSupabaseServerClient: () => (sinBackend ? null : doble) as never });
const m2 = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: ((n: string) => (n.toLowerCase() === "authorization" ? (cabecera ?? undefined) : undefined)) as never,
  getRequestUrl: (() => new URL("https://sishow.test/x")) as never,
});
beforeAll(() => { m1.activar(); m2.activar(); });
afterAll(() => { m1.desactivar(); m2.desactivar(); });
instalarDobleStart();
const S = await import("./salons.functions?doble");
const P = await import("./pagos.functions?doble");

const futuro = new Date(Date.now() + 3 * 86_400_000).toISOString();
beforeEach(() => {
  cabecera = null;
  sinBackend = false;
  doble = crearDobleSupabase({ salons: [{ slug: "real", profile: {} }] }, { tokens: {} });
});

const ESCRITURAS: Array<[string, () => Promise<unknown>]> = [
  ["saveSalonProfile", () => llamar(S.saveSalonProfile, { slug: "no-existe", profile: { name: "x" } })],
  ["saveClient", () => llamar(S.saveClient, { slug: "no-existe", name: "Ana", phone: "600111222" })],
  ["deleteAppointment", () => llamar(S.deleteAppointment, { slug: "no-existe", localId: "l1" })],
  ["syncWaitlistEntry", () => llamar(S.syncWaitlistEntry, { slug: "no-existe", localId: "w1", clientName: "Ana" })],
  ["deleteWaitlistEntry", () => llamar(S.deleteWaitlistEntry, { slug: "no-existe", localId: "w1" })],
  ["applyClientPenalty", () => llamar(S.applyClientPenalty, { slug: "no-existe", phone: "600111222", eur: 10 })],
  ["saveClientNotes", () => llamar(S.saveClientNotes, { slug: "no-existe", phone: "600111222", notes: "x" })],
  ["patchSalonProfile", () => llamar(S.patchSalonProfile, { slug: "no-existe", patch: { name: "x" } })],
  ["listarPagos", () => llamar(P.listarPagos, { slug: "no-existe", desde: "2026-01-01", hasta: "2026-12-31" })],
  ["cerrarCaja", () => llamar(P.cerrarCaja, { slug: "no-existe", fecha: "2026-10-18" })],
];

describe("A1: un slug inexistente NO da mando a quien llama sin sesión", () => {
  for (const [nombre, f] of ESCRITURAS) {
    it(`${nombre} no escribe ni lee nada`, async () => {
      await f().catch(() => undefined);
      expect(doble.escrituras).toHaveLength(0);
      expect(doble.consultas.filter((c) => c.tabla !== "salons")).toHaveLength(0);
    });
  }

  it("la reserva pública (syncAppointment) a un slug inexistente no crea cita ni clienta", async () => {
    const r = await llamar<{ synced: boolean }>(S.syncAppointment, {
      slug: "no-existe", localId: "l1", clientName: "Ana", clientPhone: "600111222", serviceIds: [],
      employeeId: "e1", startISO: futuro, durationMin: 30, priceEur: 10, status: "pending", privacyNoticeAccepted: true,
    });
    expect(r.synced).toBe(false);
    expect(doble.escrituras).toHaveLength(0);
  });
});

describe("A2: si falla la consulta a salons, se deniega (no se degrada a demo)", () => {
  it("un salón REAL con error en salons: ni perfil ni citas ni clientes se escriben", async () => {
    doble = crearDobleSupabase({ salons: [{ slug: "real" }] }, { errorEn: { salons: "timeout" } });
    for (const f of [
      () => llamar(S.saveSalonProfile, { slug: "real", profile: { name: "pisado" } }),
      () => llamar(S.deleteAppointment, { slug: "real", localId: "l1" }),
      () => llamar(S.saveClient, { slug: "real", name: "Ana", phone: "600111222" }),
    ]) await expect(f()).rejects.toThrow(/No tienes acceso/);
    expect(doble.escrituras).toHaveLength(0);
  });
});

describe("la demo sigue funcionando para quien la usa", () => {
  it("sin Supabase, accesoAlPanel dice demo (real:false) y deja entrar", async () => {
    sinBackend = true;
    const r = await llamar<{ real: boolean; permitido: boolean }>(S.accesoAlPanel, { slug: "peluchic" });
    expect(r).toMatchObject({ real: false, permitido: true });
  });
  it("sin Supabase, listSalonData de una demo devuelve vacío sin lanzar", async () => {
    sinBackend = true;
    const r = await llamar<{ appointments: unknown[] }>(S.listSalonData, { slug: "peluchic", vista: "panel" });
    expect(r.appointments).toEqual([]);
  });
});
