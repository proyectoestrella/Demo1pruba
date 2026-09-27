import { describe, expect, test } from "bun:test";
import { enlaceWhatsapp, precioPuestaEnMarcha, PRECIOS, ENLACE_WEB_EJEMPLO, ENLACE_PANEL_EJEMPLO, DEMO_WEB_URL, DEMO_PANEL_URL, datosTitularPendientes, notaImpuestos, TITULAR } from "./sishow-web";
import { decodeDemoProfile } from "./demo-profile";

describe("web de siShow", () => {
  test("puesta en marcha: 5 h × 18 € = 90 €, 45 € con el anual", () => {
    expect(precioPuestaEnMarcha(false)).toBe(90);
    expect(precioPuestaEnMarcha(true)).toBe(45);
  });
  test("precios de los tres planes, anual y mensual", () => {
    expect(PRECIOS.reservas).toEqual({ anual: 36, mensual: 40 });
    expect(PRECIOS["reservas-asistente"]).toEqual({ anual: 42, mensual: 47 });
    expect(PRECIOS["todo-incluido"]).toEqual({ anual: 55, mensual: 59 });
  });
  test("WhatsApp: con el marcador no hay enlace; con número, wa.me", () => {
    expect(enlaceWhatsapp()).toBeNull();
    expect(enlaceWhatsapp("+34 600 00 00 00")).toStartWith("https://wa.me/34600000000?text=");
  });
  test("los enlaces de ejemplo llevan el perfil de PeluChic", () => {
    for (const enlace of [ENLACE_WEB_EJEMPLO, ENLACE_PANEL_EJEMPLO]) {
      const d = new URL(enlace, "https://x").searchParams.get("d") ?? undefined;
      expect(decodeDemoProfile(d)?.name).toBe("PeluChic");
    }
  });
  test("la demo de la web oficial: web del salón y panel de PeluChic", () => {
    expect(DEMO_WEB_URL).toBe("/s/peluchic");
    expect(DEMO_PANEL_URL).toBe("/demo/peluchic");
  });
  test("titular: sin datos, se ve lo que falta; el registro no es obligatorio", () => {
    expect(datosTitularPendientes({ nombre: null, nif: null, domicilio: null, registro: null })).toEqual([
      "nombre o razón social",
      "NIF",
      "domicilio",
    ]);
    expect(datosTitularPendientes({ nombre: "X", nif: "Y", domicilio: "Z", registro: null })).toEqual([]);
    // Mientras Tomás no los dé, siguen sin inventarse.
    expect(TITULAR.nif).toBeNull();
  });
  test("IVA: sin decidir no hay nota; decidido, una frase", () => {
    expect(notaImpuestos(null)).toBeNull();
    expect(notaImpuestos(true)).toContain("incluido");
    expect(notaImpuestos(false)).toContain("sin IVA");
  });
});
