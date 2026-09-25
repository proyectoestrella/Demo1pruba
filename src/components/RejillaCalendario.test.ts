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
