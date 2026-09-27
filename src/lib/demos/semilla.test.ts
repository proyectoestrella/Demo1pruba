import { afterAll, beforeAll, describe, expect, it, setSystemTime } from "bun:test";

import { cierreDelDia } from "../caja";
import { dineroDelRango } from "../dinero";
import { employeesForType, servicesForType, textosDeCarta } from "../mock/salon";
import { buildSeed } from "../mock/seed";
import type { Appointment } from "../mock/types";
import { MEZCLA_PELUCHIC, PELUCHIC } from "./peluchic";

/**
 * La semilla de la demo de PeluChic (lote P.3), mirada con el reloj de la
 * presentación: lunes 28 de septiembre de 2026 a las 9:30, día que el salón
 * cierra.
 */
const LUNES_PRESENTACION = new Date("2026-09-28T09:30:00+02:00");

/** `abreHoy`: lo que hace la demo de verdad (`SalonProfile.demoAbreHoy`): si hoy cierra, abre igual. */
function semilla(abreHoy?: string) {
  const equipo = employeesForType("peluqueria", PELUCHIC.team, PELUCHIC.teamHours, PELUCHIC.openingHours, PELUCHIC.teamIds, abreHoy);
  const carta = servicesForType("peluqueria", PELUCHIC.menu, textosDeCarta(PELUCHIC));
  const seed = buildSeed("peluqueria", equipo, carta, { duracionFlexible: true, mezcla: MEZCLA_PELUCHIC });
  return { equipo, carta, seed };
}

