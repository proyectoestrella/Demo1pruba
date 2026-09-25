import { describe, expect, test } from "bun:test";
import { diferenciasWeb, webDe } from "./versiones-maqueta";

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
