import { describe, expect, it } from "bun:test";
import { inferTipo, limpiarNombre, parseMapsUrl } from "./maps.functions";

describe("parseMapsUrl", () => {
  it("saca nombre y coordenadas de un enlace largo", () => {
    const url =
      "https://www.google.com/maps/place/Barber%C3%ADa+Pepe/@40.4137913,-3.6944882,17z/data=!3m1!4b1";
    const out = parseMapsUrl(url);
    expect(out.name).toBe("Barbería Pepe");
    expect(out.lat).toBeCloseTo(40.4137913, 5);
    expect(out.lng).toBeCloseTo(-3.6944882, 5);
  });

  it("entiende los signos + como espacios", () => {
    const out = parseMapsUrl(
      "https://www.google.com/maps/place/Peluqueria+Los+Angeles/@40.4,-3.7,17z",
    );
    expect(out.name).toBe("Peluqueria Los Angeles");
  });

  it("conserva acentos y eñes codificados", () => {
    const out = parseMapsUrl(
      "https://www.google.com/maps/place/Peluquer%C3%ADa+Se%C3%B1or+Mu%C3%B1oz/@40.4,-3.7,17z",
    );
    expect(out.name).toBe("Peluquería Señor Muñoz");
  });

  it("no confunde una dirección con el nombre del sitio", () => {
    // Cuando no hay ficha, Google mete la dirección en el hueco del nombre.
    const out = parseMapsUrl(
      "https://www.google.com/maps/place/40.4137913,-3.6944882/@40.4,-3.7,17z",
    );
    expect(out.name).toBeUndefined();
    expect(out.lat).toBeCloseTo(40.4, 3);
  });

  it("entiende los enlaces de búsqueda del rutero (?api=1&query=Nombre, Dirección)", () => {
    const out = parseMapsUrl(
      "https://www.google.com/maps/search/?api=1&query=Artes%27ll%20barber%20shop%2C%20Calle%20de%20Mar%C3%ADa%20Tubau%2C%2019%2C%2028050%20Madrid",
    );
    expect(out.name).toBe("Artes'll barber shop, Calle de María Tubau, 19, 28050 Madrid");
  });

  it("entiende los enlaces de cómo llegar (?destination=)", () => {
    const out = parseMapsUrl(
      "https://www.google.com/maps/dir/?api=1&destination=Calle%20de%20Burguete%2C%2010%2C%2028050%20Madrid&travelmode=walking",
    );
    expect(out.name).toBe("Calle de Burguete, 10, 28050 Madrid");
  });

  it("acepta texto libre 'Nombre, Dirección' sin ser URL", () => {
    expect(parseMapsUrl("Barbería Pepe, Calle del Pez 23, Madrid").name).toBe(
      "Barbería Pepe, Calle del Pez 23, Madrid",
    );
  });

  it("funciona aunque falten las coordenadas", () => {
    const out = parseMapsUrl("https://www.google.com/maps/place/Barberia+Sur/");
    expect(out.name).toBe("Barberia Sur");
    expect(out.lat).toBeUndefined();
  });

  it("devuelve vacío con un enlace que no es de un sitio", () => {
    expect(parseMapsUrl("https://www.google.com/maps")).toEqual({});
    expect(parseMapsUrl("https://ejemplo.test/algo")).toEqual({});
  });

  it("no revienta con una dirección mal codificada", () => {
    const out = parseMapsUrl("https://www.google.com/maps/place/%E0%A4%A/@40.4,-3.7,17z");
    expect(out.lat).toBeCloseTo(40.4, 3);
  });
});

