import { describe, expect, it } from "bun:test";
import { citasToCsv, resumenMensualToCsv, BOM } from "./export-csv";
import type { Appointment, Employee, Service } from "./mock/types";

const SERVICES: Record<string, Service> = {
  corte: { id: "corte", name: "Corte de caballero", description: "", durationMin: 30, priceEur: 15 },
};

const EMPLOYEES: Record<string, Employee> = {
  mario: {
    id: "mario",
    name: "Mario",
    specialty: "",
    yearsExperience: 1,
    photo: "",
    colorVar: "--x",
    schedule: [null, null, null, null, null, null, null],
  },
};

const EMPLOYEES_LIST: Employee[] = [EMPLOYEES.mario];

function cita(overrides: Partial<Appointment>): Appointment {
  return {
    id: "a1",
    clientId: "c1",
    clientName: "Cliente Uno; Con punto y coma",
    serviceIds: ["corte"],
    employeeId: "mario",
    start: "2026-09-15T10:30:00.000Z",
    duration: 30,
    priceEur: 15,
    status: "completed",
    ...overrides,
  };
}

describe("citasToCsv", () => {
  it("empieza con el BOM y usa ; como separador en la cabecera", () => {
    const csv = citasToCsv([], SERVICES, EMPLOYEES);
    expect(csv.startsWith(BOM)).toBe(true);
    const cabecera = csv.slice(BOM.length).split("\r\n")[0];
    expect(cabecera).toBe("Fecha;Hora;Cliente;Servicio;Profesional;Precio (€);Estado;Respuestas al reservar");
  });

  it("vuelca cada cita en una fila con sus datos resueltos", () => {
    const csv = citasToCsv([cita({})], SERVICES, EMPLOYEES);
    const filas = csv.slice(BOM.length).split("\r\n");
    expect(filas).toHaveLength(2);
    expect(filas[1]).toContain("Corte de caballero");
    expect(filas[1]).toContain("Mario");
    expect(filas[1]).toContain("Vino"); // la etiqueta de "completed" ahora es "Vino"
  });

  it("entrecomilla un campo que contiene el separador", () => {
    const csv = citasToCsv([cita({})], SERVICES, EMPLOYEES);
    expect(csv).toContain('"Cliente Uno; Con punto y coma"');
  });
});

describe("resumenMensualToCsv", () => {
  it("empieza con BOM y separa por ; los dos bloques (día y profesional)", () => {
    const csv = resumenMensualToCsv([cita({})], EMPLOYEES_LIST);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain("Resumen por día");
    expect(csv).toContain("Resumen por profesional");
    expect(csv).toContain("Fecha;Citas;Facturación (€)");
    expect(csv).toContain("Profesional;Citas;Facturación (€)");
  });

  it("no cuenta canceladas y no factura las que no asistió", () => {
    const csv = resumenMensualToCsv(
      [
        cita({ status: "completed", priceEur: 15 }),
        cita({ status: "cancelled", priceEur: 100 }),
        cita({ status: "no-show", priceEur: 50 }),
      ],
      EMPLOYEES_LIST,
    );
    // 15 de la completada; ni la cancelada ni la no-show suman a la facturación.
    expect(csv).toContain("Mario;2;15");
  });
});
