import { expect, it } from "bun:test";
import {
  fechaDeVistaHoja,
  hojaDelDia,
  recordatoriosPendientesManana,
  sumarDiasFecha,
  vistaHoja,
} from "./hoja-del-dia";
import type { Appointment } from "./mock/types";

const a = (id: string, employeeId: Appointment["employeeId"], start: string, colorFormula?: string, status: Appointment["status"] = "confirmed"): Appointment => ({
  id, employeeId, start, colorFormula, status, clientId: "c1", clientName: "Ana", serviceIds: ["color"], duration: 60, priceEur: 30,
});

it("abre la vista pedida y cuenta solo recordatorios pendientes de mañana", () => {
  expect(vistaHoja({ dia: "manana" })).toBe("manana");
  expect(vistaHoja({ dia: "2026-10-26" })).toBe("2026-10-26");
  expect(vistaHoja({ dia: "2026-02-30" })).toBe("hoy");
  expect(vistaHoja({ dia: "cualquier-cosa" })).toBe("hoy");
  expect(vistaHoja({})).toBe("hoy");
  const hoy = new Date(2026, 8, 24, 12);
  const citas = [
    a("pendiente", "mario", "2026-09-25T10:00:00"),
    { ...a("recordada", "mario", "2026-09-25T11:00:00"), reminderSentAt: "2026-09-24T12:00:00" },
    a("cancelada", "mario", "2026-09-25T12:00:00", undefined, "cancelled"),
    a("hoy", "mario", "2026-09-24T10:00:00"),
  ];
  expect(recordatoriosPendientesManana(citas, hoy)).toBe(1);
  expect(recordatoriosPendientesManana(citas.filter((c) => c.id !== "pendiente"), hoy)).toBe(0);
});

it("resuelve hoy y mañana en la zona del salón y suma fechas sin depender del proceso", () => {
  const instante = new Date("2026-10-26T00:30:00.000Z");
  expect(fechaDeVistaHoja("hoy", instante, "Atlantic/Canary")).toBe("2026-10-26");
  expect(fechaDeVistaHoja("hoy", instante, "America/New_York")).toBe("2026-10-25");
  expect(fechaDeVistaHoja("manana", instante, "America/New_York")).toBe("2026-10-26");
  expect(fechaDeVistaHoja("2027-03-14", instante, "America/New_York")).toBe("2027-03-14");
  expect(sumarDiasFecha("2026-12-31", 1)).toBe("2027-01-01");
});

it("filtra citas por la zona horaria del salón", () => {
  const citas = [a("limite", "mario", "2026-10-26T00:30:00.000Z")];
  expect(hojaDelDia(citas, "2026-10-26", "Europe/Madrid")).toHaveLength(1);
  expect(hojaDelDia(citas, "2026-10-25", "America/New_York")).toHaveLength(1);
});

it("agrupa por profesional, ordena horas y recupera el último color anterior", () => {
  const citas = [
    a("m-tarde", "mario", "2026-09-24T16:00:00"),
    a("d", "diego", "2026-09-24T11:00:00"),
    a("m-pronto", "mario", "2026-09-24T09:00:00"),
    a("anterior", "mario", "2026-09-20T12:00:00", "7.1"),
    a("cancelada", "diego", "2026-09-24T10:00:00", undefined, "cancelled"),
  ];
  const hoja = hojaDelDia(citas, "2026-09-24");
  expect(hoja.map((x) => x.cita.id)).toEqual(["d", "m-pronto", "m-tarde"]);
  expect(hoja[0].ultimoColor?.colorFormula).toBe("7.1");
});
