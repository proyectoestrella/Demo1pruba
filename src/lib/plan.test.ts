import { describe, expect, test } from "bun:test";
import { FUNCIONES_POR_PLAN, planDe, tienePlan } from "./plan";

describe("plan del salón (lote 13)", () => {
  test("decisión de Tomás: el asistente desde Reservas + Asistente; lo demás, Todo incluido", () => {
    expect(FUNCIONES_POR_PLAN.asistente).toBe("reservas-asistente");
    for (const f of ["roles-ampliados", "historial-completo", "campanas-ampliadas", "analitica-avanzada", "senal-liberacion-automatica", "importacion-mensual"] as const) {
      expect(FUNCIONES_POR_PLAN[f]).toBe("todo-incluido");
    }
    expect(Object.keys(FUNCIONES_POR_PLAN)).not.toContain("mas-profesionales");
  });
  test("decisión de Tomás (27-sep), alineado con el presupuesto: exportar citas/analítica a Excel va en todos los planes", () => {
    expect(FUNCIONES_POR_PLAN.exportar).toBe("reservas");
    expect(tienePlan("reservas", "exportar")).toBe(true);
    expect(tienePlan("reservas-asistente", "exportar")).toBe(true);
    expect(tienePlan("todo-incluido", "exportar")).toBe(true);
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
