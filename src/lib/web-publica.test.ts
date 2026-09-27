import { describe, expect, test } from "bun:test";
import { enlaceWhatsApp, enlacesDelSalon, listaConY, notaEs, numeroWhatsApp, precioDeCarta, urlSegura } from "./web-publica";

describe("web pública", () => {
  test("lista con «y» antes del último", () => {
    expect(listaConY(["novias", "madrinas", "eventos"])).toBe("novias, madrinas y eventos");
    expect(listaConY(["color"])).toBe("color");
    expect(listaConY([" ", ""])).toBe("");
  });
  test("nota con coma decimal", () => {
    expect(notaEs(4.5)).toBe("4,5");
    expect(notaEs(5)).toBe("5");
  });
});

describe("enlaces del salón (lote 18.4)", () => {
  test("solo http(s): un javascript: o una ruta rota no llegan al href", () => {
    expect(urlSegura("https://peluchic.online/tienda")).toBe("https://peluchic.online/tienda");
    expect(urlSegura("javascript:alert(1)")).toBeUndefined();
    expect(urlSegura("peluchic.online")).toBeUndefined();
    expect(urlSegura("  ")).toBeUndefined();
  });

  test("lo que falta no aparece; Instagram cae al usuario de siempre", () => {
    expect(enlacesDelSalon({})).toEqual({});
    expect(enlacesDelSalon({ instagram: "@peluchicprofesional" })).toEqual({
      instagram: "https://www.instagram.com/peluchicprofesional",
    });
    expect(
      enlacesDelSalon({
        instagram: "@otro",
        enlaces: { blog: "https://peluchic.online/", facebook: "javascript:void(0)", instagram: "https://www.instagram.com/peluchicprofesional" },
      }),
    ).toEqual({ blog: "https://peluchic.online/", instagram: "https://www.instagram.com/peluchicprofesional" });
  });

  test("número de WhatsApp: prefijo 34 a un número español de 9 cifras", () => {
    expect(numeroWhatsApp("+34 666 77 67 31")).toBe("34666776731");
    expect(numeroWhatsApp("666 77 67 31")).toBe("34666776731");
    expect(numeroWhatsApp("0034 666776731")).toBe("34666776731");
    expect(numeroWhatsApp("")).toBeUndefined();
    expect(numeroWhatsApp("123")).toBeUndefined();
  });

  test("enlace de WhatsApp: el del perfil manda sobre el teléfono, con texto prellenado", () => {
    const url = enlaceWhatsApp({ whatsapp: "+34 666 77 67 31", phone: "910 000 000", name: "PeluChic" });
    expect(url?.startsWith("https://wa.me/34666776731?text=")).toBe(true);
    expect(decodeURIComponent(url!.split("text=")[1])).toBe("Hola, PeluChic. Os escribo desde vuestra web de reservas.");
    expect(enlaceWhatsApp({ phone: "666 77 67 31", name: "PeluChic" })?.startsWith("https://wa.me/34666776731?")).toBe(true);
    expect(enlaceWhatsApp({ name: "PeluChic" })).toBeUndefined();
  });
});

describe("precio de la carta (lote 18.5)", () => {
  test("el literal del salón manda; si no, el importe sin decimales de relleno", () => {
    expect(precioDeCarta({ priceEur: 150, priceText: "desde 150 € (sin IVA)" })).toBe("desde 150\u00a0€ (sin IVA)");
    expect(precioDeCarta({ priceEur: 43.5, priceText: "43,50 € / 47,50 €" })).toBe("43,50\u00a0€ / 47,50\u00a0€");
    expect(precioDeCarta({ priceEur: 25 })).toBe("25\u00a0€");
    expect(precioDeCarta({ priceEur: 28.5 })).toBe("28,50\u00a0€");
    expect(precioDeCarta({ priceEur: 1250 })).toBe("1250\u00a0€");
    expect(precioDeCarta({ priceEur: 20, priceText: "  " })).toBe("20\u00a0€");
  });
});
