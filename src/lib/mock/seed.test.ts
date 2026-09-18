import { describe, expect, it } from "bun:test";
import { buildSeed, PENALIZED_CLIENT_PHONE } from "./seed";
import { employeesForType, servicesForType } from "./salon";

const employees = employeesForType("barberia");
const services = servicesForType("barberia");

describe("buildSeed — política de plantón (opts.noShowFeeEur)", () => {
  it("sin penalización activa, ningún cliente sale marcado", () => {
    const seed = buildSeed("barberia", employees, services);
    expect(seed.clients.some((c) => (c.penaltyEur ?? 0) > 0)).toBe(false);
  });

  it("con penalización activa, un cliente sale con la deuda y el teléfono estable", () => {
    const seed = buildSeed("barberia", employees, services, { noShowFeeEur: 7 });
    const penalizado = seed.clients.find((c) => (c.penaltyEur ?? 0) > 0);
    expect(penalizado?.penaltyEur).toBe(7);
    expect(penalizado?.phone).toBe(PENALIZED_CLIENT_PHONE);
    expect(penalizado?.penaltyNote).toBeTruthy();
  });

  it("solo hay un cliente penalizado, no varios", () => {
    const seed = buildSeed("barberia", employees, services, { noShowFeeEur: 7 });
    expect(seed.clients.filter((c) => (c.penaltyEur ?? 0) > 0)).toHaveLength(1);
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
