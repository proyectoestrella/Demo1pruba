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

describe("salón de un solo profesional", () => {
  const SOLO = [{ id: "mario", name: "Adam" }] as unknown as Employee[];

  it("no desglosa por profesional: sería el total repetido", () => {
    const appts = [
      cita({ priceEur: 25, paidAt: HOY.toISOString(), paymentMethod: "efectivo" }),
      cita({ priceEur: 15, paidAt: HOY.toISOString(), paymentMethod: "bizum" }),
    ];
    const c = cierreDelDia(appts, SOLO, HOY);
    expect(c.porProfesional).toEqual([]);
    // Todo lo demás sigue igual: el total y el reparto por método se calculan.
    expect(c.total).toBe(40);
    expect(c.porMetodo).toEqual({ efectivo: 25, bizum: 15, tarjeta: 0 });
    expect(c.cobradas).toHaveLength(2);
  });
});

// Barrido de calidad 2026-09-26: salón recién dado de alta e ids huérfanos.
describe("cierre de caja: salón vacío e ids huérfanos", () => {
  it("sin equipo ni citas, el cierre sale a cero y sin reventar", () => {
    const c = cierreDelDia([], [], HOY);
    expect(c).toEqual({ cobradas: [], pendientes: [], total: 0, porMetodo: { efectivo: 0, bizum: 0, tarjeta: 0 }, senalesDescontadas: 0, porProfesional: [] });
  });

  it("una cita de un profesional ya borrado del equipo sale con su id, no en blanco", () => {
    const appts = [cita({ employeeId: "borrado", paidAt: HOY.toISOString(), paymentMethod: "tarjeta", priceEur: 30 })];
    const c = cierreDelDia(appts, EQUIPO, HOY);
    expect(c.total).toBe(30);
    expect(c.porProfesional).toEqual([{ employeeId: "borrado", nombre: "borrado", total: 30, citas: 1 }]);
  });

  it("una señal aplicada mayor que el precio no deja el cobro en negativo", () => {
    const appts = [cita({ priceEur: 10, depositAppliedEur: 20, paidAt: HOY.toISOString(), paymentMethod: "bizum" })];
    const c = cierreDelDia(appts, EQUIPO, HOY);
    expect(c.total).toBe(0);
    expect(c.senalesDescontadas).toBe(20);
  });
});
