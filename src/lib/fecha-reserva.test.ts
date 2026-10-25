import { describe, expect, it } from "bun:test";
import { employeesForType } from "./mock/salon";
import {
  alternativasAUnaHora,
  anteriorDiaAbierto,
  proximoDiaConProfesional,
  siguienteDiaAbierto,
  sumarDiasDeReserva,
} from "./fecha-reserva";

const HORARIO = [
  "Cerrado",
  "10:00–20:00",
  "10:00–20:00",
  "10:00–20:00",
  "10:00–20:00",
  "9:00–14:00",
  "Cerrado",
];
const TURNOS = [
  ["Cerrado", "14:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "Cerrado", "Cerrado"],
  ["Cerrado", "10:00–20:00", "Cerrado", "14:00–20:00", "10:00–20:00", "9:00–14:00", "Cerrado"],
  ["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "9:00–13:00", "Cerrado"],
];
const equipo = employeesForType("peluqueria", ["María", "Anca", "Patricia"], TURNOS, HORARIO, [
  "maria",
  "anca",
  "patricia",
]);

describe("navegación por días de reserva", () => {
  it("mantiene la fecha al cruzar el cambio al horario de invierno", () => {
    expect(sumarDiasDeReserva("2026-10-25", 1)).toBe("2026-10-26");
    expect(sumarDiasDeReserva("2026-10-25", -1)).toBe("2026-10-24");
  });

  it("salta domingo y lunes al avanzar, y no retrocede antes del mínimo", () => {
    expect(siguienteDiaAbierto("2026-10-31", equipo)).toBe("2026-11-03");
    expect(anteriorDiaAbierto("2026-11-03", "2026-10-25", equipo)).toBe("2026-10-31");
    expect(anteriorDiaAbierto("2026-10-27", "2026-10-27", equipo)).toBeUndefined();
  });

  it("salta también un cierre especial", () => {
    expect(
      siguienteDiaAbierto("2026-11-07", equipo, [{ fecha: "2026-11-10", cerrado: true }]),
    ).toBe("2026-11-11");
  });
});

describe("disponibilidad de una profesional", () => {
  it("encuentra su siguiente día con un hueco, como máximo a 60 días", () => {
    expect(
      proximoDiaConProfesional({
        desde: "2026-10-27",
        employee: equipo[1],
        employees: equipo,
        appointments: [],
        durationMin: 60,
        now: new Date("2026-10-27T08:00:00+01:00"),
        timeZone: "Europe/Madrid",
      }),
    ).toBe("2026-10-29");
  });

  it("devuelve solo las alternativas libres a esa hora", () => {
    expect(
      alternativasAUnaHora("maria", [equipo[0], equipo[1], equipo[2]]).map((e) => e.name),
    ).toEqual(["Anca", "Patricia"]);
    expect(alternativasAUnaHora("anca", [equipo[1]])).toEqual([]);
  });
});
