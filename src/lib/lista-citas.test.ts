import { describe, expect, test } from "bun:test";
import { agruparCitasPorProximidad, horaDestacadaCita } from "./lista-citas";

const ahora = new Date(2026, 9, 17, 10, 30);

describe("horaDestacadaCita", () => {
  test("separa la hora protagonista del día y la duración", () => {
    expect(
      horaDestacadaCita({ start: new Date(2026, 9, 17, 16, 30), duration: 75 }, ahora),
    ).toEqual({
      hora: "16:30",
      dia: "Hoy",
      duracion: "75 min",
    });
  });

  test("nombra mañana y conserva la fecha corta para el resto", () => {
    expect(horaDestacadaCita({ start: new Date(2026, 9, 18, 9, 0), duration: 30 }, ahora).dia).toBe(
      "Mañana",
    );
    expect(horaDestacadaCita({ start: new Date(2026, 9, 21, 9, 0), duration: 30 }, ahora).dia).toBe(
      "mié 21 oct",
    );
  });
});

describe("agruparCitasPorProximidad", () => {
  test("mantiene próximas primero y manda al historial las que ya acabaron", () => {
    const citas = [
      { id: "en-curso", start: new Date(2026, 9, 17, 10, 0), duration: 60 },
      { id: "pasada", start: new Date(2026, 9, 17, 8, 0), duration: 30 },
      { id: "siguiente", start: new Date(2026, 9, 18, 9, 0), duration: 30 },
    ];
    const grupos = agruparCitasPorProximidad(citas, ahora);
    expect(grupos.proximas.map((c) => c.id)).toEqual(["en-curso", "siguiente"]);
    expect(grupos.anteriores.map((c) => c.id)).toEqual(["pasada"]);
  });
});
