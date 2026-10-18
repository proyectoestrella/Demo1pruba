import { describe, expect, test } from "bun:test";
import {
  CLAVE_DESCUBRIMIENTO_PLAN,
  descartarFuncionPlan,
  destacarFuncionPlan,
  leerDescubrimientoPlan,
} from "./plan-descubrimiento";

function memoria() {
  const datos = new Map<string, string>();
  return {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
  } as Storage;
}

describe("aviso de funciones de plan por sesión", () => {
  test("solo destaca una tarjeta y no vuelve a destacar la descartada", () => {
    const sesion = memoria();
    expect(destacarFuncionPlan("asistente", sesion)).toBe(true);
    expect(destacarFuncionPlan("analitica-avanzada", sesion)).toBe(false);
    descartarFuncionPlan("asistente", sesion);
    expect(destacarFuncionPlan("asistente", sesion)).toBe(false);
    expect(destacarFuncionPlan("analitica-avanzada", sesion)).toBe(false);
    expect(leerDescubrimientoPlan(sesion)).toEqual({ destacada: null, haDestacado: true, descartadas: ["asistente"] });
  });

  test("un almacenamiento roto no interrumpe la pantalla", () => {
    const roto = { getItem: () => { throw new Error("sin acceso"); }, setItem: () => { throw new Error("sin acceso"); } } as unknown as Storage;
    expect(destacarFuncionPlan("asistente", roto)).toBe(true);
    expect(leerDescubrimientoPlan(roto)).toEqual({ destacada: null, haDestacado: false, descartadas: [] });
    expect(CLAVE_DESCUBRIMIENTO_PLAN).toContain("descubrimiento");
  });
});
