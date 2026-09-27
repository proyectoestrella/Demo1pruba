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

import { logotipoDelSalon } from "./logo-salon";

describe("logotipo con el nombre (logo real de PeluChic)", () => {
  test("el del perfil manda, por tono", () => {
    const p = { name: "Otro", logotipoClaroUrl: "/b.png", logotipoOscuroUrl: "/o.png" };
    expect(logotipoDelSalon(p, false, "claro")).toBe("/b.png");
    expect(logotipoDelSalon(p, false, "oscuro")).toBe("/o.png");
  });
  test("la demo PeluChic sin campo usa el suyo; un salón real que se llame igual, no", () => {
    expect(logotipoDelSalon({ name: "PeluChic" }, true, "claro")).toBe("/demo/peluchic-logotipo-blanco.png");
    expect(logotipoDelSalon({ name: "PeluChic" }, false, "claro")).toBeNull();
  });
  test("sin logotipo: null (se pinta el círculo y el nombre, como siempre)", () => {
    expect(logotipoDelSalon({ name: "The Best Shave & Barber" }, false, "oscuro")).toBeNull();
    expect(logotipoDelSalon({ name: "Barbería Pepe" }, true, "oscuro")).toBeNull();
  });
});
