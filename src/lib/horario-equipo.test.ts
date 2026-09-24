import { describe, expect, it } from "bun:test";
import { employeesForType } from "./mock/salon";
import { franjasProfesional, huecosDeProfesionales, trabajaEn } from "./horario-equipo";

describe("horario de cada profesional", () => {
  const salón = ["09:00–20:00", "Cerrado", "Cerrado", "Cerrado", "Cerrado", "Cerrado", "Cerrado"];

  it("ofrece el lunes solo a quien trabaja, respetando la salida y los tramos", () => {
    const equipo = employeesForType("peluqueria", ["Ana", "Lola"], [
      ["10:00–12:00, 13:00–15:00", ...salón.slice(1)],
      ["12:00–16:00", ...salón.slice(1)],
    ], salón);
    expect(franjasProfesional(equipo[0], 1)).toEqual([{ start: 600, end: 720 }, { start: 780, end: 900 }]);
    expect(trabajaEn(equipo[0], 1, 690, 30)).toBe(true);
    expect(trabajaEn(equipo[0], 1, 720, 30)).toBe(false);
    expect(huecosDeProfesionales(equipo, 1, 60)).toEqual([600, 630, 660, 720, 750, 780, 810, 840, 870, 900]);
  });

  it("admite comienzos cada media hora y no ofrece días libres", () => {
    const equipo = employeesForType("peluqueria", ["Ana"], [["09:30–11:00", ...salón.slice(1)]], salón);
    expect(huecosDeProfesionales(equipo, 1, 30)).toEqual([570, 600, 630]);
    expect(huecosDeProfesionales(equipo, 2, 30)).toEqual([]);
  });
});
