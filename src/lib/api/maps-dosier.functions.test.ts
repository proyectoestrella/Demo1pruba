/**
 * Funciones de servidor PÚBLICAS (sin sesión a propósito): getDosierQr y
 * lookupGoogleMaps. Se ejecutan las reales; la red se sustituye por un doble.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";

let cabeceras: Record<string, string> = { origin: "https://sishow.test", "x-forwarded-for": "9.9.9.9" };
const m2 = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: ((n: string) => cabeceras[n.toLowerCase()]) as never,
  getRequestUrl: (() => new URL("https://sishow.test/s/x")) as never,
});
beforeAll(() => m2.activar());
afterAll(() => m2.desactivar());
instalarDobleStart();
const { getDosierQr } = await import("./dosier-qr.functions?doble");
const { lookupGoogleMaps, esAcortadorGoogle, expandShortLink, esPeticionDelPropioOrigen } = await import("./maps.functions?doble");

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

describe("lookupGoogleMaps (público): origen y límite por IP", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    cabeceras = { origin: "https://sishow.test", "x-forwarded-for": "9.9.9.9" };
  });

  it("esPeticionDelPropioOrigen: solo el mismo origen", () => {
    const c = (h: Record<string, string>) => (n: string) => h[n];
    expect(esPeticionDelPropioOrigen(c({ origin: "https://sishow.test" }), "https://sishow.test")).toBe(true);
    expect(esPeticionDelPropioOrigen(c({ origin: "https://evil.example" }), "https://sishow.test")).toBe(false);
    expect(esPeticionDelPropioOrigen(c({ "sec-fetch-site": "same-origin" }), "https://sishow.test")).toBe(true);
    expect(esPeticionDelPropioOrigen(c({ "sec-fetch-site": "cross-site" }), "https://sishow.test")).toBe(false);
    expect(esPeticionDelPropioOrigen(c({}), "https://sishow.test")).toBe(false);
  });

  it("rechaza peticiones de otro origen o sin cabeceras, sin salir a la red", async () => {
    const f = mock(async () => new Response("", { status: 200 }));
    globalThis.fetch = f as never;
    for (const h of [{ origin: "https://evil.example" }, {}]) {
      cabeceras = h;
      await expect(llamar(lookupGoogleMaps, { url: "Barbería Pepe, Madrid" })).rejects.toThrow("no permitida");
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("entrada estricta: caracteres de control y exceso de longitud", async () => {
    await expect(llamar(lookupGoogleMaps, { url: "abc\u0000def" })).rejects.toThrow();
    await expect(llamar(lookupGoogleMaps, { url: "a\nb" })).rejects.toThrow();
    await expect(llamar(lookupGoogleMaps, { url: "a".repeat(2049) })).rejects.toThrow();
    await expect(llamar(lookupGoogleMaps, { url: "   " })).rejects.toThrow();
  });

  it("limita por IP: tras 40 consultas en la ventana corta, pero otra IP sigue", async () => {
    cabeceras = { origin: "https://sishow.test", "x-forwarded-for": "7.7.7.7" };
    for (let i = 0; i < 40; i++) await llamar(lookupGoogleMaps, { url: "texto sin enlace" });
    await expect(llamar(lookupGoogleMaps, { url: "texto sin enlace" })).rejects.toThrow("Demasiadas");
    cabeceras = { origin: "https://sishow.test", "x-forwarded-for": "8.8.8.8" };
    await llamar(lookupGoogleMaps, { url: "texto sin enlace" });
  });
});
