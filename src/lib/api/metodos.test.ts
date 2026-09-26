import { describe, expect, it } from "bun:test";
import { soloMetodos } from "./metodos";

const ctx = (method: string) => ({ request: new Request("https://x.test/api/algo", { method }) });

describe("rutas api/*: método no declarado → 405, no la portada con 200", () => {
  const h = soloMetodos({ GET: async () => new Response("hola", { status: 200, headers: { "X-A": "1" } }) });

  it("PUT, DELETE y PATCH: 405 con Allow", async () => {
    for (const m of ["PUT", "DELETE", "PATCH", "POST"]) {
      const r = await h.ANY(ctx(m));
      expect(r.status).toBe(405);
      expect(r.headers.get("Allow")).toBe("GET, HEAD");
      expect(await r.json()).toEqual({ error: "método no permitido" });
    }
  });

  it("HEAD responde como el GET, sin cuerpo", async () => {
    const r = await h.ANY(ctx("HEAD"));
    expect(r.status).toBe(200);
    expect(r.headers.get("X-A")).toBe("1");
    expect(await r.text()).toBe("");
  });

  it("una ruta solo POST no inventa HEAD", async () => {
    const p = soloMetodos({ POST: async () => new Response(null) });
    const r = await p.ANY(ctx("HEAD"));
    expect(r.status).toBe(405);
    expect(r.headers.get("Allow")).toBe("POST");
  });
});
