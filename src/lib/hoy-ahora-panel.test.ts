import { describe, expect, test } from "bun:test";
import { ahoraDelDia, enCuanto, lineaDelDia } from "./hoy-ahora-panel";
import type { Appointment, Employee } from "./mock/types";

const at = (h: number, m = 0) => new Date(2026, 8, 26, h, m);
const cita = (id: string, e: string, h: number, m: number, dur: number, status = "confirmed") =>
  ({ id, employeeId: e, start: at(h, m).toISOString(), duration: dur, status, clientName: id, serviceIds: [], priceEur: 0 }) as unknown as Appointment;
const sab = (ini: number, fin: number) => [null, null, null, null, null, null, { start: ini, end: fin }];

describe("Hoy › Ahora (lote 16)", () => {
  const hoy = [cita("a", "maria", 10, 0, 60), cita("b", "sara", 10, 30, 45), cita("c", "maria", 11, 30, 30), cita("x", "sara", 9, 0, 30, "cancelled")];
  test("en curso y siguiente", () => {
    const r = ahoraDelDia(hoy, at(10, 40));
    expect(r.enCurso.map((a) => a.id)).toEqual(["a", "b"]);
    expect(r.siguiente?.id).toBe("c");
    expect(r.minutosHastaSiguiente).toBe(50);
  });
  test("línea del día: del primer al último borde, una fila por profesional", () => {
    const equipo = [{ id: "maria", schedule: sab(9, 14) }, { id: "sara", schedule: sab(10, 13) }] as unknown as Employee[];
    const l = lineaDelDia(hoy, equipo, at(10));
    expect([l.ini, l.fin]).toEqual([540, 840]);
    expect(l.filas[0].tramos.map((t) => t.cita.id)).toEqual(["a", "c"]);
    expect(l.filas[1].tramos.map((t) => t.cita.id)).toEqual(["b"]);
  });
  test("en cuánto", () => {
    expect(enCuanto(5)).toBe("en 5 min");
    expect(enCuanto(80)).toBe("en 1 h 20");
    expect(enCuanto(0)).toBe("ahora");
  });
});
