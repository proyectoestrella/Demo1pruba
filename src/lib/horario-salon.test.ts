import { describe, expect, it } from "bun:test";
import { avisoHorarioSalon, franjasSalonEnFecha } from "./horario-salon";

const semana = [
  "10:00–14:00, 16:00–20:00",
  "10:00–20:00",
  "10:00–20:00",
  "10:00–20:00",
  "10:00–20:00",
  "10:00–14:00",
  "Cerrado",
];

describe("avisoHorarioSalon", () => {
  it("avisa cuando el salón cierra por su horario semanal", () => {
    expect(avisoHorarioSalon({
      openingHours: semana,
      diasEspeciales: undefined,
      fecha: "2026-11-01",
      hora: "11:00",
      duracionMin: 30,
    })).toEqual({ tipo: "cerrado", mensaje: "Ese día el salón está cerrado" });
  });

  it("un día especial cerrado manda aunque la semana esté abierta", () => {
    expect(avisoHorarioSalon({
      openingHours: semana,
      diasEspeciales: [{ fecha: "2026-10-28", cerrado: true }],
      fecha: "2026-10-28",
      hora: "11:00",
      duracionMin: 30,
    })?.mensaje).toBe("Ese día el salón está cerrado");
  });

  it("avisa fuera de horario y enseña las franjas del salón", () => {
    expect(avisoHorarioSalon({
      openingHours: semana,
      diasEspeciales: undefined,
      fecha: "2026-10-26",
      hora: "14:00",
      duracionMin: 30,
    })).toEqual({
      tipo: "fuera",
      horario: "10:00–14:00, 16:00–20:00",
      mensaje: "Fuera del horario del salón (10:00–14:00, 16:00–20:00)",
    });
  });

  it("también avisa si la duración termina después del cierre", () => {
    expect(avisoHorarioSalon({
      openingHours: semana,
      diasEspeciales: undefined,
      fecha: "2026-10-27",
      hora: "19:45",
      duracionMin: 30,
    })?.tipo).toBe("fuera");
  });

  it("acepta una cita completa dentro de una franja", () => {
    expect(avisoHorarioSalon({
      openingHours: semana,
      diasEspeciales: undefined,
      fecha: "2026-10-26",
      hora: "16:00",
      duracionMin: 120,
    })).toBeNull();
  });

  it("las franjas de un día especial sustituyen al horario semanal", () => {
    const diasEspeciales = [{
      fecha: "2026-10-27",
      franjas: [{ inicio: "12:00", fin: "15:00" }],
    }];
    expect(franjasSalonEnFecha(semana, diasEspeciales, "2026-10-27")).toEqual([
      { start: 720, end: 900 },
    ]);
    expect(avisoHorarioSalon({
      openingHours: semana,
      diasEspeciales,
      fecha: "2026-10-27",
      hora: "10:00",
      duracionMin: 30,
    })?.mensaje).toBe("Fuera del horario del salón (12:00–15:00)");
  });

  it("un turno especial de una profesional abre un día semanalmente cerrado", () => {
    expect(avisoHorarioSalon({
      openingHours: semana,
      diasEspeciales: [{
        fecha: "2026-11-01",
        soloProfesionales: { maria: [{ inicio: "11:00", fin: "14:00" }] },
      }],
      fecha: "2026-11-01",
      hora: "12:00",
      duracionMin: 60,
    })).toBeNull();
  });
});
