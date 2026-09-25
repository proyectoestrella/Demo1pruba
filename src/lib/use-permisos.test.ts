import { describe, expect, test } from "bun:test";
import { saludo } from "./use-permisos";

describe("saludo del panel", () => {
  test("con el nombre de pila del miembro", () => {
    expect(saludo("Noelia", 10)).toBe("Buenos días, Noelia");
    expect(saludo("María López", 16)).toBe("Buenas tardes, María");
    expect(saludo(null, 22)).toBe("Buenas noches");
  });
});
