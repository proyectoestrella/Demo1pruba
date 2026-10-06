import { expect, test } from "bun:test";
import { mostrarPreciosEnReserva } from "./precio-reserva";

test("muestra los precios de reserva por defecto", () => {
  expect(mostrarPreciosEnReserva({})).toBe(true);
  expect(mostrarPreciosEnReserva({ ocultarPrecioReserva: false })).toBe(true);
});

test("oculta los precios de reserva solo cuando el salón lo activa", () => {
  expect(mostrarPreciosEnReserva({ ocultarPrecioReserva: true })).toBe(false);
});
