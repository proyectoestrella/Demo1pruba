import { describe, expect, it } from "bun:test";
import { cintaDeSalon } from "./salon-words";

describe("cintaDeSalon", () => {
  it("usa lo que el salón ha escrito de sí mismo, con mayúscula inicial", () => {
    expect(cintaDeSalon("Peluquería", ["color", "mechas", "recogidos de novia"])).toEqual([
      "Color",
      "Mechas",
      "Recogidos de novia",
    ]);
  });

  it("una barbería no habla de manicura", () => {
    const palabras = cintaDeSalon("Barbería");
    expect(palabras).toContain("Barba a navaja");
    expect(palabras).not.toContain("Manicura");
  });

  it("una peluquería de señoras no habla de barba", () => {
    const palabras = cintaDeSalon("Peluquería de señoras");
    expect(palabras.join(" ")).not.toMatch(/barba|afeitad/i);
    expect(palabras).toContain("Mechas");
  });

  it("un centro de estética habla de lo suyo", () => {
    expect(cintaDeSalon("Peluquería y estética")).toContain("Manicura");
  });

  it("sin tipo ni especialidades dice cosas ciertas para cualquier salón", () => {
    const palabras = cintaDeSalon(undefined);
    expect(palabras).toContain("Corte");
    expect(palabras.join(" ")).not.toMatch(/barba|manicura/i);
  });

  it("con una o dos especialidades sueltas prefiere el juego completo del tipo", () => {
    // Media cinta se ve como un error, no como una elección.
    expect(cintaDeSalon("Barbería", ["degradados"])).toContain("Toalla caliente");
  });
});
