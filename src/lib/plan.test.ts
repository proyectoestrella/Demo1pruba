import { describe, expect, test } from "bun:test";
import { FUNCIONES_POR_PLAN, NOMBRE_PLAN, planDe, tienePlan } from "./plan";

describe("plan del salón (lote 13)", () => {
  test("decisión de Tomás: el asistente desde Completo; lo demás (fuera de lo bajado el 28-sep), Embajador", () => {
    expect(FUNCIONES_POR_PLAN.asistente).toBe("reservas-asistente");
    for (const f of ["roles-ampliados", "importacion-mensual"] as const) {
      expect(FUNCIONES_POR_PLAN[f]).toBe("todo-incluido");
    }
    expect(Object.keys(FUNCIONES_POR_PLAN)).not.toContain("mas-profesionales");
  });
  test("decisión de Tomás (28-sep, plan-final-v2): historial completo y analítica avanzada bajan a Completo", () => {
    for (const f of ["historial-completo", "analitica-avanzada"] as const) {
      expect(FUNCIONES_POR_PLAN[f]).toBe("reservas-asistente");
      expect(tienePlan("reservas", f)).toBe(false);
      expect(tienePlan("reservas-asistente", f)).toBe(true);
      expect(tienePlan("todo-incluido", f)).toBe(true);
    }
  });
  test("corrección de Tomás (28-sep, venta 9:30): campañas ampliadas vuelve a Embajador", () => {
    expect(FUNCIONES_POR_PLAN["campanas-ampliadas"]).toBe("todo-incluido");
    expect(tienePlan("reservas-asistente", "campanas-ampliadas")).toBe(false);
    expect(tienePlan("todo-incluido", "campanas-ampliadas")).toBe(true);
  });
  test("corrección de Tomás (28-sep, venta 9:30): caja (exportar y cierre) baja a Completo", () => {
    for (const f of ["caja-exportar", "caja-cierre"] as const) {
      expect(FUNCIONES_POR_PLAN[f]).toBe("reservas-asistente");
      expect(tienePlan("reservas", f)).toBe(false);
      expect(tienePlan("reservas-asistente", f)).toBe(true);
      expect(tienePlan("todo-incluido", f)).toBe(true);
    }
  });
  test("los nombres de los planes son Básico, Completo y Embajador (28-sep)", () => {
    expect(NOMBRE_PLAN.reservas).toBe("Básico");
    expect(NOMBRE_PLAN["reservas-asistente"]).toBe("Completo");
    expect(NOMBRE_PLAN["todo-incluido"]).toBe("Embajador");
  });
  test("decisión de Tomás (27-sep), alineado con el presupuesto: exportar citas/analítica a Excel va en todos los planes", () => {
    expect(FUNCIONES_POR_PLAN.exportar).toBe("reservas");
    expect(tienePlan("reservas", "exportar")).toBe(true);
    expect(tienePlan("reservas-asistente", "exportar")).toBe(true);
    expect(tienePlan("todo-incluido", "exportar")).toBe(true);
  });
  test("plan definitivo (27-sep): la señal que se libera sola va en todos los planes, activada por defecto", () => {
    expect(FUNCIONES_POR_PLAN["senal-liberacion-automatica"]).toBe("reservas");
    expect(tienePlan("reservas", "senal-liberacion-automatica")).toBe(true);
  });
  test("cada plan incluye lo del anterior", () => {
    expect(tienePlan("reservas", "asistente")).toBe(false);
    expect(tienePlan("reservas-asistente", "asistente")).toBe(true);
    expect(tienePlan("todo-incluido", "asistente")).toBe(true);
  });
  test("sin plan guardado: reservas-asistente en un salón real (como BACKEND), todo-incluido en la demo", () => {
    expect(planDe({}, false)).toBe("reservas-asistente");
    expect(planDe({}, true)).toBe("todo-incluido");
    expect(planDe({ plan: "reservas" }, true)).toBe("reservas");
    expect(planDe({ plan: "raro" }, false)).toBe("reservas-asistente");
  });
});
