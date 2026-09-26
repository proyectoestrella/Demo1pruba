import { describe, expect, it } from "bun:test";
import { huecosDeProfesionales, trabajaEn } from "./horario-equipo";
import type { Employee } from "./mock/types";
import { antelacionMinima, huecoAunReservable, primerHuecoReservable } from "./primer-hueco";

const TZ = "Europe/Madrid";
const h = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Salón de lunes a viernes 9-20, sábado 9-14, domingo cerrado; una profesional. */
function empleada(rangos: Record<number, Array<{ start: number; end: number }>>): Employee {
  return { id: "e1", name: "Ana", schedule: {}, scheduleRanges: rangos } as unknown as Employee;
}
const LV = { start: 540, end: 1200 };
const ANA = empleada({ 1: [LV], 2: [LV], 3: [LV], 4: [LV], 5: [LV], 6: [{ start: 540, end: 840 }] });

function huecos(emp: Employee, dur = 30) {
  return (_f: string, wd: number) =>
    huecosDeProfesionales([emp], wd, dur).filter((m) => trabajaEn(emp, wd, m, dur)).map(h);
}

describe("primer hueco reservable (lote 16, bug «hoy a las 12:30» un sábado a las 19:05)", () => {
  it("sábado 19:05 con cierre a las 14:00: salta el domingo y propone el lunes a las 09:00", () => {
    // 2026-09-26 es sábado; 19:05 en Madrid (CEST) = 17:05 UTC.
    const r = primerHuecoReservable({ hoy: "2026-09-26", ahora: new Date("2026-09-26T17:05:00Z"), timeZone: TZ, huecosDelDia: huecos(ANA) });
    expect(r).toEqual({ fecha: "2026-09-28", hora: "09:00" });
  });

  it("jueves 13:59 con hueco a las 14:00: con 0 min de margen lo ofrece; con 30, pasa a las 14:30", () => {
    const base = { hoy: "2026-09-24", ahora: new Date("2026-09-24T11:59:00Z"), timeZone: TZ, huecosDelDia: huecos(ANA) };
    expect(primerHuecoReservable({ ...base, antelacionMin: 0 })).toEqual({ fecha: "2026-09-24", hora: "14:00" });
    expect(primerHuecoReservable(base)).toEqual({ fecha: "2026-09-24", hora: "14:30" });
  });

  it("cierre a las 20:00 y son las 19:50: hoy ya no hay nada, pasa a mañana", () => {
    const r = primerHuecoReservable({ hoy: "2026-09-23", ahora: new Date("2026-09-23T17:50:00Z"), timeZone: TZ, huecosDelDia: huecos(ANA) });
    expect(r).toEqual({ fecha: "2026-09-24", hora: "09:00" });
  });

  it("nunca propone un día cerrado (domingo) ni el día libre de la profesional", () => {
    const sinMiercoles = empleada({ 1: [LV], 2: [LV], 4: [LV] });
    // Domingo 27 por la mañana: domingo cerrado, lunes 28 sí.
    const r1 = primerHuecoReservable({ hoy: "2026-09-27", ahora: new Date("2026-09-27T06:00:00Z"), timeZone: TZ, huecosDelDia: huecos(ANA) });
    expect(r1).toEqual({ fecha: "2026-09-28", hora: "09:00" });
    // Martes 29 a las 21:00: el miércoles no trabaja, el jueves sí.
    const r2 = primerHuecoReservable({ hoy: "2026-09-29", ahora: new Date("2026-09-29T19:00:00Z"), timeZone: TZ, huecosDelDia: huecos(sinMiercoles) });
    expect(r2).toEqual({ fecha: "2026-10-01", hora: "09:00" });
    // Sin ningún día abierto: null, no un hueco inventado.
    expect(primerHuecoReservable({ hoy: "2026-09-29", ahora: new Date(), timeZone: TZ, dias: 14, huecosDelDia: () => [] })).toBeNull();
  });

  it("cambio de hora (domingo 25-oct-2026, CEST→CET): compara instantes, no minutos", () => {
    // Lunes 26-oct 08:40 en Madrid ya es CET (UTC+1) = 07:40 UTC. Margen 30 → 09:10 → 09:30.
    const r = primerHuecoReservable({ hoy: "2026-10-26", ahora: new Date("2026-10-26T07:40:00Z"), timeZone: TZ, huecosDelDia: huecos(ANA) });
    expect(r).toEqual({ fecha: "2026-10-26", hora: "09:30" });
    // Sábado 24-oct (aún CEST, UTC+2) 13:10 local = 11:10 UTC: 13:30 queda a 20 min → ya no; salta al lunes.
    const r2 = primerHuecoReservable({ hoy: "2026-10-24", ahora: new Date("2026-10-24T11:10:00Z"), timeZone: TZ, huecosDelDia: huecos(ANA) });
    expect(r2).toEqual({ fecha: "2026-10-26", hora: "09:00" });
  });

  it("antelación: por defecto 30, acotada y tolerante a basura", () => {
    expect(antelacionMinima(undefined)).toBe(30);
    expect(antelacionMinima(Number.NaN)).toBe(30);
    expect(antelacionMinima(-5)).toBe(0);
    expect(antelacionMinima(120)).toBe(120);
    expect(huecoAunReservable("2026-09-26", "12:30", TZ, new Date("2026-09-26T17:05:00Z"))).toBe(false);
  });
});
