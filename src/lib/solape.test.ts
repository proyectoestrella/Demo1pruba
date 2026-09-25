import { describe, expect, it } from "bun:test";
import { solapaConAgenda } from "./solape";
import type { Appointment } from "./mock/types";

const cita = (id: string, start: string, duration: number, extra: Partial<Appointment> = {}): Appointment => ({
  id, clientId: "c", clientName: "Ana", serviceIds: ["corte"], employeeId: "mario", start, duration, priceEur: 10, status: "confirmed", ...extra,
});

describe("solapaConAgenda", () => {
  const agenda = [
    cita("a", "2026-09-28T08:00:00.000Z", 60),
    cita("b", "2026-09-28T09:00:00.000Z", 30, { employeeId: "diego" }),
    cita("c", "2026-09-28T10:00:00.000Z", 30, { status: "cancelled" }),
    cita("d", "2026-09-28T11:00:00.000Z", 30, { status: "no-show" }),
    cita("e", "2026-09-28T12:00:00.000Z", 30, { status: "blocked" }),
  ];

  it("devuelve las citas de la misma profesional que chocan", () => {
    expect(solapaConAgenda(agenda, { employeeId: "mario", start: "2026-09-28T08:30:00.000Z", duration: 30 }).map((a) => a.id)).toEqual(["a"]);
  });

  it("horas contiguas, otra profesional, canceladas y plantones no chocan; un bloqueo sí", () => {
    expect(solapaConAgenda(agenda, { employeeId: "mario", start: "2026-09-28T09:00:00.000Z", duration: 30 })).toEqual([]);
    expect(solapaConAgenda(agenda, { employeeId: "mario", start: "2026-09-28T10:00:00.000Z", duration: 30 })).toEqual([]);
    expect(solapaConAgenda(agenda, { employeeId: "mario", start: "2026-09-28T11:00:00.000Z", duration: 30 })).toEqual([]);
    expect(solapaConAgenda(agenda, { employeeId: "mario", start: "2026-09-28T12:15:00.000Z", duration: 30 }).map((a) => a.id)).toEqual(["e"]);
  });

  it("al mover una cita no se solapa consigo misma", () => {
    expect(solapaConAgenda(agenda, { employeeId: "mario", start: "2026-09-28T08:15:00.000Z", duration: 30, excluirId: "a" })).toEqual([]);
  });
});
