import { describe, expect, test } from "bun:test";
import { seccionCoincide, valorActual } from "./ajustes-resumen-panel";
import type { SalonProfile } from "./mock/types";

const perfil = (extra: Partial<SalonProfile> = {}) => ({ name: "PeluChic", ...extra }) as SalonProfile;

describe("Ajustes: buscador y valor actual (lote 16)", () => {
  test("el buscador encuentra por palabras y sin tildes", () => {
    expect(seccionCoincide("plantones", "bizum")).toBe(true);
    expect(seccionCoincide("agenda", "horas visibles")).toBe(true);
    expect(seccionCoincide("agenda", "duracion")).toBe(true);
    expect(seccionCoincide("colores", "bizum")).toBe(false);
  });
  test("la cabecera dice el valor actual", () => {
    expect(valorActual("agenda", perfil({ calendario: { vista: "dia", desde: 9, hasta: 20 } } as Partial<SalonProfile>))).toBe("Día · 9:00–20:00");
    expect(valorActual("plantones", perfil({ noShowFeeEur: 7 }))).toContain("Plantón 7 €");
    expect(valorActual("mensajes", perfil())).toBe("Mensajes de siempre");
  });
});
