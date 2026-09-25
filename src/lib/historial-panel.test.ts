import { describe, expect, test } from "bun:test";
import { agruparPorDia, siguientePagina, CAMBIOS_POR_PAGINA } from "./historial-panel";
import type { Cambio } from "./cambios";

const c = (id: string, fecha: string): Cambio => ({
  id, tipo: "ajustes.editar", entidad: "perfil", idEntidad: "x", antes: {}, despues: {}, resumen: id, autor: null, autorNombre: null, fecha, avisoEnviado: false,
});

// Etiqueta de día determinista, sin depender del reloj del sistema.
const etiqueta = (fecha: string) => fecha.slice(0, 10);

describe("agruparPorDia", () => {
  test("agrupa cambios consecutivos del mismo día", () => {
    const lista = [c("1", "2026-09-26T10:00:00Z"), c("2", "2026-09-26T09:00:00Z"), c("3", "2026-09-25T08:00:00Z")];
    expect(agruparPorDia(lista, etiqueta)).toEqual([
      ["2026-09-26", [lista[0], lista[1]]],
      ["2026-09-25", [lista[2]]],
    ]);
  });
  test("respeta el orden de aparición de los días aunque no estén contiguos", () => {
    const lista = [c("1", "2026-09-26T10:00:00Z"), c("2", "2026-09-24T09:00:00Z"), c("3", "2026-09-26T08:00:00Z")];
    expect(agruparPorDia(lista, etiqueta).map(([dia]) => dia)).toEqual(["2026-09-26", "2026-09-24"]);
  });
  test("lista vacía, mapa vacío", () => {
    expect(agruparPorDia([], etiqueta)).toEqual([]);
  });
});

describe("siguientePagina", () => {
  test("página llena: hay más, antesDe es la fecha del último", () => {
    expect(siguientePagina(CAMBIOS_POR_PAGINA, CAMBIOS_POR_PAGINA, "2026-09-20T00:00:00Z")).toEqual({ hayMas: true, antesDe: "2026-09-20T00:00:00Z" });
  });
  test("página corta: no hay más", () => {
    expect(siguientePagina(3, CAMBIOS_POR_PAGINA, "2026-09-20T00:00:00Z")).toEqual({ hayMas: false, antesDe: undefined });
  });
  test("lista vacía (sin última fecha): no hay más aunque el límite coincida", () => {
    expect(siguientePagina(0, CAMBIOS_POR_PAGINA, undefined)).toEqual({ hayMas: false, antesDe: undefined });
  });
});
