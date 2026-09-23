import { describe, expect, it } from "bun:test";
import {
  esSoloUnProfesional,
  pasoAnterior,
  pasoInicial,
  pasoVisible,
  rotulosDePaso,
  siguientePaso,
  totalPasos,
} from "./solo-profesional";

describe("esSoloUnProfesional", () => {
  it("es cierto con exactamente un profesional", () => {
    expect(esSoloUnProfesional(1)).toBe(true);
    expect(esSoloUnProfesional([{}] as unknown as { length: number })).toBe(true);
  });

  it("es falso con dos o más, y también con cero", () => {
    expect(esSoloUnProfesional(2)).toBe(false);
    expect(esSoloUnProfesional(3)).toBe(false);
    expect(esSoloUnProfesional(0)).toBe(false);
  });
});

describe("pasos de la reserva con un solo profesional", () => {
  it("se salta el paso del profesional hacia delante", () => {
    expect(siguientePaso(1, true)).toBe(3);
    expect(siguientePaso(3, true)).toBe(4);
    expect(siguientePaso(4, true)).toBe(4);
  });

  it("y hacia atrás", () => {
    expect(pasoAnterior(3, true)).toBe(1);
    expect(pasoAnterior(4, true)).toBe(3);
    expect(pasoAnterior(1, true)).toBe(1);
  });

  it("arranca en fecha y hora si ya traía servicios elegidos", () => {
    expect(pasoInicial(true, true)).toBe(3);
    expect(pasoInicial(false, true)).toBe(1);
  });

  it("enseña tres pasos, bien numerados", () => {
    expect(totalPasos(true)).toBe(3);
    expect(pasoVisible(1, true)).toBe(1);
    expect(pasoVisible(3, true)).toBe(2);
    expect(pasoVisible(4, true)).toBe(3);
    expect(rotulosDePaso("barbero", true)).toEqual(["Servicio", "Fecha y hora", "Tus datos"]);
  });
});

describe("con varios profesionales todo sigue igual que siempre", () => {
  it("recorre los cuatro pasos sin saltos", () => {
    expect(siguientePaso(1, false)).toBe(2);
    expect(siguientePaso(2, false)).toBe(3);
    expect(siguientePaso(3, false)).toBe(4);
    expect(pasoAnterior(2, false)).toBe(1);
    expect(pasoAnterior(3, false)).toBe(2);
    expect(pasoInicial(true, false)).toBe(2);
  });

  it("enseña cuatro pasos con el rótulo del oficio", () => {
    expect(totalPasos(false)).toBe(4);
    expect(pasoVisible(3, false)).toBe(3);
    expect(rotulosDePaso("barbero", false)).toEqual([
      "Servicio",
      "Barbero",
      "Fecha y hora",
      "Tus datos",
    ]);
    expect(rotulosDePaso("profesional", false)[1]).toBe("Profesional");
  });
});
