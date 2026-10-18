import { describe, expect, it } from "bun:test";
import type { Service } from "./mock/types";
import { resumenServiciosReserva } from "./resumen-servicios-reserva";

const corte: Service = {
  id: "corte",
  name: "Corte",
  description: "",
  durationMin: 45,
  priceEur: 28,
};

const color: Service = {
  id: "color",
  name: "Color",
  description: "",
  durationMin: 75,
  priceEur: 52,
};

describe("resumen de servicios de la reserva pública", () => {
  it("cuenta los servicios y reutiliza sus totales de duración y precio", () => {
    expect(resumenServiciosReserva([corte, color], true)).toMatchObject({
      cantidad: 2,
      nombres: ["Corte", "Color"],
      durationMin: 120,
      priceEur: 80,
      mostrarPrecio: true,
    });
  });

  it("no muestra un precio cuando el salón lo ha ocultado", () => {
    const resumen = resumenServiciosReserva([corte, color], false);

    expect(resumen.priceEur).toBe(80);
    expect(resumen.mostrarPrecio).toBe(false);
  });

  it("no enseña importe para una selección vacía", () => {
    expect(resumenServiciosReserva([], true)).toMatchObject({
      cantidad: 0,
      nombres: [],
      durationMin: 0,
      priceEur: 0,
      mostrarPrecio: false,
    });
  });
});
