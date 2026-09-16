import { describe, expect, it } from "bun:test";
import {
  BUSINESS_LABEL,
  BUSINESS_TYPES,
  categoryOrderFor,
  EMPLOYEE_OVERLAY,
  EXAMPLE_CLIENT_NOTES,
  FEATURED_IDS_BY_TYPE,
  FIRST_NAMES_BY_TYPE,
  inferBusinessType,
  professionalWord,
  SERVICE_CATALOG,
  showsRealPhotos,
} from "./business-type";

describe("inferBusinessType", () => {
  it("reconoce una barbería por nombre o tagline", () => {
    expect(inferBusinessType("Barber hamza for men")).toBe("barberia");
    expect(inferBusinessType(undefined, "Barber hamza for men")).toBe("barberia");
    expect(inferBusinessType("Barbería clásica")).toBe("barberia");
    expect(inferBusinessType("Peluqueria Caballeros Jesús Moreno")).toBe("barberia");
  });

  it("reconoce estética por señales de uñas/belleza/spa", () => {
    expect(inferBusinessType("Nails & Body. Peluquería-Estética-Solarium.")).toBe("estetica");
    expect(inferBusinessType("Peluquería y estética")).toBe("estetica");
  });

  it("reconoce unisex antes que peluquería genérica", () => {
    expect(inferBusinessType("Peluquería unisex")).toBe("unisex");
  });

  it("cae en peluquería para el resto de señales de peluquería", () => {
    expect(inferBusinessType("Vannity Peluquería")).toBe("peluqueria");
    expect(inferBusinessType("JF estilistas")).toBe("peluqueria");
    expect(inferBusinessType("Peluqueria de Señoras")).toBe("peluqueria");
  });

  it("nunca cae en barbería por defecto: sin pistas, peluquería", () => {
    expect(inferBusinessType("Zitada")).toBe("peluqueria");
    expect(inferBusinessType(undefined)).toBe("peluqueria");
    expect(inferBusinessType("")).toBe("peluqueria");
  });
});

describe("catálogo de servicios por tipo", () => {
  const idsComunes = ["corte", "corte-barba", "barba", "afeitado", "infantil", "cejas"];

  it("todos los tipos cubren los ids que usan las citas de ejemplo del seed", () => {
    for (const tipo of BUSINESS_TYPES) {
      const ids = new Set(SERVICE_CATALOG[tipo].map((s) => s.id));
      for (const id of idsComunes) {
        expect(ids.has(id)).toBe(true);
      }
    }
  });

  it("una barbería no ofrece manicura ni servicios de peluquería de señoras", () => {
    const nombres = SERVICE_CATALOG.barberia.map((s) => s.name.toLowerCase()).join(" ");
    expect(nombres).not.toMatch(/manicura|keratina|balayage|mechas/);
  });

  it("peluquería y estética no hablan de barba ni afeitado", () => {
    for (const tipo of ["peluqueria", "estetica"] as const) {
      const nombres = SERVICE_CATALOG[tipo].map((s) => s.name.toLowerCase()).join(" ");
      const descripciones = SERVICE_CATALOG[tipo].map((s) => s.description.toLowerCase()).join(" ");
      expect(`${nombres} ${descripciones}`).not.toMatch(/barba|afeitad|navaja/);
    }
  });

  it("estética añade manicura, pedicura y depilación sobre el catálogo de peluquería", () => {
    const ids = new Set(SERVICE_CATALOG.estetica.map((s) => s.id));
    expect(ids.has("manicura")).toBe(true);
    expect(ids.has("pedicura")).toBe(true);
    expect(ids.has("depilacion-cera")).toBe(true);
  });

  it("categoryOrderFor respeta el orden de aparición y no repite categorías", () => {
    for (const tipo of BUSINESS_TYPES) {
      const order = categoryOrderFor(tipo);
      expect(new Set(order).size).toBe(order.length);
      expect(order.length).toBeGreaterThan(0);
    }
  });

  it("los ids destacados de cada tipo existen en su propio catálogo", () => {
    for (const tipo of BUSINESS_TYPES) {
      const ids = new Set(SERVICE_CATALOG[tipo].map((s) => s.id));
      for (const id of FEATURED_IDS_BY_TYPE[tipo]) {
        expect(ids.has(id)).toBe(true);
      }
    }
  });
});

describe("equipo de ejemplo por tipo", () => {
  it("una peluquería de señoras muestra nombres femeninos plausibles", () => {
    const nombres = Object.values(EMPLOYEE_OVERLAY.peluqueria).map((e) => e.name);
    expect(nombres).toEqual(["Marta", "Elena", "Rocío"]);
  });

  it("solo la barbería enseña las fotos reales de stock", () => {
    expect(showsRealPhotos("barberia")).toBe(true);
    expect(showsRealPhotos("peluqueria")).toBe(false);
    expect(showsRealPhotos("estetica")).toBe(false);
    expect(showsRealPhotos("unisex")).toBe(false);
  });
});

describe("clientes de ejemplo por tipo", () => {
  it("la lista de nombres de peluquería es mayoritariamente femenina", () => {
    const FEMENINOS = new Set([
      "Sofia",
      "Lucia",
      "Carmen",
      "Valentina",
      "Elena",
      "Martina",
      "Adriana",
      "Camila",
      "Paula",
      "Daniela",
      "Isabella",
      "Renata",
      "Marta",
      "Nuria",
      "Cristina",
      "Alicia",
      "Laura",
      "Ana",
      "Beatriz",
      "Silvia",
    ]);
    const lista = FIRST_NAMES_BY_TYPE.peluqueria;
    const femeninos = lista.filter((n) => FEMENINOS.has(n)).length;
    expect(femeninos / lista.length).toBeGreaterThan(0.7);
  });

  it("cada tipo trae al menos una nota de cliente de ejemplo", () => {
    for (const tipo of BUSINESS_TYPES) {
      expect(EXAMPLE_CLIENT_NOTES[tipo].length).toBeGreaterThan(0);
    }
  });
});

describe("palabras y rótulos", () => {
  it("la palabra para la persona que atiende cambia con el tipo", () => {
    expect(professionalWord("barberia")).toBe("barbero");
    expect(professionalWord("peluqueria")).toBe("estilista");
    expect(professionalWord("estetica")).toBe("estilista");
    expect(professionalWord("unisex")).toBe("profesional");
    expect(professionalWord("barberia", true)).toBe("barberos");
  });

  it("BUSINESS_LABEL cubre los cuatro tipos con los rótulos que usa la demo", () => {
    expect(BUSINESS_LABEL.barberia).toBe("Barbería");
    expect(BUSINESS_LABEL.peluqueria).toBe("Peluquería");
    expect(BUSINESS_LABEL.estetica).toBe("Peluquería y estética");
    expect(BUSINESS_LABEL.unisex).toBe("Peluquería unisex");
  });
});
