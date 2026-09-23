import { describe, expect, it } from "bun:test";
import {
  buildSeed,
  PENALIZED_CLIENT_PHONE,
  LATE_PENALIZED_CLIENT_PHONE,
  DURACION_FLEXIBLE_CLIENT_PHONE,
} from "./seed";
import { employeesForType, servicesForType } from "./salon";
import { duracionRecordada } from "../derive";

const employees = employeesForType("barberia");
const services = servicesForType("barberia");

describe("buildSeed — política de plantón (opts.noShowFeeEur)", () => {
  it("sin penalización activa, ningún cliente sale marcado", () => {
    const seed = buildSeed("barberia", employees, services);
    expect(seed.clients.some((c) => (c.penaltyEur ?? 0) > 0)).toBe(false);
  });

  it("con importe explícito 0 no siembra deuda, bloqueo ni motivo de recargo", () => {
    const seed = buildSeed("peluqueria", employeesForType("peluqueria"), servicesForType("peluqueria"), { noShowFeeEur: 0 });
    expect(seed.clients.every((c) => !c.penaltyEur && !c.penaltyBlock && !c.penaltyReason && !c.penaltyAppointmentId)).toBe(true);
  });

  it("con penalización activa, un cliente sale con la deuda y el teléfono estable", () => {
    const seed = buildSeed("barberia", employees, services, { noShowFeeEur: 7 });
    const penalizado = seed.clients.find((c) => (c.penaltyEur ?? 0) > 0);
    expect(penalizado?.penaltyEur).toBe(7);
    expect(penalizado?.phone).toBe(PENALIZED_CLIENT_PHONE);
    expect(penalizado?.penaltyNote).toBeTruthy();
  });

  it("hay exactamente dos clientes penalizados: uno por no presentarse y otro por llegar tarde", () => {
    const seed = buildSeed("barberia", employees, services, { noShowFeeEur: 7 });
    const penalizados = seed.clients.filter((c) => (c.penaltyEur ?? 0) > 0);
    expect(penalizados).toHaveLength(2);
    expect(penalizados.map((c) => c.penaltyReason).sort()).toEqual(["late", "no_show"]);
  });

  it("el cliente penalizado por llegar tarde lleva teléfono estable, minutos y cita enlazada", () => {
    const seed = buildSeed("barberia", employees, services, { noShowFeeEur: 7 });
    const tarde = seed.clients.find((c) => c.penaltyReason === "late");
    expect(tarde?.phone).toBe(LATE_PENALIZED_CLIENT_PHONE);
    expect(tarde?.penaltyLateMinutes).toBeGreaterThan(0);
    expect(tarde?.penaltyAppointmentId).toBeTruthy();
    const cita = seed.appointments.find((a) => a.id === tarde?.penaltyAppointmentId);
    expect(cita?.lateMinutes).toBe(tarde?.penaltyLateMinutes);
  });
});

describe("buildSeed — reparto de agenda (opts.smartSpread)", () => {
  it("sin reparto activo, puede haber citas en la franja floja 10-11 hoy", () => {
    // No es una aserción determinista de "hay citas a esa hora" (depende del
    // azar), sino de que el sesgo NO se aplica: se comprueba junto al test de
    // abajo, que sí demuestra el sesgo cuando está activo.
    const seed = buildSeed("barberia", employees, services);
    expect(seed.appointments.length).toBeGreaterThan(0);
  });

  it("con reparto activo, hoy no hay ninguna cita que empiece a las 10 o las 11", () => {
    const seed = buildSeed("barberia", employees, services, { smartSpread: true });
    const hoyKey = new Date().toISOString().slice(0, 10);
    const citasDeHoyEnHoraFloja = seed.appointments.filter((a) => {
      if (a.status === "cancelled" || a.status === "no-show") return false;
      const d = new Date(a.start);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (key !== hoyKey) return false;
      const h = d.getHours();
      return h === 10 || h === 11;
    });
    expect(citasDeHoyEnHoraFloja).toHaveLength(0);
  });
});

describe("buildSeed — duración flexible (opts.duracionFlexible)", () => {
  it("sin el flag activo, la semilla queda exactamente igual que antes", () => {
    const conFlag = buildSeed("barberia", employees, services, { duracionFlexible: false });
    const sinFlag = buildSeed("barberia", employees, services);
    expect(conFlag.clients.length).toBe(sinFlag.clients.length);
    expect(conFlag.appointments.length).toBe(sinFlag.appointments.length);
    expect(conFlag.clients.map((c) => c.id)).toEqual(sinFlag.clients.map((c) => c.id));
    expect(conFlag.appointments.map((a) => a.id)).toEqual(sinFlag.appointments.map((a) => a.id));
    expect(
      conFlag.clients.some((c) => c.phone === DURACION_FLEXIBLE_CLIENT_PHONE),
    ).toBe(false);
  });

  it("con el flag activo, hay una cita pasada y una solicitud pendiente de la misma clienta y servicio, y duracionRecordada() avisa de la duración real", () => {
    const seed = buildSeed("barberia", employees, services, { duracionFlexible: true });
    const clienta = seed.clients.find((c) => c.phone === DURACION_FLEXIBLE_CLIENT_PHONE);
    expect(clienta).toBeTruthy();

    const propias = seed.appointments.filter((a) => a.clientId === clienta?.id);
    const pasada = propias.find((a) => a.status === "completed");
    const pendiente = propias.find((a) => a.status === "pending");
    expect(pasada).toBeTruthy();
    expect(pendiente).toBeTruthy();
    expect(pasada?.serviceIds).toEqual(pendiente?.serviceIds);
    expect(pasada?.duration).not.toBe(pendiente?.duration);

    const servicioLargo = [...services].sort((a, b) => b.durationMin - a.durationMin)[0];
    expect(pendiente?.duration).toBe(servicioLargo.durationMin);
    // Entre un 40% y un 60% más que la de catálogo, como pide la demo.
    const ratio = (pasada?.duration ?? 0) / servicioLargo.durationMin;
    expect(ratio).toBeGreaterThanOrEqual(1.4);
    expect(ratio).toBeLessThanOrEqual(1.6);

    const aviso = duracionRecordada(
      seed.appointments,
      clienta?.id,
      pendiente!.serviceIds,
      servicioLargo.durationMin,
    );
    expect(aviso?.minutos).toBe(pasada?.duration);
  });
});
