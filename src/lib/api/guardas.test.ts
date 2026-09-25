import { describe, expect, it } from "bun:test";
import { PermisoDenegado, type Acceso } from "./autorizacion";
import { accionesDeParcheCita, accionesDeParchePerfil, exigirAcciones } from "./guardas";

const noelia: Acceso = { tipo: "miembro", userId: "u", rol: "estilista", employeeId: "noelia", displayName: "Noelia" };
const gerente: Acceso = { tipo: "miembro", userId: "g", rol: "gerente", employeeId: null, displayName: "María" };
const recepcion: Acceso = { tipo: "miembro", userId: "r", rol: "recepcion", employeeId: null, displayName: null };

describe("guardas de escritura por rol", () => {
  it("un parche de cita se traduce a sus acciones", () => {
    expect(accionesDeParcheCita({ status: "cancelled" })).toEqual(["cita.cancelar"]);
    expect(accionesDeParcheCita({ paidAt: "x", paymentMethod: "card" })).toEqual(["cita.cobrar"]);
    expect(accionesDeParcheCita({ start: "x" })).toEqual(["cita.mover"]);
    expect(accionesDeParcheCita({ depositStatus: "recibida" })).toEqual(["senal.gestionar"]);
    expect(accionesDeParcheCita({ colorFormula: "7.1" })).toEqual(["cita.editar"]);
  });

  it("una estilista cancela su cita, pero no la de otra ni la mueve a otra profesional", () => {
    expect(() => exigirAcciones(noelia, ["cita.cancelar"], ["noelia"])).not.toThrow();
    expect(() => exigirAcciones(noelia, ["cita.cancelar"], ["sara"])).toThrow(PermisoDenegado);
    expect(() => exigirAcciones(noelia, ["cita.mover"], ["noelia", "sara"])).toThrow(PermisoDenegado);
  });

  it("recepción no cobra; gerente puede todo", () => {
    expect(() => exigirAcciones(recepcion, accionesDeParcheCita({ paidAt: "x" }), ["sara"])).toThrow(PermisoDenegado);
    expect(() => exigirAcciones(gerente, accionesDeParcheCita({ paidAt: "x", start: "y" }), ["sara", "noelia"])).not.toThrow();
  });

  it("el perfil: web, equipo, carta y ajustes; una estilista no toca ninguno", () => {
    expect(accionesDeParchePerfil(["menu", "teamHours", "about", "depositEnabled"]).sort()).toEqual(["equipo.editar", "salon.editar", "servicio.editar", "web.editar"]);
    for (const k of ["menu", "team", "about", "depositEnabled"]) expect(() => exigirAcciones(noelia, accionesDeParchePerfil([k]))).toThrow(PermisoDenegado);
  });

  it("la demo pasa todas las guardas", () => {
    expect(() => exigirAcciones({ tipo: "demo" }, ["datos.borrar", "web.publicar"])).not.toThrow();
  });
});