describe("limpiarNombre", () => {
  it("quita la coletilla de posicionamiento que muchos ponen en la ficha", () => {
    expect(limpiarNombre("HTB HAIR SALON | Barbería Alcalá de Henares")).toBe("HTB HAIR SALON");
    expect(limpiarNombre("Peluquería Ruiz · Estética y uñas")).toBe("Peluquería Ruiz");
  });

  it("corta también el guion con espacios, pero no el de dentro de una palabra", () => {
    expect(limpiarNombre("Quka Perez - Peluquería")).toBe("Quka Perez");
    expect(limpiarNombre("Silvia García Nails-Hair-Beauty")).toBe(
      "Silvia García Nails-Hair-Beauty",
    );
  });

  it("deja en paz un nombre normal", () => {
    expect(limpiarNombre("Barbería Pepe")).toBe("Barbería Pepe");
  });

  it("no se queda con un trozo inútil si el nombre empieza por el separador", () => {
    expect(limpiarNombre("A | Barbería del Centro")).toBe("A | Barbería del Centro");
  });
});

describe("inferTipo", () => {
  it("deduce el tipo de negocio del nombre", () => {
    expect(inferTipo("Barber Hamza for Men")).toBe("Barbería");
    expect(inferTipo("Peluquería Caballeros Jesús Moreno")).toBe("Barbería");
    // "Peluquería de señoras" se normaliza a la etiqueta canónica "Peluquería"
    // (ver lib/business-type.ts) en vez de a un rótulo aparte solo para ella.
    expect(inferTipo("Chispi Peluqueria de Señoras")).toBe("Peluquería");
    expect(inferTipo("A.R peluquería y estética")).toBe("Peluquería y estética");
    expect(inferTipo("JF estilistas")).toBe("Peluquería");
    expect(inferTipo("Nails & Body")).toBe("Peluquería y estética");
    expect(inferTipo("Salón unisex Los Ángeles")).toBe("Peluquería unisex");
    // Sin ninguna pista, nunca "Barbería" por defecto.
    expect(inferTipo("Zitada")).toBe("Peluquería");
  });
});

describe("parseMapsUrl · enlaces de «Cómo llegar»", () => {
  it("saca el destino de un /maps/dir// con la dirección en el camino", () => {
    const out = parseMapsUrl(
      "https://www.google.com/maps/dir//C.+Isla+de+Tavira,+32,+Fuencarral-El+Pardo,+28035+Madrid/data=!4m6!4m5!1m1!4e2!1m2!1m1!1s0xd422992357df8a3:0x40288605da57184?sa=X&ved=2ahUKEwjgnonGjqqXAxU_UkEAHQi_HcIQlDt6BAgPEAA",
    );
    expect(out.name).toBe("C. Isla de Tavira, 32, Fuencarral-El Pardo, 28035 Madrid");
  });

  it("también con el local dentro de la dirección", () => {
    const out = parseMapsUrl(
      "https://www.google.com/maps/dir//C.+Isla+de+Tavira,+26,+Loc+2,+Fuencarral-El+Pardo,+28035+Madrid/data=!4m6!4m5!1m1!4e2!1m2!1m1!1s0xd4229dc39c6b053:0xf26adee4ba3f20a6?sa=X&ved=2ahUKEwik8LqajqqXAxWlVkEAHbuMFDcQlDt6BAgPEAA",
    );
    expect(out.name).toBe("C. Isla de Tavira, 26, Loc 2, Fuencarral-El Pardo, 28035 Madrid");
  });

  it("con origen y destino se queda con el destino", () => {
    const out = parseMapsUrl(
      "https://www.google.com/maps/dir/Plaza+de+Cibeles,+Madrid/Barber%C3%ADa+Pepe,+Calle+del+Pez+23/@40.42,-3.70,15z",
    );
    expect(out.name).toBe("Barbería Pepe, Calle del Pez 23");
  });

  it("un destino que son coordenadas se trata como coordenadas", () => {
    const out = parseMapsUrl("https://www.google.com/maps/dir//40.4137913,-3.6944882");
    expect(out.name).toBeUndefined();
    expect(out.lat).toBeCloseTo(40.4137913, 5);
  });
});
