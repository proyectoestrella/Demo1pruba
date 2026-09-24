import { expect, it } from "bun:test";
import { duracionFlexibleActiva } from "./duracion-flexible";

it("usa el ajuste del salón real aunque el enlace tenga un valor de demo", () => {
  expect(duracionFlexibleActiva({ duracionFlexible: true }, { duracionFlexible: false }, true)).toBe(true);
  expect(duracionFlexibleActiva({ duracionFlexible: false }, { duracionFlexible: true }, true)).toBe(false);
  expect(duracionFlexibleActiva({ duracionFlexible: false }, { duracionFlexible: true }, false)).toBe(true);
  expect(duracionFlexibleActiva({ duracionFlexible: true }, undefined, false)).toBe(true);
});
