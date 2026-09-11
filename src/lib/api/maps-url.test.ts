import { describe, expect, it } from "bun:test";
import { limpiarNombre, parseMapsUrl } from "./maps.functions";

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

  it("deja en paz un nombre normal", () => {
    expect(limpiarNombre("Barbería Pepe")).toBe("Barbería Pepe");
  });

  it("no se queda con un trozo inútil si el nombre empieza por el separador", () => {
    expect(limpiarNombre("A | Barbería del Centro")).toBe("A | Barbería del Centro");
  });
});
