import { describe, expect, test } from "bun:test";
import type { Appointment, Employee, Service } from "./mock/types";
import { barrasDelPeriodo, nuevasYRecurrentes, ocupacionPorProfesional, serviciosDelRango } from "./analitica-arena";

const h = (x: number) => x * 60;
const semana = [[], [{ start: h(10), end: h(20) }], [{ start: h(10), end: h(20) }], [{ start: h(10), end: h(20) }], [{ start: h(10), end: h(20) }], [{ start: h(10), end: h(20) }], []];
const maria: Employee = { id: "m", name: "María", specialty: "", yearsExperience: 1, photo: "", colorVar: "--stylist-mario", schedule: [null, null, null, null, null, null, null], scheduleRanges: semana };
function cita(p: Partial<Appointment> & { start: string }): Appointment {
  return { id: p.id ?? p.start + (p.clientId ?? ""), clientId: p.clientId ?? "c", clientName: "C", serviceIds: p.serviceIds ?? ["corte"], employeeId: "m", duration: p.duration ?? 60, priceEur: p.priceEur ?? 25, status: p.status ?? "confirmed", ...p };
}
const viernes = { inicio: new Date("2026-09-25T00:00:00"), fin: new Date("2026-09-26T00:00:00") };
const semanaR = { inicio: new Date("2026-09-21T00:00:00"), fin: new Date("2026-09-28T00:00:00") };
const ahora = new Date("2026-09-25T12:40:00");

describe("barras", () => {
  test("un día va por horas, de apertura a cierre, con la hora actual destacada", () => {
    const citas = [cita({ start: "2026-09-25T10:00:00" }), cita({ start: "2026-09-25T10:30:00" }), cita({ start: "2026-09-25T12:00:00" }), cita({ start: "2026-09-25T13:00:00", status: "cancelled" })];
    const b = barrasDelPeriodo(citas, "hoy", viernes, [maria], ahora);
    expect(b).toHaveLength(10);
    expect(b[0]).toMatchObject({ etiqueta: "10", valor: 2 });
    expect(b[2]).toMatchObject({ etiqueta: "12", valor: 1, destacada: true });
    expect(b[3].valor).toBe(0);
  });
  test("una semana va por días, con hoy destacado", () => {
    const citas = [cita({ start: "2026-09-25T10:00:00" }), cita({ start: "2026-09-22T10:00:00" })];
    const b = barrasDelPeriodo(citas, "semana", semanaR, [maria], ahora);
    expect(b.map((x) => x.etiqueta)).toEqual(["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]);
    expect(b[4]).toMatchObject({ valor: 1, destacada: true });
    expect(b[1].valor).toBe(1);
  });
});

describe("ocupación, servicios y clientas", () => {
  test("ocupación ponderada por la jornada de cada día", () => {
    const citas = [cita({ start: "2026-09-25T10:00:00", duration: 300 })]; // 5 h de 10
    expect(ocupacionPorProfesional(citas, viernes, [maria])[0]).toMatchObject({ pct: 50, citas: 1 });
  });
  test("servicios por veces, repartiendo el importe según la carta", () => {
    const carta = [{ id: "corte", name: "Corte", description: "", durationMin: 45, priceEur: 25 }, { id: "tinte", name: "Tinte", description: "", durationMin: 40, priceEur: 75 }] as Service[];
    const citas = [cita({ start: "2026-09-25T10:00:00", serviceIds: ["corte", "tinte"], priceEur: 100 }), cita({ start: "2026-09-25T12:00:00", serviceIds: ["corte"], priceEur: 25 })];
    const r = serviciosDelRango(citas, viernes, carta);
    expect(r.map((x) => [x.sv.id, x.veces, x.euros])).toEqual([["corte", 2, 50], ["tinte", 1, 75]]);
  });
  test("nuevas son las que vienen por primera vez en el rango", () => {
    const citas = [cita({ clientId: "a", start: "2026-09-25T10:00:00" }), cita({ clientId: "b", start: "2026-09-25T11:00:00" }), cita({ clientId: "b", start: "2026-08-01T11:00:00" })];
    expect(nuevasYRecurrentes(citas, viernes)).toEqual({ nuevas: 1, recurrentes: 1 });
  });
});
