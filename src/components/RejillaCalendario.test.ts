import { describe, expect, test } from "bun:test";
import { altoPorHora } from "./RejillaCalendario";

describe("alto de una hora en la rejilla", () => {
  test("pocas horas llenan el alto disponible", () => {
    expect(altoPorHora(640, 8)).toBe(80); // 7-15 en un hueco de 640 px
    expect(altoPorHora(640, 11)).toBe(58); // 9-20
  });
  test("si no cabe ni a 48 px por hora, 48 y scroll", () => {
    expect(altoPorHora(640, 16)).toBe(48); // 6-22
  });
  test("sin medida todavía, el alto de siempre", () => {
    expect(altoPorHora(0, 8)).toBe(64);
  });
});

import { scrollInicial } from "./RejillaCalendario";

describe("scroll inicial de la rejilla de 24 h (lote 15)", () => {
  test("sin hoy en pantalla: arriba, el principio de las horas visibles", () => {
    expect(scrollInicial(60, 9, 21, null)).toBe(9 * 60);
  });
  test("hoy y ahora dentro de las horas visibles: una hora antes de ahora", () => {
    expect(scrollInicial(60, 9, 21, 15 * 60 + 30)).toBe(14.5 * 60);
  });
  test("hoy pero ahora fuera (de noche): el principio de la jornada", () => {
    expect(scrollInicial(60, 9, 21, 23 * 60)).toBe(9 * 60);
    expect(scrollInicial(48, 9, 21, 6 * 60)).toBe(9 * 48);
  });
  test("nunca por encima de las 00:00", () => {
    expect(scrollInicial(60, 0, 24, 30)).toBe(0);
  });
});
