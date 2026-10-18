/**
 * Funciones de servidor PÚBLICAS (sin sesión a propósito): getDosierQr y
 * lookupGoogleMaps. Se ejecutan las reales; la red se sustituye por un doble.
 */
import { afterEach, describe, expect, it, mock } from "bun:test";
import { instalarDobleStart, llamar } from "./doble-start";

mock.module("@tanstack/react-start/server", () => ({
  getRequestHeader: () => undefined,
  getRequestUrl: () => new URL("https://sishow.test/s/x"),
}));
instalarDobleStart();
const { getDosierQr } = await import("./dosier-qr.functions");
const { lookupGoogleMaps, esAcortadorGoogle, expandShortLink } = await import("./maps.functions");

describe("getDosierQr (público): entrada", () => {
  it("rechaza vacío, rutas externas y rutas absurdamente largas", async () => {
    for (const path of ["", "//evil.example/x", "/\\evil.example", "https://evil.example", "@evil", "/" + "a".repeat(2900)]) {
      await expect(llamar(getDosierQr, { path })).rejects.toThrow();
    }
    await expect(llamar(getDosierQr, {})).rejects.toThrow();
  });
  it("una ruta interna normal da la URL absoluta del propio dominio", async () => {
    const r = await llamar<{ absoluteUrl: string; dataUri: string }>(getDosierQr, { path: "/s/peluchic?d=abc" });
    expect(r.absoluteUrl).toBe("https://sishow.test/s/peluchic?d=abc");
    expect(r.dataUri.startsWith("data:image/png;base64,")).toBe(true);
  });
});

describe("lookupGoogleMaps (público): SSRF y entrada", () => {
  const original = globalThis.fetch;
  afterEach(() => { globalThis.fetch = original; });

  it("solo sigue acortadores de Google por https", () => {
    expect(esAcortadorGoogle("https://maps.app.goo.gl/abc")).toBe(true);
    expect(esAcortadorGoogle("https://goo.gl/maps/abc")).toBe(true);
    expect(esAcortadorGoogle("https://share.google/abc")).toBe(true);
    for (const malo of [
      "http://169.254.169.254/latest/meta-data/?x=goo.gl",
      "http://localhost:3000/?u=maps.app",
      "https://goo.gl.evil.example/x",
      "https://evil.example/g.co/",
      "https://user:pw@goo.gl/x",
      "http://goo.gl/x",
      "no es una url goo.gl",
    ]) expect(esAcortadorGoogle(malo)).toBe(false);
  });

  it("NO hace ninguna petición de red para un host que no es de Google", async () => {
    const pedir = mock(async () => new Response("", { status: 200 }));
    const url = "http://169.254.169.254/latest/meta-data/?x=goo.gl";
    expect(await expandShortLink(url, pedir as never)).toBe(url);
    expect(pedir).not.toHaveBeenCalled();
  });

  it("la función completa tampoco sale a la red con un host interno", async () => {
    const f = mock(async () => new Response("", { status: 200 }));
    globalThis.fetch = f as never;
    const r = await llamar<{ source: string; notice?: string }>(lookupGoogleMaps, { url: "http://127.0.0.1:8080/?goo.gl" });
    expect(f).not.toHaveBeenCalled();
    expect(r.source).toBe("url");
  });

  it("entrada inválida: vacío o sin url", async () => {
    await expect(llamar(lookupGoogleMaps, { url: "" })).rejects.toThrow();
    await expect(llamar(lookupGoogleMaps, {})).rejects.toThrow();
  });
});
