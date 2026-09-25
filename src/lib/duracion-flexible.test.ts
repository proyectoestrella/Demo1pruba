import { expect, it } from "bun:test";
import { duracionElegida, duracionFlexibleActiva } from "./duracion-flexible";

it("usa el ajuste del salón real aunque el enlace tenga un valor de demo", () => {
  expect(duracionFlexibleActiva({ duracionFlexible: true }, { duracionFlexible: false }, true)).toBe(true);
  expect(duracionFlexibleActiva({ duracionFlexible: false }, { duracionFlexible: true }, true)).toBe(false);
  expect(duracionFlexibleActiva({ duracionFlexible: false }, { duracionFlexible: true }, false)).toBe(true);
  expect(duracionFlexibleActiva({ duracionFlexible: true }, undefined, false)).toBe(true);
});

it("duracionElegida: una opción válida son minutos; el vacío del desplegable NO es 0", () => {
  expect(duracionElegida("45")).toBe(45);
  expect(duracionElegida("120")).toBe(120);
  expect(duracionElegida("")).toBeNull();
  expect(duracionElegida("0")).toBeNull();
  expect(duracionElegida(undefined)).toBeNull();
  expect(duracionElegida("abc")).toBeNull();
});
