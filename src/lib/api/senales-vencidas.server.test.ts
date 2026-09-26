import { describe, expect, it } from "bun:test";
import { liberarSenalesVencidasDeTodos } from "./senales-vencidas.server";

/**
 * Mismo criterio que el resto de funciones que hablan con Supabase de
 * verdad (ver el comentario de `salons.functions.guardia.test.ts`): sin
 * `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` en el entorno de pruebas,
 * `getSupabaseServerClient()` devuelve `null` y esto se resuelve con
 * `motivo: "sin-backend"` en vez de reventar. La lógica de qué se libera y
 * qué no —`revisarVencimiento` / `resolverCancelacion`— ya está probada a
 * fondo en `senal-ciclo.test.ts`; aquí solo se comprueba el envoltorio.
 */
describe("liberarSenalesVencidasDeTodos (sin Supabase configurado en el entorno de pruebas)", () => {
  it("no revienta y dice que falta el backend", async () => {
    const r = await liberarSenalesVencidasDeTodos();
    expect(r).toEqual({ revisadas: 0, liberadas: 0, salones: 0, motivo: "sin-backend" });
  });
});
