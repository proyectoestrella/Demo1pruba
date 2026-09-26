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

import { scrollConservado, tramosCerrados } from "./RejillaCalendario";

describe("scroll al pasar de semana (lote 16)", () => {
  test("mismo alto de hora: no se mueve", () => {
    expect(scrollConservado(524, 48, 48)).toBe(524);
  });
  test("cambia el alto de hora: la misma hora sigue arriba", () => {
    expect(scrollConservado(9 * 48, 48, 60)).toBe(9 * 60);
  });
});

describe("franja rayada con las horas visibles (lote 16)", () => {
  test("fuera del horario Y fuera de las horas visibles, rayado", () => {
    // Abre de 10 a 20; horas visibles de 12 a 18: rayado 0-12 y 18-24.
    expect(tramosCerrados([{ ini: 600, fin: 1200 }], 12, 18)).toEqual([{ ini: 0, fin: 720 }, { ini: 1080, fin: 1440 }]);
  });
  test("horas visibles más amplias que el horario: manda el horario", () => {
    expect(tramosCerrados([{ ini: 600, fin: 840 }, { ini: 900, fin: 1200 }], 8, 21)).toEqual([
      { ini: 0, fin: 600 },
      { ini: 840, fin: 900 },
      { ini: 1200, fin: 1440 },
    ]);
  });
  test("día cerrado: todo rayado", () => {
    expect(tramosCerrados([], 8, 21)).toEqual([{ ini: 0, fin: 1440 }]);
  });
});

describe("scroll inicial obedece a las horas visibles (lote 16)", () => {
  test("si caben enteras, arriba el principio aunque «ahora» esté dentro", () => {
    // 12-18 a 100 px = 600 px en un hueco de 640: se ve todo desde las 12.
    expect(scrollInicial(100, 12, 18, 16 * 60 + 45, 640)).toBe(1200);
  });
  test("si no caben, «ahora» menos una hora, sin pasarse del final", () => {
    // 8-21 a 48 px = 624 px en 400: ahora 20:30 → no más abajo de 21 h - 400 px.
    expect(scrollInicial(48, 8, 21, 20 * 60 + 30, 400)).toBe(21 * 48 - 400);
    expect(scrollInicial(48, 8, 21, 11 * 60, 400)).toBe(10 * 48);
  });
});
