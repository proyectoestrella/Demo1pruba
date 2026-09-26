import { describe, expect, test } from "bun:test";
import { datosPeluChicArena } from "./asistente/prueba-peluchic-arena";
import { memoPorDatos } from "./memo-datos";
import { revenueByDay, trendsForPeriod } from "./derive";
import { ocupacionPorProfesional } from "./analitica-arena";
import { franjasProfesional } from "./horario-equipo";
import { ocupacionDe } from "./calendario-arena";
import { rangoDePeriodo } from "./periodos";
import { buildCampanasMemo, trendsForPeriodMemo, citasDelDiaMemo } from "./selectores-rutas";
import { buildCampanas } from "./campanas";
import { citasDelDia } from "./hoy-arena";
import type { Appointment } from "./mock/types";

const { estado, equipo } = datosPeluChicArena();
const citas = estado.appointments;
const ahora = new Date();

describe("lote 15 · rendimiento sin cambiar resultados", () => {
  test("revenueByDay en una pasada = la versión de 30 filtros", () => {
    const ref = Array.from({ length: 30 }, (_, k) => {
      const d = new Date(ahora);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (29 - k));
      const del = citas.filter((a) => new Date(a.start).toDateString() === d.toDateString() && a.status !== "cancelled" && a.status !== "no-show");
      return { revenue: del.reduce((s, a) => s + a.priceEur, 0), bookings: del.length };
    });
    expect(revenueByDay(citas).map(({ revenue, bookings }) => ({ revenue, bookings }))).toEqual(ref);
  });
  test("ocupacionPorProfesional agrupada = la versión por día y profesional", () => {
    const r = rangoDePeriodo("mes", ahora);
    const enRango = citas.filter((a) => a.status !== "cancelled" && a.status !== "blocked" && +new Date(a.start) >= +r.inicio && +new Date(a.start) < +r.fin);
    const dias = Math.max(1, Math.round((+r.fin - +r.inicio) / 86_400_000));
    const ref = equipo.map((e) => {
      let jornada = 0, ocupado = 0;
      for (let i = 0; i < dias; i++) {
        const d = new Date(r.inicio);
        d.setDate(r.inicio.getDate() + i);
        const j = franjasProfesional(e, d.getDay()).reduce((t, f) => t + (f.end - f.start), 0);
        if (!j) continue;
        jornada += j;
        ocupado += (ocupacionDe(enRango.filter((a) => new Date(a.start).toDateString() === d.toDateString()), e, d.getDay()) * j) / 100;
      }
      return jornada ? Math.round((ocupado / jornada) * 100) : 0;
    });
    expect(ocupacionPorProfesional(citas, r, equipo).map((x) => x.pct)).toEqual(ref);
  });
  test("trendsForPeriod con prefiltro: la ventana de 9 periodos no pierde nada", () => {
    // Añadir citas fuera de la ventana no cambia el resultado.
    const lejos = { ...citas[0], id: "lejos", start: new Date(ahora.getTime() - 400 * 86_400_000).toISOString() } as Appointment;
    expect(trendsForPeriod([...citas, lejos], "mes", ahora)).toEqual(trendsForPeriod(citas, "mes", ahora));
    expect(trendsForPeriod(citas, "mes", ahora).citas.current).toBeGreaterThan(0);
  });
  test("memo: mismos datos → misma referencia; datos nuevos → recalcula", () => {
    let n = 0;
    const f = memoPorDatos((a: unknown[], d: Date) => (n++, { a, d }));
    const arr = new Array(100).fill(0);
    const r1 = f(arr, new Date(2026, 8, 26, 10, 0, 5));
    expect(f(arr, new Date(2026, 8, 26, 10, 0, 50))).toBe(r1);
    expect(n).toBe(1);
    f([...arr], new Date(2026, 8, 26, 10, 0, 5));
    f(arr, new Date(2026, 8, 26, 10, 1, 0));
    expect(n).toBe(3);
  });
  test("memo: array corto mutado en sitio (equipo) recalcula", () => {
    let n = 0;
    const f = memoPorDatos((e: { h: number }[]) => (n++, e[0].h));
    const eq = [{ h: 1 }];
    f(eq);
    eq[0].h = 2;
    expect(f(eq)).toBe(2);
    expect(n).toBe(2);
  });
  test("selectores memoizados devuelven lo mismo que las funciones", () => {
    expect(trendsForPeriodMemo(citas, "mes", ahora)).toEqual(trendsForPeriod(citas, "mes", ahora));
    expect(trendsForPeriodMemo(citas, "mes", ahora)).toBe(trendsForPeriodMemo(citas, "mes", ahora));
    const i = { appointments: citas, clients: estado.clients, services: estado.services, employees: equipo, salonName: "PeluChic", salonAddress: "", now: ahora };
    expect(buildCampanasMemo(i)).toEqual(buildCampanas(i));
    expect(citasDelDiaMemo(citas, ahora)).toEqual(citasDelDia(citas, ahora));
  });
});
