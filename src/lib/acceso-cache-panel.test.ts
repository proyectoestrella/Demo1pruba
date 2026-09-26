import { describe, expect, test } from "bun:test";
import { crearCacheAcceso, FRESCURA_MS } from "./acceso-cache-panel";

describe("caché de acceso al panel", () => {
  test("solo pregunta al servidor la primera vez", async () => {
    let llamadas = 0;
    const c = crearCacheAcceso(async () => { llamadas++; return { real: true, permitido: true }; });
    await c.obtener("a");
    await c.obtener("a");
    await c.obtener("a");
    expect(llamadas).toBe(1);
  });
  test("dos peticiones simultáneas comparten la misma llamada", async () => {
    let llamadas = 0;
    const c = crearCacheAcceso(async () => { llamadas++; return { real: false, permitido: false }; });
    await Promise.all([c.obtener("a"), c.obtener("a")]);
    expect(llamadas).toBe(1);
  });
  test("con la respuesta vieja devuelve la guardada y avisa si se revoca", async () => {
    let t = 0;
    let permitido = true;
    const c = crearCacheAcceso(async () => ({ real: true, permitido }), () => t);
    await c.obtener("a");
    permitido = false;
    t = FRESCURA_MS + 1;
    let revocado = false;
    const r = await c.obtener("a", () => { revocado = true; });
    expect(r.permitido).toBe(true);
    await new Promise((z) => setTimeout(z, 0));
    expect(revocado).toBe(true);
    expect(c.guardado("a")?.permitido).toBe(false);
  });
  test("un fallo no se queda guardado", async () => {
    let n = 0;
    const c = crearCacheAcceso(async () => { n++; if (n === 1) throw new Error("x"); return { real: true, permitido: true }; });
    await expect(c.obtener("a")).rejects.toThrow();
    expect((await c.obtener("a")).permitido).toBe(true);
  });
});
