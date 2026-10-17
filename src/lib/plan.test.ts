import { describe, expect, test } from "bun:test";
import { equipoCabeEnPlan, FUNCIONES_POR_PLAN, LIMITE_PROFESIONALES, NOMBRE_PLAN, planDe, tienePlan, muestraConmutadorDePlan } from "./plan";

describe("plan del salón (lote 13)", () => {
  test("decisión de Tomás: el asistente desde Estándar; lo demás (fuera de lo bajado el 28-sep), Embajador", () => {
    expect(FUNCIONES_POR_PLAN.asistente).toBe("reservas-asistente");
    for (const f of ["roles-ampliados", "importacion-mensual"] as const) {
      expect(FUNCIONES_POR_PLAN[f]).toBe("todo-incluido");
    }
    expect(Object.keys(FUNCIONES_POR_PLAN)).not.toContain("mas-profesionales");
  });
  test("decisión de Tomás (28-sep, plan-final-v2): historial completo y analítica avanzada bajan a Estándar", () => {
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
  test("corrección de Tomás (28-sep, venta 9:30): caja (exportar y cierre) baja a Estándar", () => {
    for (const f of ["caja-exportar", "caja-cierre"] as const) {
      expect(FUNCIONES_POR_PLAN[f]).toBe("reservas-asistente");
      expect(tienePlan("reservas", f)).toBe(false);
      expect(tienePlan("reservas-asistente", f)).toBe(true);
      expect(tienePlan("todo-incluido", f)).toBe(true);
    }
  });
  test("los nombres de los planes son Básico, Estándar y Embajador (28-sep)", () => {
    expect(NOMBRE_PLAN.reservas).toBe("Básico");
    expect(NOMBRE_PLAN["reservas-asistente"]).toBe("Estándar");
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
  test("sin plan guardado: Básico en un salón real y Embajador en la demo", () => {
    expect(planDe({}, false)).toBe("reservas");
    expect(planDe({}, true)).toBe("todo-incluido");
    expect(planDe({ plan: "reservas" }, true)).toBe("reservas");
    expect(planDe({ plan: "raro" }, false)).toBe("reservas");
  });
  test("Básico y Estándar admiten seis; Embajador conserva el máximo técnico de seis", () => {
    expect(LIMITE_PROFESIONALES).toEqual({ reservas: 6, "reservas-asistente": 6, "todo-incluido": 6 });
    expect(equipoCabeEnPlan("reservas", ["María", "Sara", "Noelia"])).toBe(true);
    expect(equipoCabeEnPlan("reservas", ["María", "Sara", "Noelia", "Cuarta"])).toBe(true);
    expect(equipoCabeEnPlan("reservas", ["1", "2", "3", "4", "5", "6"])).toBe(true);
    expect(equipoCabeEnPlan("reservas", ["1", "2", "3", "4", "5", "6", "7"])).toBe(false);
    expect(equipoCabeEnPlan("reservas-asistente", ["1", "2", "3", "4", "5", "6"])).toBe(true);
    expect(equipoCabeEnPlan("reservas-asistente", ["1", "2", "3", "4", "5", "6", "7"])).toBe(false);
    expect(equipoCabeEnPlan("reservas", [" ", "María~Color"])).toBe(true);
  });
});

import { MAX_PROFESIONALES, planParaProfesionales } from "./plan";
import { moduloVisible, moduloVisibleEnPanel } from "./demo-profile";

describe("profesionales por plan (tabla del 2-oct)", () => {
  test("Básico 6, Estándar 6, Embajador sin límite", () => {
    expect(MAX_PROFESIONALES).toEqual({ reservas: 6, "reservas-asistente": 6, "todo-incluido": null });
  });
  test("el plan más barato para n profesionales", () => {
    expect(planParaProfesionales(3)).toBe("reservas");
    expect(planParaProfesionales(4)).toBe("reservas");
    expect(planParaProfesionales(6)).toBe("reservas");
    expect(planParaProfesionales(7)).toBe("todo-incluido");
  });
});

describe("Equipo en el panel", () => {
  test("mo:equipo oculta la sección pública pero no la página del panel", () => {
    const p = { modulosOcultos: ["equipo" as const, "marketing" as const] };
    expect(moduloVisible(p, "equipo")).toBe(false);
    expect(moduloVisibleEnPanel(p, "equipo")).toBe(true);
    expect(moduloVisibleEnPanel(p, "marketing")).toBe(false);
  });
});

describe("etiquetas de plan y conmutador", () => {
  test("el plan intermedio se llama Estándar y no queda ningún «Completo»", () => {
    expect(NOMBRE_PLAN["reservas-asistente"]).toBe("Estándar");
    expect(Object.values(NOMBRE_PLAN)).toEqual(["Básico", "Estándar", "Embajador"]);
  });
  test("el conmutador de plan solo sale en una demo ya identificada, nunca en un salón real", () => {
    const demo = { realSalonSlug: null, slug: "kireya", resolucion: { slug: "kireya", status: "demo" } };
    expect(muestraConmutadorDePlan(demo)).toBe(true);
    expect(muestraConmutadorDePlan({ ...demo, realSalonSlug: "peluchic" })).toBe(false);
    expect(muestraConmutadorDePlan({ ...demo, resolucion: { slug: "kireya", status: "resolviendo" } })).toBe(false);
    expect(muestraConmutadorDePlan({ ...demo, resolucion: { slug: "peluchic", status: "real" } })).toBe(false);
    expect(muestraConmutadorDePlan({ ...demo, resolucion: null })).toBe(false);
  });
});