const diaDe = (a: Pick<Appointment, "start">) => {
  const d = new Date(a.start);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const minutosDelDia = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

describe("semilla de PeluChic con su carta real", () => {
  beforeAll(() => setSystemTime(LUNES_PRESENTACION));
  afterAll(() => setSystemTime());

  it("es determinista", () => {
    expect(JSON.stringify(semilla().seed)).toBe(JSON.stringify(semilla().seed));
  });

  it("cada cita cuesta y dura lo que dice la carta", () => {
    const { carta, seed } = semilla();
    const porId = new Map(carta.map((s) => [s.id, s]));
    for (const a of seed.appointments) {
      const servicios = a.serviceIds.map((id) => porId.get(id));
      expect(servicios.every(Boolean)).toBe(true);
      const precio = servicios.reduce((t, s) => t + (s?.priceEur ?? 0), 0);
      expect(a.priceEur).toBeCloseTo(precio, 6);
      // La de la duración flexible dura, a propósito, más que la carta.
      if (a.id !== "a-duracion-flexible-pasada") {
        expect(a.duration).toBe(servicios.reduce((t, s) => t + (s?.durationMin ?? 0), 0));
      }
    }
  });

  it("usa los 60 servicios de la carta en los tres últimos meses y las tres próximas semanas", () => {
    const { carta, seed } = semilla();
    const desde = +LUNES_PRESENTACION - 90 * 86_400_000;
    const usados = new Set(seed.appointments.filter((a) => +new Date(a.start) >= desde).flatMap((a) => a.serviceIds));
    expect(carta.filter((s) => !usados.has(s.id)).map((s) => s.name)).toEqual([]);
  });

  it("ninguna profesional tiene dos citas a la vez ni trabaja fuera de su turno", () => {
    const { equipo, seed } = semilla();
    for (const e of equipo) {
      const suyas = seed.appointments
        .filter((a) => a.employeeId === e.id && a.status !== "cancelled")
        .sort((x, y) => +new Date(x.start) - +new Date(y.start));
      for (let i = 1; i < suyas.length; i++) {
        expect(+new Date(suyas[i].start)).toBeGreaterThanOrEqual(+new Date(suyas[i - 1].start) + suyas[i - 1].duration * 60_000);
      }
      for (const a of suyas) {
        const franjas = e.scheduleRanges?.[new Date(a.start).getDay()] ?? [];
        const ini = minutosDelDia(a.start);
        expect(franjas.some((f) => f.start <= ini && ini + a.duration <= f.end)).toBe(true);
      }
    }
  });

  it("en la demo, el lunes de la presentación abre con los turnos del martes y la agenda llena", () => {
    const { equipo, seed } = semilla("2026-09-28");
    const hoy = diaDe({ start: LUNES_PRESENTACION.toISOString() });
    const deHoy = seed.appointments.filter((a) => diaDe(a) === hoy);
    expect(deHoy.length).toBeGreaterThanOrEqual(12);
    expect(new Set(deHoy.map((a) => a.employeeId)).size).toBe(3);
    // Dos solicitudes por confirmar, hoy mismo, y la de la duración flexible.
    expect(deHoy.filter((a) => a.status === "pending").length).toBeGreaterThanOrEqual(2);
    for (const a of deHoy) {
      const e = equipo.find((x) => x.id === a.employeeId);
      const ini = minutosDelDia(a.start);
      expect((e?.scheduleRanges?.[1] ?? []).some((f) => f.start <= ini && ini + a.duration <= f.end)).toBe(true);
    }
  });

  it("sin la marca de demo (un salón real), el lunes sigue cerrado y las solicitudes esperan al martes", () => {
    const { seed } = semilla();
    const hoy = diaDe({ start: LUNES_PRESENTACION.toISOString() });
    expect(seed.appointments.filter((a) => diaDe(a) === hoy)).toHaveLength(0);
    const pendientes = seed.appointments.filter((a) => a.status === "pending");
    expect(pendientes.length).toBeGreaterThanOrEqual(2);
    for (const p of pendientes) expect(new Date(p.start).getDay()).toBe(2);
    // El martes, agenda llena de verdad.
    const martes = seed.appointments.filter((a) => new Date(a.start).getDay() === 2 && +new Date(a.start) - +LUNES_PRESENTACION < 2 * 86_400_000 && +new Date(a.start) > +LUNES_PRESENTACION);
    expect(martes.length).toBeGreaterThanOrEqual(12);
  });

  it("las novias son de María y casi siempre en sábado", () => {
    const { seed } = semilla();
    const novias = seed.appointments.filter((a) => a.serviceIds.includes("novias"));
    expect(novias.length).toBeGreaterThanOrEqual(4);
    expect(novias.every((a) => a.employeeId === "mario")).toBe(true);
    const enSabado = novias.filter((a) => new Date(a.start).getDay() === 6).length;
    expect(enSabado / novias.length).toBeGreaterThanOrEqual(0.5);
  });

  it("los complementos nunca van solos", () => {
    const { seed } = semilla();
    for (const a of seed.appointments) {
      if (a.serviceIds.includes("cortar-anadido") || a.serviceIds.includes("matiz")) {
        expect(a.serviceIds.length).toBeGreaterThan(1);
      }
    }
  });

  it("Caja y el dinero de Hoy/Analítica suman exactamente los precios de la carta", () => {
    const { equipo, seed } = semilla();
    // La última semana abierta: del martes 22 al sábado 26.
    for (let d = 22; d <= 26; d++) {
      const dia = new Date(2026, 8, d, 12, 0, 0);
      const citas = seed.appointments.filter((a) => diaDe(a) === diaDe({ start: dia.toISOString() }));
      const vinieron = citas.filter((a) => a.status === "completed");
      const esperado = vinieron.reduce((t, a) => t + a.priceEur, 0);
      expect(vinieron.length).toBeGreaterThan(0);
      expect(vinieron.every((a) => a.paidAt && a.paymentMethod)).toBe(true);
      const caja = cierreDelDia(seed.appointments, equipo, dia);
      expect(caja.total).toBeCloseTo(esperado, 6);
      const inicio = new Date(2026, 8, d);
      const dinero = dineroDelRango(seed.appointments, { inicio, fin: new Date(2026, 8, d + 1) }, LUNES_PRESENTACION);
      expect(dinero.cobrado).toBeCloseTo(esperado, 6);
    }
  });
});

describe("semilla de PeluChic: nombres variados en el día", () => {
  beforeAll(() => setSystemTime(LUNES_PRESENTACION));
  afterAll(() => setSystemTime());
  it("ningún nombre de pila se repite más de dos veces en un mismo día cercano", () => {
    const { seed } = semilla("2026-09-28");
    const porDia = new Map<string, Map<string, number>>();
    for (const a of seed.appointments) {
      const ms = +new Date(a.start) - +LUNES_PRESENTACION;
      if (Math.abs(ms) > 14 * 86_400_000) continue;
      const dia = diaDe(a);
      const m = porDia.get(dia) ?? new Map<string, number>();
      const n = a.clientName.split(" ")[0];
      m.set(n, (m.get(n) ?? 0) + 1);
      porDia.set(dia, m);
    }
    for (const m of porDia.values()) expect(Math.max(...m.values())).toBeLessThanOrEqual(2);
  });
});

describe("semilla de PeluChic: cada una hace lo suyo", () => {
  beforeAll(() => setSystemTime(LUNES_PRESENTACION));
  afterAll(() => setSystemTime());
  it("lo que más hace cada profesional cuadra con su especialidad, histórico incluido", () => {
    const { seed } = semilla("2026-09-28");
    const top = (id: string) => {
      const m = new Map<string, number>();
      for (const a of seed.appointments) if (a.employeeId === id) m.set(a.serviceIds[0], (m.get(a.serviceIds[0]) ?? 0) + 1);
      return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([s]) => s);
    };
    const colores = ["color-10-minutos", "color-organico", "bano-brillo", "barros", "mechas", "money-piece"];
    // Sara (diego): la colorista.
    expect(top("diego").every((s) => colores.includes(s))).toBe(true);
    // Noelia (ruben): tratamientos y cabina, ningún color entre lo que más hace.
    expect(top("ruben").some((s) => colores.includes(s))).toBe(false);
  });
});
