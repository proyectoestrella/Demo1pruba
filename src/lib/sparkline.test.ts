import { describe, expect, it } from "bun:test";
import { MIN_VALORES_PARA_TENDENCIA, hayTendenciaQueDibujar } from "./sparkline";

describe("hayTendenciaQueDibujar", () => {
  it("no dibuja nada cuando no hay serie", () => {
    expect(hayTendenciaQueDibujar([])).toBe(false);
  });

  it("no dibuja con un salón recién abierto: todo ceros", () => {
    expect(hayTendenciaQueDibujar([0, 0, 0, 0, 0, 0, 0])).toBe(false);
  });

  it("no dibuja con un solo día con datos", () => {
    expect(hayTendenciaQueDibujar([0, 0, 0, 0, 0, 0, 2])).toBe(false);
  });

  it("no dibuja con dos días con datos — el caso de la auditoría", () => {
    expect(hayTendenciaQueDibujar([0, 0, 0, 0, 0, 1, 2])).toBe(false);
  });

  it("dibuja a partir de tres días con datos", () => {
    expect(hayTendenciaQueDibujar([0, 0, 0, 0, 3, 1, 2])).toBe(true);
  });

  it("los negativos también cuentan como dato", () => {
    expect(hayTendenciaQueDibujar([-1, -2, -3])).toBe(true);
  });

  it("ignora los valores que no son números finitos", () => {
    expect(hayTendenciaQueDibujar([NaN, Infinity, 5, 5])).toBe(false);
    expect(hayTendenciaQueDibujar([NaN, 5, 5, 5])).toBe(true);
  });

  it("el mínimo declarado es el que se aplica", () => {
    const justo = Array.from({ length: MIN_VALORES_PARA_TENDENCIA }, () => 1);
    expect(hayTendenciaQueDibujar(justo)).toBe(true);
    expect(hayTendenciaQueDibujar(justo.slice(1))).toBe(false);
  });
});
