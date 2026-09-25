import { describe, expect, test } from "bun:test";
import { logoDelSalon } from "./logo-salon";

describe("logo del salón", () => {
  test("manda el logo del perfil", () => {
    expect(logoDelSalon({ name: "PeluChic", logoUrl: " https://x.es/logo.png " }, true)).toBe("https://x.es/logo.png");
  });
  test("la demo PeluChic resuelve su logo sin llevarlo en el enlace", () => {
    expect(logoDelSalon({ name: "PeluChic" }, true)).toBe("/demo/peluchic-logo.png");
    expect(logoDelSalon({ name: "Peluchic", logoUrl: "" }, true)).toBe("/demo/peluchic-logo.png");
  });
  test("un salón real que se llame igual no hereda el de la demo, y una demo sin logo usa la inicial", () => {
    expect(logoDelSalon({ name: "PeluChic" }, false)).toBeNull();
    expect(logoDelSalon({ name: "Barbería Paco" }, true)).toBeNull();
  });
});
