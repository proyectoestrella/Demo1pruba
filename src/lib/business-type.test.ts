import { describe, expect, it } from "bun:test";
import { BUSINESS_LABEL, BUSINESS_TYPES, categoryOrderFor, categoryOrderOf, EMPLOYEE_OVERLAY, EXAMPLE_CLIENT_NOTES, FEATURED_IDS_BY_TYPE, FIRST_NAMES_BY_TYPE, formatMenuEntry, formatTeamEntry, fotoDeProfesional, inferBusinessType, parseMenuEntry, parseTeamEntry, professionalWord, SERVICE_CATALOG, showsRealPhotos, slugForId, menuDesdeServicios } from "./business-type";

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

  it("un salón REAL nunca enseña una foto de stock: avatar de iniciales", () => {
    const foto = fotoDeProfesional("Adam", "mario", "/stock/mario.jpg", "barberia", true);
    expect(foto.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(foto)).toContain(">A<");
  });

  it("una demo de barbería sigue enseñando la foto de ejemplo de siempre", () => {
    expect(fotoDeProfesional("Mario", "mario", "/stock/mario.jpg", "barberia", false)).toBe(
      "/stock/mario.jpg",
    );
  });

  it("fuera de barbería, iniciales aunque sea una demo", () => {
    const foto = fotoDeProfesional("Marta", "mario", "/stock/mario.jpg", "peluqueria", false);
    expect(foto.startsWith("data:image/svg+xml")).toBe(true);
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

  it("la lista de nombres de barbería no lleva nombres femeninos", () => {
    // Los servicios de barba y afeitado se reparten al azar entre los
    // clientes: un nombre de mujer con «Arreglo de barba» delata la demo.
    const FEMENINOS = [
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
      "Aitana",
    ];
    expect(FIRST_NAMES_BY_TYPE.barberia.filter((n) => FEMENINOS.includes(n))).toEqual([]);
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

describe("categoryOrderOf", () => {
  it("da el mismo resultado que categoryOrderFor para el catálogo de un tipo", () => {
    for (const tipo of BUSINESS_TYPES) {
      expect(categoryOrderOf(SERVICE_CATALOG[tipo])).toEqual(categoryOrderFor(tipo));
    }
  });
});

describe("parseTeamEntry / formatTeamEntry", () => {
  it("acepta solo el nombre", () => {
    expect(parseTeamEntry("Adam")).toEqual({ name: "Adam" });
  });

  it("acepta nombre y especialidad", () => {
    expect(parseTeamEntry("Adam~Cortes y afeitado clásico")).toEqual({
      name: "Adam",
      specialty: "Cortes y afeitado clásico",
    });
  });

  it("descarta una entrada sin nombre", () => {
    expect(parseTeamEntry("")).toBeNull();
    expect(parseTeamEntry("~Especialidad sin nombre")).toBeNull();
  });

  it("recorta nombre y especialidad a una longitud razonable", () => {
    const nombreLargo = "A".repeat(200);
    const entry = parseTeamEntry(`${nombreLargo}~${"B".repeat(200)}`);
    expect(entry?.name.length).toBeLessThanOrEqual(60);
    expect(entry?.specialty?.length).toBeLessThanOrEqual(80);
  });

  it("formatTeamEntry es el inverso de parseTeamEntry", () => {
    expect(formatTeamEntry({ name: "Adam" })).toBe("Adam");
    expect(formatTeamEntry({ name: "Adam", specialty: "Navaja" })).toBe("Adam~Navaja");
  });
});

describe("parseMenuEntry / formatMenuEntry", () => {
  it("acepta nombre, minutos y precio", () => {
    expect(parseMenuEntry("Corte~30~13")).toEqual({
      name: "Corte",
      durationMin: 30,
      priceEur: 13,
      category: undefined,
    });
  });

  it("acepta categoría y precio con coma decimal", () => {
    expect(parseMenuEntry("Corte~30~13,5~Cortes")).toEqual({
      name: "Corte",
      durationMin: 30,
      priceEur: 13.5,
      category: "Cortes",
    });
  });

  it("descarta minutos fuera de 5–240", () => {
    expect(parseMenuEntry("Corte~4~13")).toBeNull();
    expect(parseMenuEntry("Corte~241~13")).toBeNull();
    expect(parseMenuEntry("Corte~30~13")).not.toBeNull();
  });

  it("descarta un precio negativo o no numérico", () => {
    expect(parseMenuEntry("Corte~30~-1")).toBeNull();
    expect(parseMenuEntry("Corte~30~gratis")).toBeNull();
  });

  it("descarta una entrada sin los tres campos mínimos", () => {
    expect(parseMenuEntry("Corte~30")).toBeNull();
    expect(parseMenuEntry("Corte")).toBeNull();
  });

  it("formatMenuEntry es el inverso de parseMenuEntry", () => {
    expect(formatMenuEntry({ name: "Corte", durationMin: 30, priceEur: 13 })).toBe("Corte~30~13");
    expect(
      formatMenuEntry({ name: "Corte", durationMin: 30, priceEur: 13, category: "Cortes" }),
    ).toBe("Corte~30~13~Cortes");
  });
});

describe("slugForId", () => {
  it("genera un id legible sin acentos ni símbolos", () => {
    expect(slugForId("Corte + barba")).toBe("corte-barba");
    expect(slugForId("Afeitado a navaja")).toBe("afeitado-a-navaja");
    expect(slugForId("  ¡Peinado!  ")).toBe("peinado");
  });

  it("nunca devuelve una cadena vacía", () => {
    expect(slugForId("!!!")).toBe("servicio");
  });
});

describe("carta con servicios apagados y vuelta desde los servicios del panel", () => {
  it("un quinto campo «off» marca el servicio como apagado y se conserva al formatear", () => {
    const entrada = parseMenuEntry("Mechas~90~60~Color~off");
    expect(entrada).toEqual({ name: "Mechas", durationMin: 90, priceEur: 60, category: "Color", active: false });
    expect(formatMenuEntry(entrada!)).toBe("Mechas~90~60~Color~off");
    expect(formatMenuEntry({ name: "Corte", durationMin: 30, priceEur: 15, active: false })).toBe("Corte~30~15~~off");
    expect(parseMenuEntry("Corte~30~15~~off")).toEqual({ name: "Corte", durationMin: 30, priceEur: 15, active: false });
  });

  it("una entrada sin quinto campo sigue siendo activa y no cambia de formato", () => {
    expect(parseMenuEntry("Corte~30~15")).toEqual({ name: "Corte", durationMin: 30, priceEur: 15 });
    expect(formatMenuEntry({ name: "Corte", durationMin: 30, priceEur: 15, category: "Cortes" })).toBe("Corte~30~15~Cortes");
  });

  it("menuDesdeServicios escribe lo que el panel tiene, sin la categoría de relleno", () => {
    const menu = menuDesdeServicios([
      { name: "Corte", durationMin: 30, priceEur: 15, category: "Servicios", active: true },
      { name: "Mechas", durationMin: 90, priceEur: 60, category: "Color", active: false },
    ]);
    expect(menu).toEqual(["Corte~30~15", "Mechas~90~60~Color~off"]);
  });
});
