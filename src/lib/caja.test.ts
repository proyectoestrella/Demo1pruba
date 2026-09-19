import { describe, expect, it } from "bun:test";
import { cierreDelDia, esCobrable } from "./caja";
import type { Appointment, Employee } from "./mock/types";

const HOY = new Date("2026-09-20T12:00:00.000Z");

const EQUIPO = [
  { id: "mario", name: "Mario" },
  { id: "diego", name: "Diego" },
] as unknown as Employee[];

function cita(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: `a-${Math.random()}`,
    clientId: "c1",
    clientName: "Cliente de prueba",
    serviceIds: ["corte"],
    employeeId: "mario",
    start: new Date("2026-09-20T10:00:00.000Z").toISOString(),
    duration: 30,
    priceEur: 25,
    status: "confirmed",
    ...overrides,
  };
}

describe("cierre de caja del día", () => {
  it("suma solo lo que está marcado como cobrado y reparte por método", () => {
    const appts = [
      cita({ priceEur: 25, paidAt: HOY.toISOString(), paymentMethod: "efectivo" }),
      cita({ priceEur: 30, paidAt: HOY.toISOString(), paymentMethod: "bizum" }),
      cita({ priceEur: 18, paidAt: HOY.toISOString(), paymentMethod: "tarjeta" }),
      // Sin marcar: no entra en el total, pero sí en "pendientes".
      cita({ priceEur: 40 }),
    ];
    const c = cierreDelDia(appts, EQUIPO, HOY);
    expect(c.total).toBe(73);
    expect(c.porMetodo).toEqual({ efectivo: 25, bizum: 30, tarjeta: 18 });
    expect(c.pendientes).toHaveLength(1);
    expect(c.cobradas).toHaveLength(3);
  });

  it("reparte por profesional, de más a menos", () => {
    const appts = [
      cita({ employeeId: "mario", priceEur: 25, paidAt: HOY.toISOString(), paymentMethod: "efectivo" }),
      cita({ employeeId: "diego", priceEur: 60, paidAt: HOY.toISOString(), paymentMethod: "tarjeta" }),
      cita({ employeeId: "diego", priceEur: 15, paidAt: HOY.toISOString(), paymentMethod: "bizum" }),
    ];
    const c = cierreDelDia(appts, EQUIPO, HOY);
    expect(c.porProfesional.map((p) => [p.nombre, p.total, p.citas])).toEqual([
      ["Diego", 75, 2],
      ["Mario", 25, 1],
    ]);
  });

  it("un «Sin cita» cuenta igual que cualquier otra cita", () => {
    // Un walk-in nace con un clientId propio y sin ficha, pero pagó como
    // todos: tiene que contar en el total y en el reparto por profesional.
    const walkIn = cita({
      clientId: "walkin-1758000000000",
      clientName: "Cliente sin cita",
      note: "Sin cita — entró directamente",
      priceEur: 20,
      paidAt: HOY.toISOString(),
      paymentMethod: "efectivo",
    });
    const c = cierreDelDia([walkIn], EQUIPO, HOY);
    expect(c.total).toBe(20);
    expect(c.porProfesional).toEqual([
      { employeeId: "mario", nombre: "Mario", total: 20, citas: 1 },
    ]);
  });

  it("canceladas, plantones y bloqueos no son cobrables", () => {
    expect(esCobrable(cita({ status: "cancelled" }))).toBe(false);
    expect(esCobrable(cita({ status: "no-show" }))).toBe(false);
    expect(esCobrable(cita({ status: "blocked" }))).toBe(false);
    expect(esCobrable(cita({ status: "confirmed" }))).toBe(true);
    expect(esCobrable(cita({ status: "completed" }))).toBe(true);
  });

  it("no mezcla el día de hoy con los de otros días", () => {
    const ayer = cita({
      start: new Date("2026-09-19T10:00:00.000Z").toISOString(),
      paidAt: HOY.toISOString(),
      paymentMethod: "efectivo",
      priceEur: 99,
    });
    const hoy = cita({ paidAt: HOY.toISOString(), paymentMethod: "efectivo", priceEur: 25 });
    expect(cierreDelDia([ayer, hoy], EQUIPO, HOY).total).toBe(25);
  });
});
