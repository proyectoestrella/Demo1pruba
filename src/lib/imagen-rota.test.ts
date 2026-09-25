import { describe, expect, test } from "bun:test";
import { imagenYaRota } from "./imagen-rota";

describe("imagenYaRota", () => {
  test("cargada sin pintar = rota; cargando o pintada = no", () => {
    expect(imagenYaRota({ complete: true, naturalWidth: 0 })).toBe(true);
    expect(imagenYaRota({ complete: false, naturalWidth: 0 })).toBe(false);
    expect(imagenYaRota({ complete: true, naturalWidth: 1920 })).toBe(false);
    expect(imagenYaRota(null)).toBe(false);
  });
});
