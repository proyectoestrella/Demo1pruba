import { describe, expect, test } from "bun:test";
import type { Appointment, Client, Employee } from "./mock/types";
import {
  citasQueOcupan,
  otrasCitasDelDia,
  clientasFrecuentes,
  decisionGuardadoCita,
  diasParaElegir,
  duracionLegible,
  horaOcupada,
  horasDeProfesional,
  primeraLibre,
} from "./nueva-cita";

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

describe("guardado con aviso", () => {
  test("pide confirmación consciente cuando la hora está ocupada", () => {
    expect(decisionGuardadoCita({ ocupada: true, trabaja: true, profesional: "María" })).toEqual({
      aviso: "María ya tiene una cita a esa hora. Puedes guardarla igualmente.",
      etiqueta: "Guardar igualmente",
    });
  });

  test("pide confirmación consciente cuando la profesional no trabaja", () => {
    expect(decisionGuardadoCita({ ocupada: false, trabaja: false, profesional: "María" })).toEqual({
      aviso: "María no trabaja a esa hora. Puedes guardarla igualmente.",
      etiqueta: "Guardar igualmente",
    });
  });

  test("mantiene el texto normal si no hay aviso", () => {
    expect(decisionGuardadoCita({ ocupada: false, trabaja: true, profesional: "María" })).toEqual({
      aviso: null,
      etiqueta: "Guardar cita",
    });
  });
});

// solapaConAgenda ya no es una maqueta: es `src/lib/solape.ts` (BACKEND),
// con su propia cobertura en `src/lib/solape.test.ts`.

describe("otrasCitasDelDia", () => {
  const cita = (id: string, start: string, status = "confirmed") => ({ id, clientId: "c1", start, status }) as never;
  test("encuentra las del mismo día de la clienta, sin canceladas", () => {
    const appts = [cita("a", "2026-10-27T08:00:00Z"), cita("b", "2026-10-27T15:00:00Z", "cancelled"), cita("c", "2026-10-28T08:00:00Z")];
    expect(otrasCitasDelDia(appts, "c1", "2026-10-27", "Europe/Madrid").map((a: { id: string }) => a.id)).toEqual(["a"]);
    expect(otrasCitasDelDia(appts, "c1", "2026-10-27", "Europe/Madrid", "a")).toEqual([]);
  });
});
