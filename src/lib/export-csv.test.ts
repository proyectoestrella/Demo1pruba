import { describe, expect, it } from "bun:test";
import { citasToCsv, resumenMensualToCsv, pagosToCsvGestoria, BOM } from "./export-csv";
import { agruparPagosPorCita, type Pago } from "./pagos";
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
    expect(cabecera).toBe("Fecha;Hora;Clienta;Servicio;Profesional;Precio (€);Estado;Respuestas al reservar");
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

  it("con pagosPorCita, usa el cobrado real; sin pagos de una cita, el fallback de siempre", () => {
    const pagos: Pago[] = [{ id: "p1", appointmentId: "a1", importeEur: 9, metodo: "efectivo", concepto: "servicio", origen: "sishow", fecha: "2026-09-15T10:30:00.000Z", createdAt: "2026-09-15T10:30:00.000Z" }];
    const mapa = agruparPagosPorCita(pagos);
    const csvConMapa = resumenMensualToCsv([cita({})], EMPLOYEES_LIST, mapa);
    expect(csvConMapa).toContain("Mario;1;9");
    const csvSinMapa = resumenMensualToCsv([cita({})], EMPLOYEES_LIST);
    expect(csvSinMapa).toContain("Mario;1;15");
  });
});

describe("citasToCsv con pagosPorCita", () => {
  it("usa el cobrado real cuando se pasa el mapa; si no, priceEur", () => {
    const mapa = agruparPagosPorCita([{ id: "p1", appointmentId: "a1", importeEur: 7, metodo: "bizum", concepto: "servicio", origen: "sishow", fecha: "2026-09-15T10:30:00.000Z", createdAt: "2026-09-15T10:30:00.000Z" }]);
    const csv = citasToCsv([cita({})], SERVICES, EMPLOYEES, undefined, mapa);
    expect(csv).toContain(";7;");
    const csvSinMapa = citasToCsv([cita({})], SERVICES, EMPLOYEES);
    expect(csvSinMapa).toContain(";15;");
  });
});

describe("pagosToCsvGestoria", () => {
  const pagos: Pago[] = [
    { id: "p1", clientId: "c1", importeEur: 20.5, metodo: "efectivo", concepto: "servicio", origen: "sishow", fecha: "2026-09-15T10:30:00.000Z", createdAt: "2026-09-15T10:30:00.000Z", nota: "Corte" },
    { id: "p2", clientName: "Marta", importeEur: 5, metodo: "bizum", concepto: "senal", origen: "sishow", fecha: "2026-09-16T09:00:00.000Z", createdAt: "2026-09-16T09:00:00.000Z", cobradoPor: "mario" },
  ];

  it("BOM, separador ; y coma decimal española en el importe", () => {
    const csv = pagosToCsvGestoria(pagos, { c1: "Ana" }, { mario: "Mario" });
    expect(csv.startsWith(BOM)).toBe(true);
    const filas = csv.slice(BOM.length).split("\r\n");
    expect(filas[0]).toBe("Fecha;Hora;Concepto;Método;Importe (€);Cliente;Cobrado por;Nota;Origen");
    expect(filas[1]).toContain("20,50");
    expect(filas[1]).toContain("Ana");
    expect(filas[2]).toContain("5,00");
    expect(filas[2]).toContain("Mario");
    expect(filas[2]).toContain("Señal");
  });
});
