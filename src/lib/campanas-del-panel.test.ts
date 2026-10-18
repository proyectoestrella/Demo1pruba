import { describe, expect, it } from "bun:test";
import type { Campana } from "./campanas";
import { campanasDelPanel } from "./campanas-del-panel";

const campana = (id: string): Campana => ({
  id,
  titulo: id,
  resumenAQuien: "Prueba",
  cifra: 0,
  cifraLabel: "personas",
  personas: [],
  mensaje: "",
  coste: "Incluido",
});

describe("CampanasPanel con respuesta recortada", () => {
  it("en un salón real no reconstruye campañas desde citas/clientas si el servidor no las entregó", () => {
    const resena = campana("resena");
    const ampliadaLocal = campana("no-vuelven");

    expect(campanasDelPanel(true, [resena], [resena, ampliadaLocal])).toEqual([resena]);
    // Mientras llega la respuesta, la tarjeta de plan puede seguir pintándose
    // sin dereferenciar datos inexistentes.
    expect(campanasDelPanel(true, null, [resena, ampliadaLocal])).toEqual([]);
  });

  it("la demo mantiene su cálculo local completo", () => {
    const resena = campana("resena");
    const ampliada = campana("no-vuelven");
    expect(campanasDelPanel(false, null, [resena, ampliada])).toEqual([resena, ampliada]);
  });
});
