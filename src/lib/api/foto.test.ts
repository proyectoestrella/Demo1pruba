import { describe, expect, it } from "bun:test";
import { servirFoto } from "./foto";

const pedir = (r: () => Response | Promise<Response>) => (async () => r()) as unknown as typeof fetch;
const req = (q: string) => new Request(`https://x.test/api/foto${q}`);

describe("api/foto con entradas malas: 4xx con mensaje, nunca 500", () => {
  it("sin place o con caracteres raros: 400", async () => {
    for (const q of ["", "?place=", "?place=%27%22%3C%3E", "?place=a b"]) {
      expect((await servirFoto(req(q), "k", pedir(() => new Response("")))).status).toBe(400);
    }
  });

  it("un ID que Google no conoce (400/404 de Google): 404, no 502", async () => {
    for (const s of [400, 404]) {
      const r = await servirFoto(req("?place=ChIJ_inexistente"), "k", pedir(() => new Response("", { status: s })));
      expect(r.status).toBe(404);
      expect(await r.text()).toContain("no existe");
    }
  });

  it("Google caído (500) sigue siendo 502: esa avería no es culpa de quien pide", async () => {
    expect((await servirFoto(req("?place=ChIJ_valido"), "k", pedir(() => new Response("", { status: 500 })))).status).toBe(502);
  });

  it("si la red hacia Google revienta, 502 con mensaje en vez de un 500 sin cuerpo", async () => {
    const r = await servirFoto(req("?place=ChIJ_valido"), "k", pedir(() => { throw new TypeError("fetch failed"); }));
    expect(r.status).toBe(502);
    expect(await r.text()).toContain("Google");
  });

  it("índice de foto absurdo (NaN, negativo, enorme) no revienta: se acota", async () => {
    for (const i of ["NaN", "-5", "99999999999999999999"]) {
      const r = await servirFoto(req(`?place=ChIJ_valido&i=${i}`), "k", pedir(() => Response.json({ photos: [] })));
      expect(r.status).toBe(404);
    }
  });

  it("sin clave configurada: 503 con mensaje", async () => {
    expect((await servirFoto(req("?place=ChIJ_valido"), undefined, pedir(() => new Response("")))).status).toBe(503);
  });
});

describe("api/foto con &w= (lote 16)", () => {
  const conFoto = (urls: string[]) =>
    (async (u: string | URL | Request) => {
      urls.push(String(u));
      return String(u).includes("/media")
        ? new Response("img", { headers: { "content-type": "image/jpeg" } })
        : Response.json({ photos: [{ name: "places/X/photos/F" }] });
    }) as unknown as typeof fetch;

  it("pide a Google el ancho indicado, acotado a 320-1600, y 1600 por defecto", async () => {
    for (const [q, esperado] of [["", 1600], ["&w=800", 800], ["&w=100", 320], ["&w=9999", 1600], ["&w=abc", 1600]] as const) {
      const urls: string[] = [];
      const r = await servirFoto(req(`?place=ChIJ_valido${q}`), "k", conFoto(urls));
      expect(r.status).toBe(200);
      expect(urls[1]).toContain(`maxWidthPx=${esperado}&`);
      expect(r.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    }
  });
});
