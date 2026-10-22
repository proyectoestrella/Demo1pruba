import { describe, expect, test } from "bun:test";
import { esperandoDesde, filtrarEspera, proximoHuecoPara } from "./lista-espera-panel";
import type { Appointment, Employee, WaitlistEntry } from "./mock/types";

const semana = (ini: number, fin: number) => [null, { start: ini, end: fin }, { start: ini, end: fin }, { start: ini, end: fin }, { start: ini, end: fin }, { start: ini, end: fin }, null];
const maria = { id: "maria", name: "María", schedule: semana(10, 14) } as unknown as Employee;
const sara = { id: "sara", name: "Sara", schedule: semana(10, 14) } as unknown as Employee;
const cita = (employeeId: string, start: Date, duration: number) => ({ id: "x" + +start, employeeId, start: start.toISOString(), duration, status: "confirmed", serviceIds: [], priceEur: 0 }) as unknown as Appointment;

describe("lista de espera (lote 16)", () => {
  test("propone el primer hueco donde cabe, con la profesional que prefiere", () => {
    const lunes9 = new Date(2026, 8, 28, 9, 0); // lunes 28-sep 9:00
    const citas = [cita("maria", new Date(2026, 8, 28, 10, 0), 120)];
    const h = proximoHuecoPara({ preferredEmployeeId: "maria" }, citas, [maria, sara], 60, lunes9);
    expect(h?.employeeId).toBe("maria");
    expect(h?.fecha.getHours()).toBe(12);
    const cualquiera = proximoHuecoPara({ preferredEmployeeId: "any" }, citas, [maria, sara], 60, lunes9);
    expect(cualquiera?.employeeId).toBe("sara");
    expect(cualquiera?.fecha.getHours()).toBe(10);
  });
  test("salta los días cerrados", () => {
    const sabado = new Date(2026, 8, 26, 9, 0);
    const h = proximoHuecoPara({ preferredEmployeeId: "any" }, [], [maria], 45, sabado);
    expect(h?.fecha.getDate()).toBe(28);
  });
  test("cuánto lleva esperando", () => {
    const ahora = new Date(2026, 8, 26, 12);
    expect(esperandoDesde(new Date(2026, 8, 26, 9).toISOString(), ahora)).toBe("hoy");
    expect(esperandoDesde(new Date(2026, 8, 25, 9).toISOString(), ahora)).toBe("ayer");
    expect(esperandoDesde(new Date(2026, 8, 20, 9).toISOString(), ahora)).toBe("hace 6 días");
    expect(esperandoDesde(new Date(2026, 8, 1, 9).toISOString(), ahora)).toBe("hace 3 semanas");
  });
  test("filtros por servicio y profesional", () => {
    const l = [
      { id: "1", serviceId: "tinte", preferredEmployeeId: "maria" },
      { id: "2", serviceId: "corte", preferredEmployeeId: "any" },
      { id: "3", serviceId: "tinte", preferredEmployeeId: "sara" },
    ] as WaitlistEntry[];
    expect(filtrarEspera(l, { servicio: "tinte", profesional: "todas" }).map((w) => w.id)).toEqual(["1", "3"]);
    expect(filtrarEspera(l, { servicio: "todos", profesional: "maria" }).map((w) => w.id)).toEqual(["1", "2"]);
  });
});

import { priorizarEsperaParaHueco } from "./lista-espera-panel";

describe("lista priorizada para un hueco liberado", () => {
  // Lunes 28-sep-2026 10:00 en Madrid (verano, UTC+2) = 08:00Z.
  const hueco = "2026-09-28T08:00:00.000Z";
  const espera = (id: string, createdAt: string, serviceId: string, preferredEmployeeId: string) =>
    ({ id, clientName: id, phone: "600", serviceId, preferredEmployeeId, preferredRange: "", createdAt }) as WaitlistEntry;
  const base = { startISO: hueco, equipo: [maria, sara], duracionDe: (s: string) => (s === "color" ? 90 : 45), timeZone: "Europe/Madrid" };
  const ocupaMaria = { ...cita("maria", new Date(hueco), 60), start: hueco };

  test("las que caben van antes, y entre ellas la que más lleva esperando", () => {
    const r = priorizarEsperaParaHueco({
      ...base,
      citas: [ocupaMaria],
      espera: [
        espera("reciente", "2026-09-27T10:00:00Z", "corte", "any"),
        espera("antigua", "2026-09-20T10:00:00Z", "corte", "any"),
        espera("quiere-maria", "2026-09-10T10:00:00Z", "corte", "maria"),
      ],
    });
    expect(r.map((x) => x.entry.id)).toEqual(["antigua", "reciente", "quiere-maria"]);
    expect(r.map((x) => x.cabe)).toEqual([true, true, false]);
    expect(r[0].profesionalId).toBe("sara");
  });
  test("si el servicio no cabe en lo que dura el hueco libre, no cabe", () => {
    const r = priorizarEsperaParaHueco({
      ...base,
      citas: [{ ...cita("maria", new Date(hueco), 60), start: "2026-09-28T09:00:00.000Z" }, { ...cita("sara", new Date(hueco), 60), start: "2026-09-28T09:00:00.000Z" }],
      espera: [espera("color", "2026-09-01T10:00:00Z", "color", "any"), espera("corte", "2026-09-02T10:00:00Z", "corte", "any")],
    });
    expect(r.map((x) => [x.entry.id, x.cabe])).toEqual([["corte", true], ["color", false]]);
  });
});
