/** A3 (auditoría independiente 18-oct-2026): checkClientPenalty es pública y no puede devolver la ficha. */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";

let doble = crearDobleSupabase({});
const m1 = await mockTransitorio("../supabase.server", { getSupabaseServerClient: () => doble as never });
beforeAll(() => m1.activar());
afterAll(() => m1.desactivar());
instalarDobleStart();
const S = await import("./salons.functions?doble");

const fila = {
  id: "c-secreto", salon_slug: "s", name: "Marta Pérez", phone: "600 111 222", email: "marta@privado.test",
  notes: "NOTA-PRIVADA alergia tinte", penalty_eur: 15, penalty_note: "NOTA-PENAL no vino el 3", penalty_at: new Date().toISOString(),
  penalty_keep: false, penalty_block: true, manual_block: false, created_at: "2026-01-01T00:00:00Z", tax_id: "12345678Z", address: "C/ Calle 1",
};

describe("checkClientPenalty (pública)", () => {
  it("solo dice que está bloqueada: ni nombre, ni email, ni notas, ni id, ni DNI", async () => {
    doble = crearDobleSupabase({ clients: [fila] });
    const r = await llamar<{ client: Record<string, unknown> | null }>(S.checkClientPenalty, { slug: "s", phone: "600111222" });
    expect(r.client).not.toBeNull();
    const json = JSON.stringify(r);
    for (const secreto of ["Marta", "marta@privado", "NOTA-PRIVADA", "NOTA-PENAL", "c-secreto", "12345678Z", "Calle 1"]) expect(json).not.toContain(secreto);
    // Lo que la web de reservas necesita para decidir si bloquea:
    expect(r.client).toMatchObject({ penaltyEur: 15, manualBlock: false });
  });
  it("un teléfono sin deuda devuelve null", async () => {
    doble = crearDobleSupabase({ clients: [fila] });
    expect((await llamar<{ client: unknown }>(S.checkClientPenalty, { slug: "s", phone: "699999999" })).client).toBeNull();
  });
});
