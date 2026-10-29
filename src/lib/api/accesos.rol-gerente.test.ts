import { describe, expect, it } from "bun:test";
import type { Acceso } from "./autorizacion";
import {
  cambiarRol,
  type DepsAccesos,
  type InvitacionFila,
  type MiembroFila,
} from "./accesos";
import { permisosDe, puede, vePagina } from "../permisos";

/** Caso PeluChic: María (gerente) y Laura (gerente SIN profesional vinculada), plan Básico. */
function mundo(plan = "reservas") {
  const miembros: MiembroFila[] = [
    { userId: "maria", email: "maria@p.es", rol: "gerente", employeeId: null, displayName: "María", estado: "activa" },
    { userId: "laura", email: "laura@p.es", rol: "gerente", employeeId: null, displayName: "Laura", estado: "activa", permisosExtra: { verAgendaCompleta: true } },
    { userId: "noelia", email: "noelia@p.es", rol: "estilista", employeeId: "emp-noelia", displayName: "Noelia", estado: "activa" },
  ];
  const invs: InvitacionFila[] = [];
  const deps: DepsAccesos = {
    ahora: () => new Date("2026-10-29T10:00:00Z"),
    nuevoId: () => "x",
    plan: async () => plan,
    miembros: async () => miembros.map((m) => ({ ...m })),
    invitaciones: async () => invs.map((i) => ({ ...i })),
    guardarInvitacion: async () => {},
    enviarInvitacion: async () => {},
    guardarMiembro: async (m) => {
      const k = miembros.findIndex((x) => x.userId === m.userId);
      if (k >= 0) miembros[k] = m;
      else miembros.push(m);
    },
    correoDe: async () => null,
  };
  return { deps, miembros };
}
const maria: Acceso = { tipo: "miembro", userId: "maria", rol: "gerente", employeeId: null, displayName: "María" };

describe("bajar a una gerente a estilista (queja PeluChic)", () => {
  it("causa real: sin profesional el servidor rechaza con «Elige qué profesional…» y no cambia nada", async () => {
    const w = mundo();
    const antes = JSON.stringify(w.miembros);
    const r = await cambiarRol(maria, "laura", { rol: "estilista", employeeId: null }, w.deps);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.codigo).toBe("DATOS");
    expect(!r.ok && r.motivo).toContain("Elige qué profesional");
    expect(JSON.stringify(w.miembros)).toBe(antes);
  });

  it("(a) eligiendo profesional, la gerente (aunque haya otra gerente) pasa a estilista en plan Básico", async () => {
    const w = mundo("reservas");
    const r = await cambiarRol(maria, "laura", { rol: "estilista", employeeId: "emp-laura" }, w.deps);
    expect(r.ok).toBe(true);
    const laura = w.miembros.find((m) => m.userId === "laura")!;
    expect(laura.rol).toBe("estilista");
    expect(laura.employeeId).toBe("emp-laura");
  });

  it("(b) la estilista resultante conserva acceso: misma fila activa, mismo correo, y entra a su agenda", async () => {
    const w = mundo();
    await cambiarRol(maria, "laura", { rol: "estilista", employeeId: "emp-laura" }, w.deps);
    const laura = w.miembros.find((m) => m.userId === "laura")!;
    expect(laura.estado).toBe("activa");
    expect(laura.userId).toBe("laura");
    expect(laura.email).toBe("laura@p.es");
    expect(laura.displayName).toBe("Laura");
    expect(laura.permisosExtra).toEqual({ verAgendaCompleta: true });
    const p = permisosDe(laura.rol, laura.permisosExtra);
    for (const pag of ["hoy", "calendario", "citas", "clientas"] as const) expect(vePagina(p, pag)).toBe(true);
    expect(puede(p, "cita.crear")).toBe(true);
    expect(puede(p, "dinero.ver-propio", { employeeId: "emp-laura", miEmployeeId: laura.employeeId })).toBe(true);
    expect(puede(p, "accesos.gestionar")).toBe(false); // deja de gestionar: es el cambio buscado
  });

  it("(c) ningún otro miembro cambia", async () => {
    const w = mundo();
    const antes = w.miembros.filter((m) => m.userId !== "laura").map((m) => JSON.stringify(m));
    await cambiarRol(maria, "laura", { rol: "estilista", employeeId: "emp-laura" }, w.deps);
    expect(w.miembros.filter((m) => m.userId !== "laura").map((m) => JSON.stringify(m))).toEqual(antes);
    expect(w.miembros.length).toBe(3);
  });

  it("si ya tiene profesional vinculada, basta con el rol (se conserva)", async () => {
    const w = mundo();
    w.miembros[1].employeeId = "emp-laura";
    expect((await cambiarRol(maria, "laura", { rol: "estilista" }, w.deps)).ok).toBe(true);
    expect(w.miembros[1].employeeId).toBe("emp-laura");
  });

  it("no deja vincular una profesional que ya es de otro acceso", async () => {
    const w = mundo();
    const r = await cambiarRol(maria, "laura", { rol: "estilista", employeeId: "emp-noelia" }, w.deps);
    expect(!r.ok && r.motivo).toContain("ya tiene un acceso vinculado");
    expect(w.miembros[1].rol).toBe("gerente");
  });

  it("única gerente: mensaje claro (ULTIMA_GERENTE) y no cambia", async () => {
    const w = mundo();
    w.miembros.splice(1, 1); // solo queda María
    const otra: Acceso = { tipo: "miembro", userId: "noelia", rol: "gerente", employeeId: null, displayName: "x" };
    const r = await cambiarRol(otra, "maria", { rol: "estilista", employeeId: "emp-maria" }, w.deps);
    expect(!r.ok && r.codigo).toBe("ULTIMA_GERENTE");
    expect(!r.ok && r.motivo).toContain("única gerente");
    expect(w.miembros.find((m) => m.userId === "maria")!.rol).toBe("gerente");
  });

  it("plan: un tercer tipo de rol en Básico da PLAN; pasar a estilista no lo dispara aunque ya haya gerente y estilista", async () => {
    const w = mundo("reservas");
    const r = await cambiarRol(maria, "laura", { rol: "recepcion" }, w.deps);
    expect(!r.ok && r.codigo).toBe("PLAN");
    expect(!r.ok && r.motivo).toContain("dos tipos de acceso");
    expect((await cambiarRol(maria, "laura", { rol: "estilista", employeeId: "e" }, w.deps)).ok).toBe(true);
  });
});
