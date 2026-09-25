import { describe, expect, test } from "bun:test";
import type { Appointment, Employee } from "./mock/types";
import { agendaDeHoy, dineroDelRango, tiempoDe } from "./dinero";

const h = (x: number) => x * 60;
const semana = [[], [{ start: h(10), end: h(20) }], [{ start: h(10), end: h(20) }], [{ start: h(10), end: h(20) }], [{ start: h(10), end: h(20) }], [{ start: h(10), end: h(20) }], []];
const pro = (id: string, name: string): Employee => ({ id, name, specialty: "", yearsExperience: 1, photo: "", colorVar: "--stylist-mario", schedule: [null, null, null, null, null, null, null], scheduleRanges: semana });
const cita = (p: Partial<Appointment> & { start: string }): Appointment => ({ id: p.start + (p.employeeId ?? "m") + (p.status ?? ""), clientId: "c", clientName: "C", serviceIds: ["corte"], employeeId: "m", duration: 60, priceEur: 20, status: "confirmed", ...p });
const ahora = new Date("2026-09-25T12:30:00");
const hoy = { inicio: new Date("2026-09-25T00:00:00"), fin: new Date("2026-09-26T00:00:00") };

describe("cobrado y previsto", () => {
  const citas = [
    cita({ start: "2026-09-25T10:00:00", status: "completed", paidAt: "2026-09-25T11:00:00", priceEur: 30 }),
    cita({ start: "2026-09-25T11:00:00", status: "completed", priceEur: 25 }), // vino, sin cobro marcado
    cita({ start: "2026-09-25T11:30:00", status: "no-show", priceEur: 40 }),
    cita({ start: "2026-09-25T15:00:00", status: "confirmed", priceEur: 50 }),
    cita({ start: "2026-09-25T17:00:00", status: "pending", priceEur: 60 }), // no confirmada: no es previsto
    cita({ start: "2026-09-25T18:00:00", status: "cancelled", priceEur: 70 }),
  ];
  test("hoy: cobrado lo marcado, previsto lo confirmado que no ha empezado", () => {
    expect(dineroDelRango(citas, hoy, ahora)).toEqual({ tiempo: "en-curso", cobrado: 30, cobradas: 1, previsto: 50, previstas: 1, porCobrar: 25 + 50 + 60, realizadas: 3, noVino: 1, sinCobroMarcado: 1 });
  });
  test("un periodo pasado no tiene previsto; uno futuro no tiene cobrado", () => {
    const despues = new Date("2026-09-27T09:00:00");
    expect(dineroDelRango(citas, hoy, despues)).toMatchObject({ tiempo: "pasado", previsto: 0, cobrado: 30 });
    const antes = new Date("2026-09-24T09:00:00");
    expect(dineroDelRango(citas, hoy, antes)).toMatchObject({ tiempo: "futuro", cobrado: 30, previsto: 50 + 0 });
    expect(tiempoDe(hoy, antes)).toBe("futuro");
  });
});

describe("agenda de hoy", () => {
  test("citas por profesional, ocupación ponderada y huecos con su hora", () => {
    const equipo = [pro("m", "María"), pro("s", "Sara")];
    const citas = [
      cita({ start: "2026-09-25T13:00:00", employeeId: "m", duration: 420 }), // María llena de 13 a 20
      cita({ start: "2026-09-25T13:30:00", employeeId: "s", duration: 150 }), // Sara de 13:30 a 16:00
      cita({ start: "2026-09-25T18:45:00", employeeId: "s", duration: 60, status: "cancelled" }),
    ];
    const r = agendaDeHoy(citas, equipo, ahora);
    expect(r.total).toBe(2);
    expect(r.porPro.map((x) => [x.e.name, x.citas])).toEqual([["María", 1], ["Sara", 1]]);
    expect(r.ocupacionPct).toBe(48); // (420 + 150) min reservados de 1200 de jornada = 47,5 %
    expect(r.detalleHuecos).toBe("María 12:30 · Sara 12:30 y 16:00");
    expect(r.minutosLibres).toBe(30 + 60 + 240);
  });
});

describe("cobros sembrados en la demo", () => {
  test("solo las completadas que ya terminaron, con la hora de fin y un método", async () => {
    const { sembrarCobros } = await import("./mock/seed");
    const ahoraMs = +new Date("2026-09-25T12:30:00");
    const r = sembrarCobros(
      [
        cita({ start: "2026-09-25T10:00:00", status: "completed" }),
        cita({ start: "2026-09-25T12:00:00", status: "completed" }), // termina a las 13:00: aún no
        cita({ start: "2026-09-25T09:00:00", status: "no-show" }),
      ],
      ahoraMs,
    );
    expect(r[0].paidAt).toBe(new Date("2026-09-25T11:00:00").toISOString());
    expect(r[0].paymentMethod).toBe("tarjeta");
    expect(r[1].paidAt).toBeUndefined();
    expect(r[2].paidAt).toBeUndefined();
  });
});

test("los huecos empiezan en el siguiente múltiplo de 5 minutos", () => {
  const r = agendaDeHoy([], [pro("s", "Sara")], new Date("2026-09-25T18:43:00"));
  expect(r.detalleHuecos).toBe("Sara 18:45");
  expect(r.minutosLibres).toBe(75);
});
