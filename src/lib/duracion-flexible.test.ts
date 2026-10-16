import { describe, expect, it } from "bun:test";
import { cambiarDuracionElegida, duracionDeAgenda, duracionFlexibleActiva, duracionElegida } from "./duracion-flexible";

it("usa el ajuste del salón real aunque el enlace tenga un valor de demo", () => {
  expect(duracionFlexibleActiva({ duracionFlexible: true }, { duracionFlexible: false }, true)).toBe(true);
  expect(duracionFlexibleActiva({ duracionFlexible: false }, { duracionFlexible: true }, true)).toBe(false);
  expect(duracionFlexibleActiva({ duracionFlexible: false }, { duracionFlexible: true }, false)).toBe(true);
  expect(duracionFlexibleActiva({ duracionFlexible: true }, undefined, false)).toBe(true);
});

it("la duración flexible reserva el extremo alto que se comunica a la clienta", () => {
  expect(duracionDeAgenda(90, true)).toBe(135);
  expect(duracionDeAgenda(90, false)).toBe(90);
});

describe("duracionElegida", () => {
  it("una opción válida se convierte en minutos", () => {
    expect(duracionElegida("45")).toBe(45);
    expect(duracionElegida("120")).toBe(120);
  });

  it("rechaza valores vacíos, cero, no numéricos y negativos", () => {
    expect(duracionElegida("")).toBeNull();
    expect(duracionElegida("0")).toBeNull();
    expect(duracionElegida(undefined)).toBeNull();
    expect(duracionElegida("abc")).toBeNull();
    expect(duracionElegida("-15")).toBeNull();
    expect(duracionElegida("0.4")).toBeNull();
  });
});

describe("cambiarDuracionElegida", () => {
  it("no actualiza una cita al recibir una duración no válida", () => {
    const llamadas: number[] = [];
    const actualizar = (minutos: number) => llamadas.push(minutos);

    expect(cambiarDuracionElegida("", actualizar)).toBe(false);
    expect(cambiarDuracionElegida("0", actualizar)).toBe(false);
    expect(cambiarDuracionElegida("NaN", actualizar)).toBe(false);
    expect(llamadas).toEqual([]);
  });

  it("actualiza una cita al recibir una duración válida", () => {
    const llamadas: number[] = [];

    expect(cambiarDuracionElegida("45", (minutos) => llamadas.push(minutos))).toBe(true);
    expect(llamadas).toEqual([45]);
  });
});
