import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FUNCIONES_POR_PLAN, PLANES, tienePlan, type FuncionPlan } from "../plan";
import { exigirFuncionDePlan, PlanInsuficiente } from "./plan-guardas";

const FUNCIONES = Object.keys(FUNCIONES_POR_PLAN) as FuncionPlan[];

describe("guarda de funciones por plan", () => {
  test("toda función acepta los planes suficientes y rechaza los insuficientes", () => {
    for (const funcion of FUNCIONES) {
      for (const plan of PLANES) {
        const ejecutar = () => exigirFuncionDePlan({ plan }, funcion, false);
        if (tienePlan(plan, funcion)) expect(ejecutar).not.toThrow();
        else {
          expect(ejecutar).toThrow(PlanInsuficiente);
          expect(ejecutar).toThrow("no incluye esta función");
        }
      }
    }
  });

  test("una demo no se bloquea aunque el perfil simule Básico", () => {
    for (const funcion of FUNCIONES) expect(() => exigirFuncionDePlan({ plan: "reservas" }, funcion, true)).not.toThrow();
  });
});

describe("cableado de las funciones de servidor con plan superior", () => {
  const pagos = readFileSync(new URL("./pagos.functions.ts", import.meta.url), "utf8");
  const cambios = readFileSync(new URL("./cambios.functions.ts", import.meta.url), "utf8");
  const salons = readFileSync(new URL("./salons.functions.ts", import.meta.url), "utf8");
  const cuerpo = (fuente: string, nombre: string) => {
    const inicio = fuente.indexOf(`export const ${nombre} =`);
    const fin = fuente.indexOf("\nexport const ", inicio + 1);
    return fuente.slice(inicio, fin < 0 ? undefined : fin);
  };

  test("caja, historial e importación llegan al servidor con su guarda", () => {
    expect(cuerpo(pagos, "cerrarCaja")).toContain('exigirFuncionPlanEn(data.slug, "caja-cierre", quien)');
    expect(cuerpo(pagos, "listarCierresCaja")).toContain('exigirFuncionPlanEn(data.slug, "caja-cierre", quien)');
    expect(cuerpo(pagos, "generarCsvGestoria")).toContain('exigirFuncionPlanEn(data.slug, "caja-exportar", quien)');
    expect(cuerpo(pagos, "importarPagosTpvServidor")).toContain('exigirFuncionPlanEn(data.slug, "importacion-mensual", quien)');
    expect(cuerpo(cambios, "listarCambios")).toContain('exigirFuncionPlanEn(data.slug, "historial-completo", quien)');
    expect(cuerpo(salons, "listarVersiones")).toContain('exigirFuncionPlanEn(data.slug, "historial-completo", quien)');
    expect(cuerpo(salons, "restaurarVersion")).toContain('exigirFuncionPlanEn(data.slug, "historial-completo", quien)');
  });
});
