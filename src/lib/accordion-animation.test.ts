import { describe, expect, test } from "bun:test";
import { debeAnimarAcordeon } from "./accordion-animation";

describe("animación del acordeón", () => {
  test("no anima el contenido que ya estaba abierto al montar", () => {
    expect(debeAnimarAcordeon(false)).toBe(false);
  });

  test("anima los cambios tras la primera interacción", () => {
    expect(debeAnimarAcordeon(true)).toBe(true);
  });
});
