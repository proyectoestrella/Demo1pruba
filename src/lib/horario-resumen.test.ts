import { describe, expect, test } from "bun:test";
import { resumenHorario } from "./horario-resumen";

describe("resumen del horario", () => {
  test("agrupa días seguidos con las mismas horas", () => {
    expect(resumenHorario(["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "09:00–14:00", "Cerrado"])).toBe("Mar–Vie 10:00–20:00 · Sáb 9:00–14:00");
  });
  test("dos días seguidos van con «y», y los sueltos por separado", () => {
    expect(resumenHorario(["10:00–14:00", "10:00–14:00", "Cerrado", "16:00–20:30", "Cerrado", "Cerrado", "Cerrado"])).toBe("Lun y Mar 10:00–14:00 · Jue 16:00–20:30");
  });
  test("sin ningún día, lo dice", () => {
    expect(resumenHorario(Array(7).fill("Cerrado"))).toBe("No trabaja ningún día");
  });
});
