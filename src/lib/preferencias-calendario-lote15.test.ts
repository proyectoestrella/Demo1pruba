import { describe, expect, test } from "bun:test";
import { useSalonStore } from "@/lib/store";
import { PREFERENCIAS_POR_DEFECTO, parcheCalendario, preferenciasDe, tramosDeCitas, horasDeRejilla, citasFueraDeHoras } from "@/lib/preferencias-calendario";

describe("lote 15 · horas visibles del calendario", () => {
  test("null, vacío o texto no numérico valen el por defecto (no las 00:00)", () => {
    expect(preferenciasDe({ desde: null, hasta: "" } as never)).toEqual(PREFERENCIAS_POR_DEFECTO);
    expect(preferenciasDe({ desde: "abc", hasta: undefined } as never)).toEqual(PREFERENCIAS_POR_DEFECTO);
    expect(preferenciasDe(null)).toEqual(PREFERENCIAS_POR_DEFECTO);
    expect(preferenciasDe({ primerDia: null } as never).primerDia).toBe(1);
  });
  test("límites 0-24 y hasta > desde con dos horas mínimo", () => {
    expect(preferenciasDe({ desde: -3, hasta: 30 })).toMatchObject({ desde: 0, hasta: 24 });
    expect(preferenciasDe({ desde: 20, hasta: 10 })).toMatchObject({ desde: 20, hasta: 22 });
    expect(preferenciasDe({ desde: 23, hasta: 24 })).toMatchObject({ desde: 22, hasta: 24 });
    expect(preferenciasDe({ desde: "9" as never, hasta: 18.6 })).toMatchObject({ desde: 9, hasta: 19 });
  });
  test("vista y primer día inválidos vuelven al por defecto", () => {
    expect(preferenciasDe({ vista: "anual" as never, primerDia: 3 as never })).toMatchObject({ vista: "semana", primerDia: 1 });
    expect(preferenciasDe({ vista: "cronograma", primerDia: 0 })).toMatchObject({ vista: "cronograma", primerDia: 0 });
  });
  test("parcheCalendario conserva lo que no cambia y viaja completo", () => {
    expect(parcheCalendario({ vista: "dia", primerDia: 6, desde: 7, hasta: 15 }, { desde: 9 })).toEqual({
      calendario: { vista: "dia", primerDia: 6, desde: 9, hasta: 15 },
    });
  });
  test("la store guarda y lee coherente: un cambio parcial no borra la vista", () => {
    useSalonStore.getState().updateSalonProfile({ calendario: { vista: "dia", primerDia: 0, desde: 7, hasta: 20 } });
    useSalonStore.getState().updateSalonProfile({ calendario: { hasta: 3 } });
    expect(useSalonStore.getState().salonProfile.calendario).toEqual({ vista: "dia", primerDia: 0, desde: 7, hasta: 9 });
    expect(preferenciasDe(useSalonStore.getState().salonProfile.calendario)).toEqual({ vista: "dia", primerDia: 0, desde: 7, hasta: 9 });
  });
  test("las horas visibles no recortan datos: la rejilla se ensancha por las citas de fuera", () => {
    const tramos = tramosDeCitas([
      { start: "2026-09-26T06:30:00", duration: 60, status: "confirmed" },
      { start: "2026-09-26T22:00:00", duration: 90, status: "pending" },
      { start: "2026-09-26T05:00:00", duration: 30, status: "cancelled" },
    ] as never);
    expect(tramos).toHaveLength(2);
    expect(horasDeRejilla({ desde: 9, hasta: 18 }, tramos)).toEqual({ desde: 6, hasta: 24 });
    expect(citasFueraDeHoras(tramos, { desde: 9, hasta: 18 })).toBe(2);
  });
});
