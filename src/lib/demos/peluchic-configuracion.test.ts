import { describe, expect, it } from "bun:test";

import { trabajaEnFecha } from "../horario-equipo";
import { employeesForType } from "../mock/salon";
import { importeSenal, reglaSenal } from "../senal";
import { PELUCHIC } from "./peluchic";

const equipo = employeesForType(
  "peluqueria", PELUCHIC.team, PELUCHIC.teamHours, PELUCHIC.openingHours, PELUCHIC.teamIds,
  undefined, PELUCHIC.serviciosPorProfesional,
);
const porId = new Map(equipo.map((e) => [e.id, e]));
const trabaja = (id: string, fecha: string, minuto: number, duracion = 30) =>
  trabajaEnFecha(porId.get(id)!, fecha, minuto, duracion, PELUCHIC.diasEspeciales);

describe("configuración real de PeluChic · 7-oct-2026", () => {
  it("aplica cuatro situaciones de días especiales", () => {
    expect(trabaja("patricia", "2026-12-08", 10 * 60)).toBe(false); // festivo cerrado
    expect(trabaja("patricia", "2026-12-24", 14 * 60 + 30)).toBe(true); // hasta las 15:00
    expect(trabaja("patricia", "2026-12-24", 15 * 60)).toBe(false);
    expect(trabaja("maria", "2026-12-21", 10 * 60)).toBe(true); // lunes excepcional
    expect(trabaja("anca", "2026-12-21", 10 * 60)).toBe(false);
    expect(trabaja("anca", "2026-12-23", 14 * 60 + 30)).toBe(false);
    expect(trabaja("anca", "2026-12-23", 15 * 60)).toBe(true); // solo Anca desde las 15
  });

  it("Dermapen facial solo lo ofrece Patricia", () => {
    for (const e of equipo) expect(e.servicios?.includes("dermapen-facial") ?? true).toBe(e.id === "patricia");
  });

  it("el martes a las 11 María no está disponible y Patricia sí", () => {
    expect(trabaja("maria", "2026-10-13", 11 * 60)).toBe(false);
    expect(trabaja("patricia", "2026-10-13", 11 * 60)).toBe(true);
  });

  it("el sábado a las 13:30 solo Anca está disponible", () => {
    expect(equipo.filter((e) => trabaja(e.id, "2026-10-17", 13 * 60 + 30)).map((e) => e.id)).toEqual(["anca"]);
  });

  it("la fianza configurada daría 7,50 € para 90 minutos al activarla", () => {
    const regla = reglaSenal({ ...PELUCHIC, depositEnabled: true });
    expect(importeSenal(regla, { serviceIds: ["ritual-hidroface"], durationMin: 90, priceEur: 65 })).toBe(7.5);
  });
});
