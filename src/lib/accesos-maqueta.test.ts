import { beforeEach, describe, expect, test } from "bun:test";
import { accesos, miembrosDeDemo, useAccesosDemo } from "./accesos-maqueta";
import type { Employee } from "./mock/types";

const equipo = [
  { id: "maria", name: "María" },
  { id: "sara", name: "Sara" },
  { id: "noelia", name: "Noelia" },
] as Employee[];

beforeEach(() => {
  useAccesosDemo.setState({ miembros: miembrosDeDemo(equipo), claveEquipo: "x", verComo: null });
});

describe("accesos de la demo (lote 11)", () => {
  test("María gerente, Sara y Noelia estilistas vinculadas, y una subencargada", () => {
    const m = accesos.listarMiembros();
    expect(m.map((x) => `${x.displayName}:${x.rol}:${x.employeeId}`)).toEqual(["María:gerente:maria", "Sara:estilista:sara", "Noelia:estilista:noelia", "Laura:subencargado:null"]);
  });
  test("no se puede quitar ni bajar de rol a la última gerente", () => {
    expect(accesos.darDeBaja("demo-maria")).toMatchObject({ ok: false, codigo: "ULTIMA_GERENTE" });
    expect(accesos.cambiarRol("demo-maria", "estilista", "todo-incluido")).toMatchObject({ ok: false, codigo: "ULTIMA_GERENTE" });
  });
  test("con dos gerentes, una puede darse de baja", () => {
    expect(accesos.cambiarRol("demo-subencargada", "gerente", "todo-incluido")).toEqual({ ok: true });
    expect(accesos.darDeBaja("demo-maria")).toEqual({ ok: true });
  });
  test("invitar: queda «invitada», caduca en 7 días y no repite correo ni profesional", () => {
    const ahora = new Date("2026-09-25T10:00:00Z");
    expect(accesos.invitarMiembro({ email: "ana@x.es", rol: "recepcion", employeeId: null, displayName: "Ana" }, "todo-incluido", ahora)).toEqual({ ok: true });
    const ana = accesos.listarMiembros().find((m) => m.email === "ana@x.es")!;
    expect(ana.estado).toBe("invitada");
    expect(ana.caducaEn?.slice(0, 10)).toBe("2026-10-02");
    expect(accesos.invitarMiembro({ email: "ANA@x.es", rol: "recepcion", employeeId: null, displayName: null }, "todo-incluido")).toMatchObject({ codigo: "DUPLICADO" });
    expect(accesos.invitarMiembro({ email: "otra@x.es", rol: "estilista", employeeId: "sara", displayName: null }, "todo-incluido")).toMatchObject({ codigo: "VINCULO" });
  });
  test("una estilista necesita profesional vinculada", () => {
    expect(accesos.invitarMiembro({ email: "b@x.es", rol: "estilista", employeeId: null, displayName: null }, "todo-incluido")).toMatchObject({ codigo: "VINCULO" });
  });
  test("fuera de Todo incluido, solo dos tipos de acceso", () => {
    useAccesosDemo.setState({ miembros: miembrosDeDemo(equipo).filter((m) => m.rol !== "subencargado") });
    expect(accesos.invitarMiembro({ email: "r@x.es", rol: "recepcion", employeeId: null, displayName: null }, "reservas")).toMatchObject({ codigo: "PLAN" });
  });
  test("dar de baja quita al miembro de la lista y se puede restaurar", () => {
    const sara = accesos.listarMiembros().find((m) => m.displayName === "Sara")!;
    accesos.darDeBaja(sara.userId);
    expect(accesos.listarMiembros().some((m) => m.userId === sara.userId)).toBe(false);
    accesos.restaurar(sara);
    expect(accesos.listarMiembros().some((m) => m.userId === sara.userId)).toBe(true);
  });
});
