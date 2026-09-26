import { describe, expect, test } from "bun:test";
import { buildSeed } from "@/lib/mock/seed";
import { employeesForType, servicesForType, salon } from "@/lib/mock/salon";
import { motivoCitaCerrada, prepararPeticionSenal, pedirSenal, darMasTiempo, puedePedirSenal, reglaSenal } from "@/lib/senal";
import type { Appointment } from "@/lib/mock/types";

const AHORA = new Date("2026-09-26T10:00:00Z");
const MIN = 60_000;
const regla = reglaSenal({ ...salon, depositEnabled: true } as never);
const cita = (desdeAhoraMin: number, extra: Partial<Appointment> = {}) =>
  ({ start: new Date(AHORA.getTime() + desdeAhoraMin * MIN).toISOString(), status: "confirmed", duration: 60, priceEur: 40, ...extra }) as Appointment;

describe("lote 15 · pedir señal según la cita", () => {
  test("cita dentro de 10 min: se puede, y el plazo se topa en la hora de la cita", () => {
    const r = prepararPeticionSenal(cita(10), regla, 10, AHORA);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Date.parse(r.venceISO)).toBe(AHORA.getTime() + 10 * MIN);
  });
  test("cita pendiente de mañana: se puede", () => {
    expect(prepararPeticionSenal(cita(24 * 60, { status: "pending" }), regla, 10, AHORA).ok).toBe(true);
  });
  test("cita en curso: no se puede y lo dice («ya ha empezado», no «ya ha pasado»)", () => {
    const r = prepararPeticionSenal(cita(-15), regla, 10, AHORA);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("en_curso");
      expect(r.mensaje).toContain("ya ha empezado");
    }
  });
  test("cita de hoy ya terminada, cancelada, atendida, no vino, duración 0", () => {
    expect(motivoCitaCerrada(cita(-90), AHORA)).toBe("pasada");
    expect(motivoCitaCerrada(cita(60, { status: "cancelled" }), AHORA)).toBe("cancelada");
    expect(motivoCitaCerrada(cita(-120, { status: "completed" }), AHORA)).toBe("atendida");
    expect(motivoCitaCerrada(cita(-120, { status: "no-show" }), AHORA)).toBe("no_vino");
    expect(motivoCitaCerrada(cita(0, { duration: 0 }), AHORA)).toBe("pasada");
    expect(motivoCitaCerrada(cita(1, { duration: 0 }), AHORA)).toBeNull();
    expect(motivoCitaCerrada(cita(0, { start: "no es fecha" }), AHORA)).toBe("sin_fecha");
  });
  test("la hora es un instante: un start con desfase +02:00 equivale al mismo UTC", () => {
    const c = cita(0, { start: "2026-09-26T12:30:00+02:00" }); // 10:30Z
    expect(puedePedirSenal(c, AHORA)).toBe(true);
  });
  test("pedirSenal y darMasTiempo usan la misma regla", () => {
    expect(pedirSenal(cita(-15), regla, 10, AHORA)).toEqual({ ok: false, error: "SENAL_CITA_CERRADA" });
    expect(darMasTiempo(cita(-15, { depositStatus: "pedida", depositRequestedAt: AHORA.toISOString() }), regla, AHORA).ok).toBe(false);
  });
  test("demo PeluChic: toda cita futura pendiente/confirmada se puede pedir; las demás dicen su motivo", () => {
    const ahora = new Date();
    const { appointments } = buildSeed("peluqueria", employeesForType("peluqueria" as never) as never, servicesForType("peluqueria"), { smartSpread: true });
    const futuras = appointments.filter((a) => Date.parse(a.start) > ahora.getTime() && (a.status === "pending" || a.status === "confirmed"));
    expect(futuras.length).toBeGreaterThan(50);
    for (const a of futuras) expect(prepararPeticionSenal(a, regla, 10, ahora).ok).toBe(true);
    for (const a of appointments.filter((x) => Date.parse(x.start) <= ahora.getTime())) expect(puedePedirSenal(a, ahora)).toBe(false);
  });
});
