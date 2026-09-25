import { describe, expect, test } from "bun:test";
import { ACCIONES, PAGINAS, PERMISOS_DEMO, alcance, cabeRol, permisosDe, puede, rolVigente, vePagina } from "./permisos";

describe("matriz de permisos", () => {
  test("gerente: todas las páginas (salvo demos internas) y todas las acciones con alcance total", () => {
    const g = permisosDe("gerente");
    for (const a of ACCIONES) expect([a, alcance(g, a)]).toEqual([a, "todo"]);
    for (const p of PAGINAS) expect([p, vePagina(g, p)]).toEqual([p, p !== "demos"]);
  });

  test("estilista: solo lo suyo en la agenda, sin dinero global, web, equipo ni accesos", () => {
    const e = permisosDe("estilista");
    expect(alcance(e, "cita.mover")).toBe("propio");
    expect(alcance(e, "dinero.ver-propio")).toBe("propio");
    for (const a of ["dinero.ver-global", "web.editar", "equipo.editar", "accesos.gestionar", "cita.ver-todas", "analitica.ver", "historial.deshacer-ajeno"] as const) expect([a, puede(e, a)]).toEqual([a, false]);
    for (const p of ["mi-pagina", "analitica", "marketing", "equipo", "ajustes", "ajustes.accesos"] as const) expect([p, vePagina(e, p)]).toEqual([p, false]);
    // Alcance propio: sobre su profesional sí, sobre otra no, sin vínculo nunca.
    expect(puede(e, "cita.cancelar", { employeeId: "noelia", miEmployeeId: "noelia" })).toBe(true);
    expect(puede(e, "cita.cancelar", { employeeId: "sara", miEmployeeId: "noelia" })).toBe(false);
    expect(puede(e, "cita.cancelar", { employeeId: "sara", miEmployeeId: null })).toBe(false);
  });

  test("subencargado: todo salvo dinero global, plan, accesos y borrar", () => {
    const s = permisosDe("subencargado");
    for (const a of ["dinero.ver-global", "plan.gestionar", "accesos.gestionar", "datos.borrar"] as const) expect([a, puede(s, a)]).toEqual([a, false]);
    expect(puede(s, "cita.ver-todas")).toBe(true);
    expect(puede(s, "servicio.editar")).toBe(true);
    expect(vePagina(s, "ajustes.accesos")).toBe(false);
  });

  test("recepción: agenda de todas y clientas, sin dinero", () => {
    const r = permisosDe("recepcion");
    expect(puede(r, "cita.crear-para-otra")).toBe(true);
    for (const a of ["dinero.ver-propio", "dinero.ver-global", "cita.cobrar", "analitica.ver"] as const) expect([a, puede(r, a)]).toEqual([a, false]);
  });

  test("roles antiguos y demo", () => {
    expect(rolVigente("dueno")).toBe("gerente");
    expect(rolVigente("encargado")).toBe("gerente");
    expect(rolVigente("estilista")).toBe("estilista");
    expect(PERMISOS_DEMO.rol).toBe("gerente");
  });

  test("plan: fuera de Todo incluido, dos roles distintos como mucho", () => {
    expect(cabeRol("estilista", ["gerente"], "reservas")).toBe(true);
    expect(cabeRol("recepcion", ["gerente", "estilista"], "reservas-asistente")).toBe(false);
    expect(cabeRol("estilista", ["gerente", "estilista"], "reservas")).toBe(true);
    expect(cabeRol("recepcion", ["gerente", "estilista"], "todo-incluido")).toBe(true);
  });
});
