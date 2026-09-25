import { describe, expect, test } from "bun:test";
import { anchoDesdeBorde } from "./panel-lateral";

describe("ancho del panel al arrastrar su borde", () => {
  test("el ancho es lo que queda a la derecha del puntero", () => {
    expect(anchoDesdeBorde(900, 1440)).toBe(540);
  });
  test("nunca menos de 360 ni más del 70 % de la ventana", () => {
    expect(anchoDesdeBorde(1300, 1440)).toBe(360);
    expect(anchoDesdeBorde(100, 1440)).toBe(1008);
    expect(anchoDesdeBorde(0, 480)).toBe(360); // ventana pequeña: el mínimo manda
  });
});
