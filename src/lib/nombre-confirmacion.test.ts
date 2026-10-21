import { describe, expect, it } from "bun:test";
import { guardarNombreConfirmacion, leerNombreConfirmacion } from "./nombre-confirmacion";

function almacen() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("nombre de la confirmación", () => {
  it("ida y vuelta por el almacén de la pestaña", () => {
    const a = almacen();
    guardarNombreConfirmacion("  Ana García ", a);
    expect(leerNombreConfirmacion(a)).toBe("Ana García");
  });
  it("sin dato o sin almacén devuelve vacío", () => {
    expect(leerNombreConfirmacion(almacen())).toBe("");
    expect(leerNombreConfirmacion(null)).toBe("");
  });
  it("un almacén que lanza no rompe", () => {
    const roto = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(() => guardarNombreConfirmacion("Ana", roto)).not.toThrow();
    expect(leerNombreConfirmacion(roto)).toBe("");
  });
});
