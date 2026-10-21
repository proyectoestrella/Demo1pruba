import { describe, expect, test } from "bun:test";
import { diferenciasWeb, parcheDeWeb, webDe } from "./versiones-maqueta";

describe("diferencias entre versiones de Mi página (lote 12)", () => {
  test("solo lo que cambia, en palabras", () => {
    const d = diferenciasWeb({ tagline: "Peluquería", logoUrl: "" }, { tagline: "Peluquería en Hortaleza" });
    expect(d).toEqual([{ campo: "tagline", etiqueta: "Tipo de negocio", antes: "Peluquería", despues: "Peluquería en Hortaleza" }]);
  });
  test("el horario, día a día", () => {
    const a = ["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "9:00–14:00", "Cerrado"];
    const b = [...a];
    b[5] = "9:00–15:00";
    expect(diferenciasWeb({ openingHours: a }, { openingHours: b })).toEqual([{ campo: "openingHours.5", etiqueta: "Horario · Sábado", antes: "9:00–14:00", despues: "9:00–15:00" }]);
  });
  test("la carta: qué sale y qué entra", () => {
    const d = diferenciasWeb({ menu: ["Tinte~40~35", "Corte~45~25"] }, { menu: ["Tinte~40~35", "Recogido~60~45"] });
    expect(d[0]).toMatchObject({ etiqueta: "Servicios", antes: "Corte~45~25", despues: "Recogido~60~45" });
  });
  test("webDe se queda solo con los campos de la web", () => {
    expect(Object.keys(webDe({ name: "PeluChic", team: ["María"] } as never))).toEqual(["name"]);
  });
});

describe("restaurar una versión que no tenía un campo", () => {
  test("parcheDeWeb pone a undefined lo ausente, para que se borre al restaurar", () => {
    const antes = webDe({ name: "PeluChic", phone: "600" } as never);
    const parche = parcheDeWeb(antes);
    expect(parche.name).toBe("PeluChic");
    expect("whatsapp" in parche && parche.whatsapp === undefined).toBe(true);
    expect("galeriaPropia" in parche && parche.galeriaPropia === undefined).toBe(true);
    const aplicado = { ...{ name: "X", whatsapp: "+34 6", galeriaPropia: [{ url: "/a.jpg", alt: "aaa" }] }, ...parche };
    expect(aplicado.whatsapp).toBeUndefined();
    expect(aplicado.galeriaPropia).toBeUndefined();
  });
});
