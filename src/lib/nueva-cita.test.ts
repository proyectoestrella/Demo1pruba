import { describe, expect, test } from "bun:test";
import type { Appointment, Client, Employee } from "./mock/types";
import {
  citasQueOcupan,
  clientasFrecuentes,
  diasParaElegir,
  duracionLegible,
  horaOcupada,
  horasDeProfesional,
  primeraLibre,
} from "./nueva-cita";
import { solapaConAgenda } from "./solape-maqueta";

const h = (hh: number, mm = 0) => hh * 60 + mm;
function pro(id: string, r: Array<{ start: number; end: number }>): Employee {
  return { id, name: id, specialty: "", yearsExperience: 1, photo: "", colorVar: "--stylist-mario", schedule: [null, null, null, null, null, null, null], scheduleRanges: [[], r, r, r, r, r, []] };
}
function cita(p: Partial<Appointment> & { start: string; duration: number }): Appointment {
  return { id: p.id ?? `${p.employeeId}-${p.start}`, clientId: p.clientId ?? "c", clientName: "Clienta", serviceIds: ["corte"], employeeId: p.employeeId ?? "m", priceEur: 25, status: p.status ?? "confirmed", ...p };
}
const maria = pro("m", [{ start: h(10), end: h(14) }, { start: h(15), end: h(20) }]);
const sara = pro("s", [{ start: h(10), end: h(20) }]);
const viernes = new Date("2026-09-25T12:40:00");

describe("horas y ocupación", () => {
  test("horas de paso dentro de las franjas, sin la comida", () => {
    const horas = horasDeProfesional(maria, 5);
    expect(horas[0]).toBe(h(10));
    expect(horas).not.toContain(h(14));
    expect(horas).toContain(h(15));
    expect(horas[horas.length - 1]).toBe(h(19, 30));
  });
  test("una hora está ocupada si la cita pedida pisa otra de esa profesional", () => {
    const hoy = [cita({ start: "2026-09-25T12:00:00", duration: 90 })];
    expect(horaOcupada(hoy, "m", h(11, 30), 45)).toBe(true); // 11:30-12:15
    expect(horaOcupada(hoy, "m", h(13, 30), 45)).toBe(false);
    expect(horaOcupada(hoy, "s", h(12), 45)).toBe(false);
  });
  test("canceladas y plantones no ocupan", () => {
    const lista = [
      cita({ start: "2026-09-25T12:00:00", duration: 60, status: "cancelled" }),
      cita({ start: "2026-09-25T13:00:00", duration: 60, status: "no-show" }),
      cita({ start: "2026-09-25T15:00:00", duration: 60 }),
    ];
    expect(citasQueOcupan(lista, viernes)).toHaveLength(1);
  });
  test("cualquiera libre: la primera que trabaja y no tiene nada encima", () => {
    const hoy = [cita({ start: "2026-09-25T15:00:00", duration: 60 })];
    expect(primeraLibre([maria, sara], hoy, 5, h(15), 45)?.id).toBe("s");
    expect(primeraLibre([maria, sara], hoy, 5, h(11), 45)?.id).toBe("m");
    expect(primeraLibre([maria], hoy, 5, h(14), 30)).toBeNull(); // comida
  });
});

describe("días y clientas", () => {
  test("la tira empieza hoy si la fecha cae en esta semana", () => {
    const dias = diasParaElegir(viernes, new Date("2026-09-27T10:00:00"));
    expect(dias[0].getDate()).toBe(25);
    expect(dias).toHaveLength(7);
  });
  test("si la fecha está más lejos, la tira empieza en ella", () => {
    const dias = diasParaElegir(viernes, new Date("2026-10-20T10:00:00"));
    expect(dias[0].getDate()).toBe(20);
  });
  test("clientas frecuentes por visitas recientes", () => {
    const clients = ["a", "b"].map((id) => ({ id, name: id, phone: "", createdAt: "2026-01-01" }) as Client);
    const citas = [
      cita({ clientId: "a", start: "2026-09-01T10:00:00", duration: 30, status: "completed" }),
      cita({ clientId: "b", start: "2026-08-01T10:00:00", duration: 30, status: "completed" }),
      cita({ clientId: "b", start: "2026-09-10T10:00:00", duration: 30, status: "completed" }),
      cita({ clientId: "a", start: "2026-10-10T10:00:00", duration: 30, status: "completed" }), // futura
    ];
    const r = clientasFrecuentes(citas, clients, viernes);
    expect(r.map((x) => [x.client.id, x.visitas])).toEqual([["b", 2], ["a", 1]]);
  });
  test("duración legible", () => {
    expect(duracionLegible(45)).toBe("45 min");
    expect(duracionLegible(85)).toBe("1 h 25");
    expect(duracionLegible(120)).toBe("2 h");
  });
});

describe("solapaConAgenda (maqueta del contrato)", () => {
  const agenda = [
    cita({ id: "x", start: "2026-09-25T12:00:00", duration: 60 }),
    cita({ id: "y", start: "2026-09-25T14:00:00", duration: 60, status: "blocked" }),
    cita({ id: "z", start: "2026-09-25T16:00:00", duration: 60, status: "cancelled" }),
  ];
  test("devuelve las citas de esa profesional que chocan; los bloqueos cuentan", () => {
    expect(solapaConAgenda(agenda, { employeeId: "m", start: "2026-09-25T12:30:00", duration: 30 }).map((a) => a.id)).toEqual(["x"]);
    expect(solapaConAgenda(agenda, { employeeId: "m", start: "2026-09-25T13:30:00", duration: 60 }).map((a) => a.id)).toEqual(["y"]);
  });
  test("canceladas no cuentan, otra profesional tampoco, y se excluye la propia", () => {
    expect(solapaConAgenda(agenda, { employeeId: "m", start: "2026-09-25T16:00:00", duration: 30 })).toEqual([]);
    expect(solapaConAgenda(agenda, { employeeId: "s", start: "2026-09-25T12:00:00", duration: 30 })).toEqual([]);
    expect(solapaConAgenda(agenda, { employeeId: "m", start: "2026-09-25T12:00:00", duration: 30, excluirId: "x" })).toEqual([]);
  });
});
