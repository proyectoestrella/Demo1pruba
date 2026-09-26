import { describe, expect, test } from "bun:test";
import { tituloCalendario } from "./calendario-titulo-panel";

const dia = (a: number, m: number, d: number) => new Date(a, m - 1, d);
const semana = (a: number, m: number, d: number) => Array.from({ length: 7 }, (_, i) => new Date(a, m - 1, d + i));

describe("título del calendario con año (lote 16)", () => {
  test("semana dentro de un mes", () => {
    expect(tituloCalendario("varios", semana(2026, 9, 21), dia(2026, 9, 26))).toBe("21 – 27 de septiembre de 2026");
  });
  test("semana entre dos meses", () => {
    expect(tituloCalendario("varios", semana(2026, 9, 28), dia(2026, 9, 28))).toBe("28 de septiembre – 4 de octubre de 2026");
  });
  test("semana entre dos años", () => {
    expect(tituloCalendario("varios", semana(2026, 12, 28), dia(2026, 12, 28))).toBe("28 de diciembre de 2026 – 3 de enero de 2027");
  });
  test("día y mes", () => {
    expect(tituloCalendario("dia", [], dia(2026, 9, 26))).toBe("Sábado, 26 de septiembre de 2026");
    expect(tituloCalendario("mes", [], dia(2026, 9, 26))).toBe("Septiembre de 2026");
  });
});
