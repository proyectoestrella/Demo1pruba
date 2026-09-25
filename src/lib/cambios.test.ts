import { describe, expect, test } from "bun:test";
import {
  accionDe, aplicarDeshacerEnLista, cambioDeDeshacer, diferencia, inverso, mismoValor, podar, puedeDeshacer, registrarCambio, sigueIgual,
  type Cambio, type ContextoDeshacer,
} from "./cambios";

const ahora = new Date("2026-09-26T10:00:00Z");
const cancelar = registrarCambio({
  id: "c1", tipo: "cita.cancelar", entidad: "cita", idEntidad: "a1",
  antes: { status: "confirmed", start: "2026-09-30T08:00:00Z", clientName: "Lucía" },
  despues: { status: "cancelled", start: "2026-09-30T08:00:00Z", clientName: "Lucía" },
  resumen: "Cancelada la cita de Lucía (mar 30, 10:00)", autor: "noelia", autorNombre: "Noelia", fecha: "2026-09-26T09:00:00Z",
})!;
const ctx = (p: Partial<ContextoDeshacer> = {}): ContextoDeshacer => ({
  actual: { status: "cancelled", start: "2026-09-30T08:00:00Z" }, cambios: [cancelar], quien: "noelia", puedeLaAccion: true, puedeAjeno: false, ahora, ...p,
});

describe("registro de cambios", () => {
  test("solo guarda los campos que cambian", () => {
    expect(cancelar.antes).toEqual({ status: "confirmed" });
    expect(cancelar.despues).toEqual({ status: "cancelled" });
    expect(inverso(cancelar)).toEqual({ status: "confirmed" });
  });
  test("sin cambio real no hay registro; los objetos se comparan sin importar el orden", () => {
    expect(registrarCambio({ id: "x", tipo: "cita.editar", entidad: "cita", idEntidad: "a", antes: { a: { x: 1, y: 2 } }, despues: { a: { y: 2, x: 1 } }, resumen: "", fecha: "" })).toBeNull();
    expect(diferencia({ a: 1 }, { a: 1, b: undefined })).toEqual({ antes: {}, despues: {} });
    expect(diferencia({}, { nuevo: 5 })).toEqual({ antes: { nuevo: null }, despues: { nuevo: 5 } });
  });
  test("cada tipo sabe qué permiso pide deshacerlo", () => {
    expect(accionDe("cita.rechazar")).toBe("cita.rechazar-solicitud");
    expect(accionDe("servicio.borrar")).toBe("servicio.editar");
    expect(accionDe("perfil.restaurar")).toBe("web.restaurar-version");
  });
  test("undefined, null y \"\" son el mismo «vacío» (logoUrl: undefined → \"\" al publicar no es un cambio)", () => {
    expect(mismoValor(undefined, "")).toBe(true);
    expect(mismoValor(null, "")).toBe(true);
    expect(mismoValor(undefined, null)).toBe(true);
    expect(mismoValor("", "")).toBe(true);
    // Pero vacío sigue siendo distinto de algo con contenido, en cualquier sentido.
    expect(mismoValor("", "https://x.test/logo.png")).toBe(false);
    expect(mismoValor("https://x.test/logo.png", "")).toBe(false);
    expect(mismoValor(undefined, 0)).toBe(false);
    expect(
      registrarCambio({
        id: "logo", tipo: "perfil.campo", entidad: "perfil", idEntidad: "logoUrl",
        antes: { logoUrl: null }, despues: { logoUrl: "" }, resumen: "", fecha: "",
      }),
    ).toBeNull();
  });
});

describe("¿se puede deshacer?", () => {
  test("lo suyo, con el estado igual: sí", () => {
    expect(puedeDeshacer(cancelar, ctx())).toEqual({ puede: true });
  });
  test("si el estado ha cambiado desde entonces: CAMBIADO", () => {
    expect(puedeDeshacer(cancelar, ctx({ actual: { status: "confirmed" } }))).toEqual({ puede: false, motivo: "CAMBIADO" });
    expect(sigueIgual(cancelar, null)).toBe(false);
  });
  test("lo de otra persona sin historial.deshacer-ajeno: PERMISO; con él, sí", () => {
    expect(puedeDeshacer(cancelar, ctx({ quien: "sara" }))).toEqual({ puede: false, motivo: "PERMISO" });
    expect(puedeDeshacer(cancelar, ctx({ quien: "maria", puedeAjeno: true }))).toEqual({ puede: true });
    expect(puedeDeshacer(cancelar, ctx({ puedeLaAccion: false }))).toEqual({ puede: false, motivo: "PERMISO" });
  });
  test("un cambio posterior sobre los mismos campos obliga a deshacer antes ese", () => {
    const despues: Cambio = { ...cancelar, id: "c2", antes: { status: "cancelled" }, despues: { status: "confirmed" }, fecha: "2026-09-26T09:30:00Z" };
    expect(puedeDeshacer(cancelar, ctx({ cambios: [cancelar, despues], actual: { status: "confirmed" } }))).toEqual({ puede: false, motivo: "POSTERIORES" });
  });
  test("mover a un hueco que ya está ocupado: SOLAPE", () => {
    const mover = registrarCambio({ id: "m", tipo: "cita.mover", entidad: "cita", idEntidad: "a1", antes: { start: "A" }, despues: { start: "B" }, resumen: "Movida", autor: "noelia", fecha: "2026-09-26T09:00:00Z" })!;
    expect(puedeDeshacer(mover, ctx({ actual: { start: "B" }, cambios: [mover], huecoLibre: false }))).toEqual({ puede: false, motivo: "SOLAPE" });
  });
  test("clienta ya avisada por WhatsApp: se puede, con aviso", () => {
    expect(puedeDeshacer({ ...cancelar, avisoEnviado: true }, ctx())).toEqual({ puede: true, aviso: "CLIENTA_AVISADA" });
  });
  test("más de 90 días o ya deshecho: no", () => {
    expect(puedeDeshacer(cancelar, ctx({ ahora: new Date("2027-01-01T00:00:00Z") }))).toEqual({ puede: false, motivo: "CADUCADO" });
    expect(puedeDeshacer({ ...cancelar, deshechoEn: "x" }, ctx())).toEqual({ puede: false, motivo: "DESHECHO" });
  });
});

describe("deshacer en la lista", () => {
  test("marca el original y añade el inverso, que a su vez se puede deshacer (rehacer)", () => {
    const d = cambioDeDeshacer(cancelar, { id: "d1", autor: "noelia", autorNombre: "Noelia", fecha: "2026-09-26T09:10:00Z" });
    expect(d.despues).toEqual({ status: "confirmed" });
    expect(d.resumen).toBe("Deshecho: cancelada la cita de Lucía (mar 30, 10:00)");
    const lista = aplicarDeshacerEnLista([cancelar], cancelar, d);
    expect(lista[0].id).toBe("d1");
    expect(lista[1].deshechoEn).toBe("2026-09-26T09:10:00Z");
    expect(puedeDeshacer(d, ctx({ actual: { status: "confirmed" }, cambios: lista }))).toEqual({ puede: true });
  });
  test("retención: fuera lo de más de 90 días, como mucho 200", () => {
    const viejo = { ...cancelar, id: "v", fecha: "2026-05-01T00:00:00Z" };
    expect(podar([cancelar, viejo], ahora).map((c) => c.id)).toEqual(["c1"]);
  });
});
