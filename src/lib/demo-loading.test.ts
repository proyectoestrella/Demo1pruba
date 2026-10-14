import { describe, expect, test } from "bun:test";
import {
  debeEsperarPortadaDemo,
  debeMostrarPantallaCargaDemo,
  inicialesDelSalon,
} from "./demo-loading";

describe("carga de la demo pública", () => {
  test("extrae una o dos iniciales legibles del nombre del salón", () => {
    expect(inicialesDelSalon("PeluChic")).toBe("P");
    expect(inicialesDelSalon("  Peluquería Los Ángeles ")).toBe("PL");
    expect(inicialesDelSalon(" ")).toBe("S");
  });

  test("solo muestra la pantalla inicial en enlaces de demostración", () => {
    expect(debeMostrarPantallaCargaDemo(true)).toBe(true);
    expect(debeMostrarPantallaCargaDemo(false)).toBe(false);
  });

  test("solo espera la carga de imagen cuando hay una portada que cargar", () => {
    expect(debeEsperarPortadaDemo(true)).toBe(true);
    expect(debeEsperarPortadaDemo(false)).toBe(false);
  });
});
