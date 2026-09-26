import { describe, expect, test } from "bun:test";
import { montarCifra, partirCifra, salidaSuave } from "./movimiento-panel";

describe("movimiento (lote 16)", () => {
  test("curva de salida sin rebote: 0 → 1, nunca pasa de 1", () => {
    expect(salidaSuave(0)).toBe(0);
    expect(salidaSuave(1)).toBe(1);
    expect(salidaSuave(2)).toBe(1);
    expect(salidaSuave(0.5)).toBeGreaterThan(0.5);
  });
  test("parte y vuelve a montar cifras formateadas", () => {
    const p = partirCifra("1.234,50 €")!;
    expect(p.n).toBe(1234.5);
    expect(montarCifra(p, 617.25)).toBe("617,25 €");
    const q = partirCifra("Agenda al 84 %")!;
    expect(q.n).toBe(84);
    expect(montarCifra(q, 42)).toBe("Agenda al 42 %");
    expect(partirCifra("—")).toBeNull();
  });
});
