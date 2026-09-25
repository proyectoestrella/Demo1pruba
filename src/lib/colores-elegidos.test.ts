import { afterEach, describe, expect, test } from "bun:test";
import { colorElegidoProfesional, sincronizarColores } from "./colores-elegidos";
import { indiceColorServicio } from "./hoy-arena";
import type { Service } from "./mock/types";

const carta = [{ id: "a", name: "A" }, { id: "b", name: "B" }] as Service[];

describe("colores elegidos por la dueña", () => {
  afterEach(() => sincronizarColores(undefined, undefined));
  test("sin elegir, el color sale por posición en la carta", () => {
    expect([indiceColorServicio("a", carta), indiceColorServicio("b", carta)]).toEqual([1, 2]);
  });
  test("lo elegido manda, y los valores fuera de la paleta se ignoran", () => {
    sincronizarColores({ a: 5, b: 9 }, { maria: 3, sara: 0 });
    expect([indiceColorServicio("a", carta), indiceColorServicio("b", carta)]).toEqual([5, 2]);
    expect([colorElegidoProfesional("maria"), colorElegidoProfesional("sara")]).toEqual([3, null]);
  });
});
