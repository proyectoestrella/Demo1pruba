import { describe, expect, test } from "bun:test";
import { fechaHoraCitaMovil } from "./copy";

describe("fechaHoraCitaMovil", () => {
  const ahora = new Date(2026, 9, 17, 9);

  test("incluye el día y la hora de una cita de hoy", () => {
    expect(fechaHoraCitaMovil(new Date(2026, 9, 17, 12, 30), ahora)).toBe("sáb 17 oct · 12:30");
  });

  test("mantiene el mes cuando la cita es de otro mes del año actual", () => {
    expect(fechaHoraCitaMovil(new Date(2026, 10, 2, 8, 5), ahora)).toBe("lun 2 nov · 08:05");
  });

  test("añade el año cuando la cita no es del actual", () => {
    expect(fechaHoraCitaMovil(new Date(2027, 0, 3, 16, 45), ahora)).toBe("dom 3 ene 2027 · 16:45");
  });

  test("formatea medianoche en formato de 24 horas", () => {
    expect(fechaHoraCitaMovil(new Date(2026, 9, 18, 0, 0), ahora)).toBe("dom 18 oct · 00:00");
  });
});
