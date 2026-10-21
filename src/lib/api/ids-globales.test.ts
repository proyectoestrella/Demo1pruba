/** B8: un id global ajeno nunca puede aparentar que se ha guardado. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase, tokenConSesion } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";

let doble = crearDobleSupabase({});
let cabecera: string | null = null;
const dbMock = await mockTransitorio("@/lib/supabase.server", { getSupabaseServerClient: () => doble as never });
const cabecerasMock = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: ((nombre: string) => nombre.toLowerCase() === "authorization" ? cabecera ?? undefined : undefined) as never,
});
beforeAll(() => { dbMock.activar(); cabecerasMock.activar(); });
afterAll(() => { dbMock.desactivar(); cabecerasMock.desactivar(); });
instalarDobleStart();
const pagos = await import("./pagos.functions?ids-globales");
const cambios = await import("./cambios.functions?ids-globales");

beforeEach(() => {
  cabecera = `Bearer ${tokenConSesion("tk-gerente")}`;
  doble = crearDobleSupabase({
    salons: [{ slug: "propio", profile: {} }],
    salon_members: [{ user_id: "gerente", salon_slug: "propio", rol: "gerente", estado: "activa" }],
    payments: [{ id: "id-global-ajeno", salon_slug: "ajeno" }],
    cambios: [{ id: "id-cambio-ajeno", salon_slug: "ajeno" }],
  }, { tokens: { "tk-gerente": "gerente" } });
});

describe("B8: colisión de PK de otro salón", () => {
  it("registrarPago devuelve guardado:false y no toca el pago ajeno", async () => {
    const r = await llamar<{ guardado: boolean }>(pagos.registrarPago, {
      slug: "propio",
      pago: { id: "id-global-ajeno", importeEur: 12, metodo: "efectivo", concepto: "servicio", fecha: "2026-10-18" },
    });
    expect(r).toEqual({ guardado: false });
    expect(doble.tablas.payments).toHaveLength(1);
  });

  it("guardarCambio tampoco confirma una inserción que colisiona con otro salón", async () => {
    const r = await llamar<{ guardado: boolean }>(cambios.guardarCambio, {
      slug: "propio",
      cambio: { id: "id-cambio-ajeno", tipo: "cita.cancelar", entidad: "cita", idEntidad: "cita-1", antes: { status: "confirmed" }, despues: { status: "cancelled" }, resumen: "Cancelar", fecha: "2026-10-18T10:00:00Z" },
    });
    expect(r.guardado).toBe(false);
    expect(doble.tablas.cambios).toHaveLength(1);
  });
});
