import { describe, expect, it } from "bun:test";
import { employeesForType } from "./mock/salon";
import { franjasProfesional, franjasProfesionalEnFecha, huecosDeProfesionales, trabajaEn, trabajaEnFecha } from "./horario-equipo";

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

describe("días especiales", () => {
  const salon = ["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "09:00–14:00"];
  const equipo = employeesForType("peluqueria", ["María", "anca"], [salon, salon], salon, ["maria", "anca"]);

  it("un festivo cerrado deja a todo el equipo sin franjas", () => {
    expect(franjasProfesionalEnFecha(equipo[0], "2026-12-25", [{ fecha: "2026-12-25", cerrado: true }])).toEqual([]);
  });

  it("un cierre parcial intersecta con la jornada habitual", () => {
    const especiales = [{ fecha: "2026-12-24", franjas: [{ inicio: "10:00", fin: "15:00" }] }];
    expect(franjasProfesionalEnFecha(equipo[0], "2026-12-24", especiales)).toEqual([{ start: 600, end: 900 }]);
    expect(trabajaEnFecha(equipo[0], "2026-12-24", 870, 60, especiales)).toBe(false);
  });

  it("la apertura excepcional deja trabajar solo a María aunque el lunes cierre", () => {
    const especiales = [{ fecha: "2026-12-21", soloProfesionales: { maria: [{ inicio: "10:00", fin: "20:00" }] } }];
    expect(trabajaEnFecha(equipo[0], "2026-12-21", 600, 60, especiales)).toBe(true);
    expect(franjasProfesionalEnFecha(equipo[1], "2026-12-21", especiales)).toEqual([]);
  });

  it("soloProfesionales manda sobre la semana y abre a anca el 23 por la tarde", () => {
    const especiales = [{ fecha: "2026-12-23", soloProfesionales: { anca: [{ inicio: "15:00", fin: "20:00" }] } }];
    expect(franjasProfesionalEnFecha(equipo[0], "2026-12-23", especiales)).toEqual([]);
    expect(trabajaEnFecha(equipo[1], "2026-12-23", 900, 60, especiales)).toBe(true);
    expect(trabajaEnFecha(equipo[1], "2026-12-23", 870, 30, especiales)).toBe(false);
  });

  it("una franja especial degenerada o mal escrita no abre 24 horas", () => {
    const especiales = [
      { fecha: "2026-12-22", franjas: [{ inicio: "10:00", fin: "10:00" }] },
      { fecha: "2026-12-23", soloProfesionales: { maria: [{ inicio: "mal", fin: "15:00" }] } },
    ];
    expect(franjasProfesionalEnFecha(equipo[0], "2026-12-22", especiales)).toEqual([]);
    expect(franjasProfesionalEnFecha(equipo[0], "2026-12-23", especiales)).toEqual([]);
  });
});
