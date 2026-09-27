import { describe, expect, it } from "bun:test";
import { cierraEseDia, diaAbiertoMasCercano, elDia } from "./dia-cerrado-panel";

const PELUCHIC = ["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–14:00", "Cerrado"];
// 28/09/2026 es lunes.
const LUNES = new Date(2026, 8, 28, 9, 30);

describe("días en que el salón cierra", () => {
  it("el lunes y el domingo de PeluChic cierran; el sábado, no", () => {
    expect(cierraEseDia(PELUCHIC, LUNES)).toBe(true);
    expect(cierraEseDia(PELUCHIC, new Date(2026, 8, 27))).toBe(true);
    expect(cierraEseDia(PELUCHIC, new Date(2026, 8, 26))).toBe(false);
  });

  it("un horario vacío o incompleto no cierra nada", () => {
    expect(cierraEseDia(undefined, LUNES)).toBe(false);
    expect(cierraEseDia(["Cerrado"], LUNES)).toBe(false);
    expect(cierraEseDia(Array(7).fill("Cerrado"), LUNES)).toBe(false);
  });

  it("el siguiente día abierto tras el lunes es el martes, y el anterior, el sábado", () => {
    expect(diaAbiertoMasCercano(PELUCHIC, LUNES, 1)).toEqual(new Date(2026, 8, 29));
    expect(diaAbiertoMasCercano(PELUCHIC, LUNES, -1)).toEqual(new Date(2026, 8, 26));
    // Desde el domingo, el siguiente también es el martes.
    expect(diaAbiertoMasCercano(PELUCHIC, new Date(2026, 8, 27, 13), 1)).toEqual(new Date(2026, 8, 29));
    expect(diaAbiertoMasCercano(Array(7).fill("Cerrado"), LUNES, 1)).toBeNull();
  });

  it("dice el día como se diría en voz alta", () => {
    expect(elDia(new Date(2026, 8, 29), LUNES)).toBe("mañana");
    expect(elDia(new Date(2026, 8, 29), new Date(2026, 8, 27))).toBe("el martes");
    expect(elDia(new Date(2026, 8, 26), LUNES)).toBe("el sábado");
    expect(elDia(new Date(2026, 9, 6), LUNES)).toBe("el martes 6");
  });
});
