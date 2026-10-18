/** M3 (auditoría independiente 18-oct-2026): el plan y los flags de plan no los cambia el navegador. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";

let cabecera: string | null = null;
let doble = crearDobleSupabase({});
const m1 = await mockTransitorio("../supabase.server", { getSupabaseServerClient: () => doble as never });
const m2 = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: ((n: string) => (n.toLowerCase() === "authorization" ? (cabecera ?? undefined) : undefined)) as never,
  getRequestUrl: (() => new URL("https://sishow.test/x")) as never,
});
beforeAll(() => { m1.activar(); m2.activar(); });
afterAll(() => { m1.desactivar(); m2.desactivar(); });
instalarDobleStart();
const S = await import("./salons.functions?doble");

const perfilBase = () => ({ name: "Salón", plan: "reservas", phone: "600" });
beforeEach(() => {
  cabecera = "Bearer tk-ana";
  doble = crearDobleSupabase(
    {
      salons: [{ slug: "real", profile: perfilBase() }],
      salon_members: [{ user_id: "ana", salon_slug: "real", rol: "gerente", estado: "activa" }],
      perfil_versiones: [{ id: "version-antigua-1", salon_slug: "real", perfil: { name: "Viejo", plan: "todo-incluido", calendariosExternosActivo: true }, fecha: "2026-01-01T00:00:00Z" }],
    },
    { tokens: { "tk-ana": "ana" } },
  );
});
const guardado = () => (doble.tablas.salons[0].profile as Record<string, unknown>);

describe("la gerente NO puede darse un plan mejor", () => {
  it("patchSalonProfile con otro plan: rechazado y el plan no cambia", async () => {
    await expect(llamar(S.patchSalonProfile, { slug: "real", patch: { plan: "todo-incluido" } })).rejects.toThrow();
    expect(guardado().plan).toBe("reservas");
  });
  it("patchSalonProfile con el flag de calendarios externos: rechazado", async () => {
    await expect(llamar(S.patchSalonProfile, { slug: "real", patch: { calendariosExternosActivo: true } })).rejects.toThrow();
    expect(guardado().calendariosExternosActivo).toBeUndefined();
  });
  it("patchSalonProfile con el MISMO plan (eco del navegador) no falla", async () => {
    const r = await llamar<{ synced: boolean }>(S.patchSalonProfile, { slug: "real", patch: { plan: "reservas", phone: "611" } });
    expect(r.synced).toBe(true);
    expect(guardado().phone).toBe("611");
  });
  it("saveSalonProfile con el perfil entero y otro plan: se guarda el resto, el plan se conserva", async () => {
    await llamar(S.saveSalonProfile, { slug: "real", profile: { name: "Nuevo", plan: "todo-incluido", calendariosExternosActivo: true } });
    expect(guardado().name).toBe("Nuevo");
    expect(guardado().plan).toBe("reservas");
    expect(guardado().calendariosExternosActivo).toBeUndefined();
  });
  it("restaurarVersion de una versión con plan superior no sube el plan", async () => {
    doble.tablas.salons[0].profile = { ...perfilBase(), plan: "todo-incluido" };
    doble.tablas.salons[0].profile = { ...perfilBase(), plan: "todo-incluido" };
    await llamar(S.restaurarVersion, { slug: "real", versionId: "version-antigua-1" });
    expect(guardado().name).toBe("Viejo");
    expect(guardado().plan).toBe("todo-incluido"); // el que tenía ahora, no el de la versión
    expect(guardado().calendariosExternosActivo).toBeUndefined();
  });
});
