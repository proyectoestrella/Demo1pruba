import { describe, expect, it } from "bun:test";
import { duracionFlexibleActiva, duracionElegida } from "./duracion-flexible";

it("usa el ajuste del salón real aunque el enlace tenga un valor de demo", () => {
  expect(duracionFlexibleActiva({ duracionFlexible: true }, { duracionFlexible: false }, true)).toBe(true);
  expect(duracionFlexibleActiva({ duracionFlexible: false }, { duracionFlexible: true }, true)).toBe(false);
  expect(duracionFlexibleActiva({ duracionFlexible: false }, { duracionFlexible: true }, false)).toBe(true);
  expect(duracionFlexibleActiva({ duracionFlexible: true }, undefined, false)).toBe(true);
});

describe("duracionElegida (desplegable del diálogo de nueva cita)", () => {
  it("una opción válida se convierte en minutos", () => {
    expect(duracionElegida("45")).toBe(45);
    expect(duracionElegida("120")).toBe(120);
  });

  it("la cadena vacía que manda el desplegable al quedarse sin opción NO es 0 minutos", () => {
    expect(duracionElegida("")).toBeNull();
    expect(duracionElegida("0")).toBeNull();
    expect(duracionElegida(undefined)).toBeNull();
    expect(duracionElegida("abc")).toBeNull();
  });
});
