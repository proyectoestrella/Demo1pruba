import { describe, expect, it } from "bun:test";
import {
  CLOSED,
  fromGoogleWeekdayDescriptions,
  isOpenNow,
  normalizeDay,
  parseRanges,
  todayOpenInfo,
  weekSchedule,
} from "./opening-hours";

// Martes 15 de septiembre de 2026 a la hora que se indique.
const martes = (h: number, m = 0) => new Date(2026, 8, 15, h, m);

describe("parseRanges", () => {
  it("entiende jornada partida con guion largo, corto o raya", () => {
    expect(parseRanges("10:00–13:30, 17:00–20:00")).toEqual([
      { start: 600, end: 810 },
      { start: 1020, end: 1200 },
    ]);
    expect(parseRanges("10:00-14:00")).toEqual([{ start: 600, end: 840 }]);
    expect(parseRanges("10:00 — 14:00")).toEqual([{ start: 600, end: 840 }]);
  });

  it("no revienta con texto que no es un horario", () => {
    expect(parseRanges("Cerrado")).toEqual([]);
    expect(parseRanges("Abierto las 24 horas")).toEqual([]);
    expect(parseRanges(undefined)).toEqual([]);
  });
});

describe("todayOpenInfo", () => {
  const partido = [
    "10:00–13:30, 17:00–20:00",
    "10:00–13:30, 17:00–20:00",
    "10:00–13:30, 17:00–20:00",
    "10:00–13:30, 17:00–20:00",
    "10:00–13:30, 17:00–20:00",
    "10:00–14:00",
    CLOSED,
  ];

  it("dentro de la franja de mañana dice a qué hora cierra ESA franja", () => {
    expect(todayOpenInfo(partido, martes(11))).toBe("Abierto · cierra a las 13:30");
    expect(isOpenNow(partido, martes(11))).toBe(true);
  });

  it("a mediodía dice a qué hora vuelve a abrir", () => {
    expect(todayOpenInfo(partido, martes(15))).toBe("Cerrado · abre a las 17:00");
    expect(isOpenNow(partido, martes(15))).toBe(false);
  });

  it("por la tarde dice el cierre de la tarde", () => {
    expect(todayOpenInfo(partido, martes(18, 30))).toBe("Abierto · cierra a las 20:00");
  });

  it("pasada la última franja es cerrado hoy", () => {
    expect(todayOpenInfo(partido, martes(21))).toBe("Cerrado hoy");
  });

  it("un domingo cerrado es cerrado, sin inventar aperturas", () => {
    expect(todayOpenInfo(partido, new Date(2026, 8, 20, 12))).toBe("Cerrado hoy");
  });
});

describe("fromGoogleWeekdayDescriptions", () => {
  it("quita el nombre del día y respeta el resto", () => {
    const out = fromGoogleWeekdayDescriptions([
      "lunes: 10:00–13:30, 17:00–20:00",
      "martes: 10:00–13:30, 17:00–20:00",
      "miércoles: 10:00–13:30, 17:00–20:00",
      "jueves: 10:00–13:30, 17:00–20:00",
      "viernes: 10:00–13:30, 17:00–20:00",
      "sábado: 10:00–14:00",
      "domingo: Cerrado",
    ]);
    expect(out?.[0]).toBe("10:00–13:30, 17:00–20:00");
    expect(out?.[5]).toBe("10:00–14:00");
    expect(out?.[6]).toBe(CLOSED);
  });

  it("rechaza una lista que no tiene siete días", () => {
    expect(fromGoogleWeekdayDescriptions(["lunes: 10:00–14:00"])).toBeUndefined();
    expect(fromGoogleWeekdayDescriptions(undefined)).toBeUndefined();
  });
});

describe("normalizeDay y weekSchedule", () => {
  it("lo que se escribe a mano queda interpretable", () => {
    expect(normalizeDay("  10:00 - 14:00 ,16:00-20:00 ")).toBe("10:00–14:00, 16:00–20:00");
    expect(normalizeDay("")).toBe(CLOSED);
    expect(normalizeDay("cerrado")).toBe(CLOSED);
  });

  it("el cuadro siempre tiene siete filas aunque falten días", () => {
    const rows = weekSchedule(["10:00–14:00"]);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ label: "Lunes", value: "10:00–14:00" });
    expect(rows[6]).toEqual({ label: "Domingo", value: CLOSED });
  });
});
