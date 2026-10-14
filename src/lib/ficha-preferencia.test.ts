import { beforeEach, describe, expect, it } from "bun:test";
import { CLAVE_FICHAS, fijarModoFicha, leerPreferencia, presentacionDeFicha, PREFERENCIA_POR_DEFECTO } from "./ficha-preferencia";

function almacenFalso() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("preferencia de las fichas (anclar)", () => {
  let a: ReturnType<typeof almacenFalso>;
  beforeEach(() => { a = almacenFalso(); });

  it("por defecto, las dos centradas", () => {
    expect(leerPreferencia(a)).toEqual(PREFERENCIA_POR_DEFECTO);
    expect(PREFERENCIA_POR_DEFECTO).toEqual({ clienta: "centrada", cita: "centrada" });
  });
  it("anclar la ficha de clienta se recuerda y no toca la de cita", () => {
    fijarModoFicha("clienta", "lateral", a);
    expect(JSON.parse(a.m.get(CLAVE_FICHAS)!)).toEqual({ clienta: "lateral", cita: "centrada" });
    expect(leerPreferencia(a)).toEqual({ clienta: "lateral", cita: "centrada" });
  });
  it("desanclar vuelve al centro; la cita se puede dejar lateral aparte", () => {
    fijarModoFicha("clienta", "lateral", a);
    fijarModoFicha("cita", "lateral", a);
    fijarModoFicha("clienta", "centrada", a);
    expect(leerPreferencia(a)).toEqual({ clienta: "centrada", cita: "lateral" });
  });
  it("un valor guardado roto no rompe nada", () => {
    a.m.set(CLAVE_FICHAS, "{no es json");
    expect(leerPreferencia(a)).toEqual(PREFERENCIA_POR_DEFECTO);
    a.m.set(CLAVE_FICHAS, JSON.stringify({ clienta: "raro" }));
    expect(leerPreferencia(a)).toEqual(PREFERENCIA_POR_DEFECTO);
  });
  it("móvil: siempre pantalla completa; tableta: centrada; escritorio: lo recordado", () => {
    expect(presentacionDeFicha("lateral", 390)).toBe("pantalla");
    expect(presentacionDeFicha("lateral", 820)).toBe("centrada");
    expect(presentacionDeFicha("lateral", 1280)).toBe("lateral");
    expect(presentacionDeFicha("centrada", 1280)).toBe("centrada");
  });
});
