import { describe, expect, test } from "bun:test";
import { marcadoresQueFaltan, PLANTILLA_SENAL_POR_DEFECTO } from "./senal";
import { plantillaSenalEfectiva } from "./senal-panel";

describe("plantilla de la señal en Ajustes (14a)", () => {
  test("sin plantilla propia, cuenta la de siempre: no falta ningún marcador", () => {
    expect(plantillaSenalEfectiva("")).toBe(PLANTILLA_SENAL_POR_DEFECTO);
    expect(marcadoresQueFaltan(plantillaSenalEfectiva(""))).toEqual([]);
    expect(marcadoresQueFaltan(plantillaSenalEfectiva(undefined))).toEqual([]);
  });
  test("con plantilla propia sin importe ni bizum, sí avisa", () => {
    expect(marcadoresQueFaltan(plantillaSenalEfectiva("Hola {nombre}"))).toEqual(["{importe}", "{bizum}"]);
  });
});
