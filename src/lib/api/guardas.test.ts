import { describe, expect, it } from "bun:test";
import { PermisoDenegado, type Acceso } from "./autorizacion";
import {
  accionesDeParcheCita,
  accionesDeParchePerfil,
  exigirAcciones,
  soloCamposWeb,
} from "./guardas";

const noelia: Acceso = {
  tipo: "miembro",
  userId: "u",
  rol: "estilista",
  employeeId: "noelia",
  displayName: "Noelia",
};
const gerente: Acceso = {
  tipo: "miembro",
  userId: "g",
  rol: "gerente",
  employeeId: null,
  displayName: "María",
};
const recepcion: Acceso = {
  tipo: "miembro",
  userId: "r",
  rol: "recepcion",
  employeeId: null,
  displayName: null,
};

describe("guardas de escritura por rol", () => {
  it("un parche de cita se traduce a sus acciones", () => {
    expect(accionesDeParcheCita({ status: "cancelled" })).toEqual(["cita.cancelar"]);
    expect(accionesDeParcheCita({ status: "in-progress" })).toEqual(["cita.marcar-asistencia"]);
    expect(accionesDeParcheCita({ paidAt: "x", paymentMethod: "card" })).toEqual(["cita.cobrar"]);
    expect(accionesDeParcheCita({ start: "x" })).toEqual(["cita.mover"]);
    expect(accionesDeParcheCita({ depositStatus: "recibida" })).toEqual(["senal.gestionar"]);
    expect(accionesDeParcheCita({ colorFormula: "7.1" })).toEqual(["cita.editar"]);
  });

  it("una estilista cancela su cita, pero no la de otra ni la mueve a otra profesional", () => {
    expect(() => exigirAcciones(noelia, ["cita.cancelar"], ["noelia"])).not.toThrow();
    expect(() => exigirAcciones(noelia, ["cita.cancelar"], ["sara"])).toThrow(PermisoDenegado);
    expect(() => exigirAcciones(noelia, ["cita.mover"], ["noelia", "sara"])).toThrow(
      PermisoDenegado,
    );
  });

  it("recepción no cobra; gerente puede todo", () => {
    expect(() =>
      exigirAcciones(recepcion, accionesDeParcheCita({ paidAt: "x" }), ["sara"]),
    ).toThrow(PermisoDenegado);
    expect(() =>
      exigirAcciones(gerente, accionesDeParcheCita({ paidAt: "x", start: "y" }), [
        "sara",
        "noelia",
      ]),
    ).not.toThrow();
  });

  it("el perfil: web, equipo y ajustes; una estilista no toca ninguno", () => {
    expect(accionesDeParchePerfil(["menu", "teamHours", "about", "depositEnabled"]).sort()).toEqual(
      ["equipo.editar", "salon.editar", "web.editar"],
    );
    for (const k of ["menu", "team", "about", "depositEnabled"])
      expect(() => exigirAcciones(noelia, accionesDeParchePerfil([k]))).toThrow(PermisoDenegado);
  });

  it("los ajustes de reservas tienen su propia guarda y no heredan el mando del salón", () => {
    expect(
      accionesDeParchePerfil([
        "bookingQuestionsEnabled",
        "preguntasReserva",
        "ocultarPrecioReserva",
        "smartSpread",
      ]).sort(),
    ).toEqual(["reservas.editar"]);
    const conReservas: Acceso = {
      tipo: "miembro",
      userId: "noelia",
      rol: "estilista",
      employeeId: "noelia",
      displayName: "Noelia",
      permisosExtra: { accesoReservas: true },
    };
    expect(() => exigirAcciones(conReservas, ["reservas.editar"])).not.toThrow();
    expect(() => exigirAcciones(conReservas, ["salon.editar"])).toThrow(PermisoDenegado);
  });

  it("el acceso a web cubre todo su editor, pero no el plan ni la gestión del salón", () => {
    const conWeb: Acceso = {
      tipo: "miembro",
      userId: "noelia",
      rol: "estilista",
      employeeId: "noelia",
      displayName: "Noelia",
      permisosExtra: { accesoWeb: true },
    };
    expect(() =>
      exigirAcciones(conWeb, accionesDeParchePerfil(["logoUrl", "openingHours", "menu", "faq"])),
    ).not.toThrow();
    expect(() => exigirAcciones(conWeb, accionesDeParchePerfil(["plan"]))).toThrow(PermisoDenegado);
  });

  it("restaurar una versión de web no arrastra sus campos de mando", () => {
    expect(
      soloCamposWeb({ name: "PeluChic", menu: [], plan: "todo-incluido", depositEnabled: true }),
    ).toEqual({
      name: "PeluChic",
      menu: [],
    });
  });

  it("los avatares: el de una clienta pide editar clientas; el del equipo, editar equipo", () => {
    expect(accionesDeParchePerfil(["avataresClientas"])).toEqual(["clienta.editar"]);
    expect(accionesDeParchePerfil(["avataresEquipo"])).toEqual(["equipo.editar"]);
  });

  it("la demo pasa todas las guardas", () => {
    expect(() => exigirAcciones({ tipo: "demo" }, ["datos.borrar", "web.publicar"])).not.toThrow();
  });
});

it("un destino nulo no convierte alcance propio en permiso general", () => {
  const estilista: Acceso = { tipo: "miembro", userId: "sara", rol: "estilista", employeeId: "sara", displayName: null };
  for (const destino of [null, undefined, "otra"]) {
    expect(() => exigirAcciones(estilista, ["calendario-externo.gestionar"], [destino])).toThrow();
    expect(() => exigirAcciones(estilista, ["cita.editar"], [destino])).toThrow();
  }
  expect(() => exigirAcciones(estilista, ["calendario-externo.gestionar"], ["sara"])).not.toThrow();
});
