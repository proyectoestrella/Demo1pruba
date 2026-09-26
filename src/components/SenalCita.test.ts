import { describe, expect, test } from "bun:test";
import { citaCerradaParaSenal } from "./SenalCita";

const ahora = new Date("2026-09-26T14:00:00Z");
describe("«Pedir señal» solo en citas abiertas y futuras (lote 16)", () => {
  test("futura y confirmada: se puede pedir", () => {
    expect(citaCerradaParaSenal({ status: "confirmed", start: "2026-10-17T10:20:00Z" }, ahora)).toBe(false);
  });
  test("ya pasada (hoy, antes de ahora): cerrada", () => {
    expect(citaCerradaParaSenal({ status: "confirmed", start: "2026-09-26T09:00:00Z" }, ahora)).toBe(true);
  });
  test("cancelada o completada: cerrada aunque sea futura", () => {
    expect(citaCerradaParaSenal({ status: "cancelled", start: "2026-10-17T10:20:00Z" }, ahora)).toBe(true);
    expect(citaCerradaParaSenal({ status: "completed", start: "2026-10-17T10:20:00Z" }, ahora)).toBe(true);
  });
});
