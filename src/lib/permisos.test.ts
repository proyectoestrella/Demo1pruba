import { describe, expect, test } from "bun:test";
import {
  ACCIONES,
  PAGINAS,
  PERMISOS_DEMO,
  alcance,
  cabeRol,
  permisosDe,
  permisosExtraDe,
  puede,
  rolVigente,
  rolesPermitidosPorPlan,
  vePagina,
} from "./permisos";

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
    expect(alcance(e, "clienta.crear")).toBe("todo"); // da de alta a la clienta al darle cita
    expect(alcance(e, "clienta.editar")).toBe("propio");
    for (const a of [
      "dinero.ver-global",
      "dinero.crear",
      "dinero.cerrar",
      "dinero.exportar",
      "dinero.importar",
      "web.editar",
      "equipo.editar",
      "accesos.gestionar",
      "cita.ver-todas",
      "analitica.ver",
      "historial.deshacer-ajeno",
    ] as const)
      expect([a, puede(e, a)]).toEqual([a, false]);
    for (const p of [
      "mi-pagina",
      "analitica",
      "marketing",
      "equipo",
      "ajustes",
      "ajustes.accesos",
      "caja",
    ] as const)
      expect([p, vePagina(e, p)]).toEqual([p, false]);
    // Historial: lo suyo sí (alcance propio), lo ajeno no.
    expect(e.acciones.get("historial.ver")).toBe("propio");
    // Alcance propio: sobre su profesional sí, sobre otra no, sin vínculo nunca.
    expect(puede(e, "cita.cancelar", { employeeId: "noelia", miEmployeeId: "noelia" })).toBe(true);
    expect(puede(e, "cita.cancelar", { employeeId: "sara", miEmployeeId: "noelia" })).toBe(false);
    expect(puede(e, "cita.cancelar", { employeeId: "sara", miEmployeeId: null })).toBe(false);
  });

  test("subencargado: todo salvo dinero global, plan, accesos, borrar y exportar", () => {
    const s = permisosDe("subencargado");
    expect(puede(s, "web.publicar")).toBe(true);
    expect(puede(s, "historial.deshacer-ajeno")).toBe(true);
    for (const a of [
      "dinero.ver-global",
      "plan.gestionar",
      "accesos.gestionar",
      "datos.borrar",
      "clienta.exportar",
      "exportar.excel",
    ] as const)
      expect([a, puede(s, a)]).toEqual([a, false]);
    // Caja: crear, cerrar, exportar e importar SÍ, aunque no vea el dinero global de otras.
    for (const a of [
      "dinero.crear",
      "dinero.cerrar",
      "dinero.exportar",
      "dinero.importar",
    ] as const)
      expect([a, puede(s, a)]).toEqual([a, true]);
    expect(vePagina(s, "caja")).toBe(true);
    expect(puede(s, "cita.ver-todas")).toBe(true);
    expect(puede(s, "servicio.editar")).toBe(true);
    expect(vePagina(s, "ajustes.accesos")).toBe(false);
  });

  test("recepción: agenda de todas y clientas, sin dinero ni caja", () => {
    const r = permisosDe("recepcion");
    expect(puede(r, "cita.crear-para-otra")).toBe(true);
    for (const a of [
      "dinero.ver-propio",
      "dinero.ver-global",
      "dinero.crear",
      "dinero.cerrar",
      "dinero.exportar",
      "dinero.importar",
      "cita.cobrar",
      "analitica.ver",
    ] as const)
      expect([a, puede(r, a)]).toEqual([a, false]);
    expect(vePagina(r, "caja")).toBe(false);
  });

  test("roles antiguos y demo", () => {
    expect(rolVigente("dueno")).toBe("gerente");
    expect(rolVigente("encargado")).toBe("gerente");
    expect(rolVigente("estilista")).toBe("estilista");
    expect(PERMISOS_DEMO.rol).toBe("gerente");
  });

  test("overrides: combinan las tres excepciones sin abrir dinero, plan ni accesos", () => {
    const base = permisosDe("estilista");
    const concedidos = permisosDe("estilista", {
      verAgendaCompleta: true,
      accesoWeb: true,
      accesoReservas: true,
    });
    expect(puede(base, "cita.ver-todas")).toBe(false);
    expect(puede(concedidos, "cita.ver-todas")).toBe(true);
    expect(puede(concedidos, "web.publicar")).toBe(true);
    expect(puede(concedidos, "reservas.editar")).toBe(true);
    expect(vePagina(concedidos, "mi-pagina")).toBe(true);
    expect(vePagina(concedidos, "ajustes")).toBe(true);
    for (const accion of [
      "dinero.ver-global",
      "dinero.crear",
      "accesos.gestionar",
      "plan.gestionar",
    ] as const)
      expect(puede(concedidos, accion)).toBe(false);
  });

  test("overrides: pueden retirar lo que daba subencargada y la gerente conserva el mando", () => {
    const recortada = permisosDe("subencargado", {
      verAgendaCompleta: false,
      accesoWeb: false,
      accesoReservas: false,
    });
    expect(puede(recortada, "cita.ver-todas")).toBe(false);
    expect(puede(recortada, "web.editar")).toBe(false);
    expect(puede(recortada, "reservas.editar")).toBe(false);
    expect(vePagina(recortada, "mi-pagina")).toBe(false);
    expect(puede(recortada, "dinero.crear")).toBe(true); // no toca el rol real

    const gerente = permisosDe("gerente", {
      verAgendaCompleta: false,
      accesoWeb: false,
      accesoReservas: false,
    });
    expect(puede(gerente, "cita.ver-todas")).toBe(true);
    expect(puede(gerente, "web.editar")).toBe(true);
    expect(puede(gerente, "reservas.editar")).toBe(true);
  });

  test("overrides: las filas sin JSON y las claves manipuladas conservan o limitan solo lo conocido", () => {
    expect(permisosExtraDe(undefined)).toEqual({});
    expect(permisosExtraDe({ accesoWeb: true, dinero: true, accesoReservas: "sí" })).toEqual({
      accesoWeb: true,
    });
    expect(puede(permisosDe("estilista", permisosExtraDe(undefined)), "cita.ver-todas")).toBe(
      false,
    );
  });

  test("editarAgendaAjena: solo eleva a la estilista; ausente/false no cambia nada", () => {
    const base = permisosDe("estilista");
    expect(permisosDe("estilista", { editarAgendaAjena: false })).toBe(base);
    expect(permisosDe("estilista", {})).toBe(base);
    const p = permisosDe("estilista", { editarAgendaAjena: true });
    for (const a of ["cita.editar", "cita.mover", "cita.cancelar", "cita.crear-para-otra", "cita.ver-todas"] as const)
      expect(puede(p, a)).toBe(true);
    expect(puede(p, "dinero.crear")).toBe(false);
    expect(puede(p, "plan.gestionar")).toBe(false);
    expect(p.paginas).toEqual(base.paginas);
    expect(permisosDe("gerente", { editarAgendaAjena: true })).toBe(permisosDe("gerente"));
    expect(permisosDe("recepcion", { editarAgendaAjena: true })).toBe(permisosDe("recepcion"));
    expect(permisosExtraDe({ editarAgendaAjena: true, x: 1 })).toEqual({ editarAgendaAjena: true });
  });

  test("plan: reparto de roles del 28-sep — Básico dos, Estándar tres, Embajador cuatro", () => {
    expect(rolesPermitidosPorPlan("reservas")).toBe(2);
    expect(rolesPermitidosPorPlan("reservas-asistente")).toBe(3);
    expect(rolesPermitidosPorPlan("todo-incluido")).toBe(4);
    // Básico: un tercer tipo de rol no cabe.
    expect(cabeRol("estilista", ["gerente"], "reservas")).toBe(true);
    expect(cabeRol("recepcion", ["gerente", "estilista"], "reservas")).toBe(false);
    expect(cabeRol("estilista", ["gerente", "estilista"], "reservas")).toBe(true);
    // Estándar: cabe un tercer tipo, pero no un cuarto.
    expect(cabeRol("recepcion", ["gerente", "estilista"], "reservas-asistente")).toBe(true);
    expect(
      cabeRol("recepcion", ["gerente", "subencargado", "estilista"], "reservas-asistente"),
    ).toBe(false);
    // Embajador: caben los cuatro.
    expect(cabeRol("recepcion", ["gerente", "subencargado", "estilista"], "todo-incluido")).toBe(
      true,
    );
  });
});
