import { describe, expect, test } from "bun:test";
import { importeACobrar, leerEuros, planDeCobro, senalYaPagada } from "./cobro-panel";

describe("ventana Cobrar (14b)", () => {
  test("se propone el precio menos la señal ya pagada", () => {
    expect(importeACobrar({ priceEur: 35 })).toBe(35);
    expect(importeACobrar({ priceEur: 35, depositReceivedEur: 10 })).toBe(25);
    expect(importeACobrar({ priceEur: 35, depositAppliedEur: 10, depositReceivedEur: 10 })).toBe(25);
    expect(importeACobrar({ priceEur: 35, depositReceivedEur: 10, depositRefundedEur: 10 })).toBe(35);
    expect(importeACobrar({ priceEur: 8, depositReceivedEur: 10 })).toBe(0);
    expect(senalYaPagada({ depositAppliedEur: 12 })).toBe(12);
  });
  test("euros con coma o punto", () => {
    expect(leerEuros("25,50")).toBe(25.5);
    expect(leerEuros("25.5 €")).toBe(25.5);
    expect(leerEuros("")).toBeNaN();
  });
  test("un solo pago", () => {
    expect(planDeCobro([{ importe: "25", metodo: "tarjeta" }], "")).toMatchObject({ total: 25, metodoPrincipal: "tarjeta", error: null });
  });
  test("pago mixto: en la cita queda el método de la parte mayor", () => {
    const p = planDeCobro([{ importe: "10", metodo: "efectivo" }, { importe: "15", metodo: "bizum" }], "2");
    expect(p).toMatchObject({ total: 27, propina: 2, metodoPrincipal: "bizum", error: null });
    expect(p.lineas).toHaveLength(2);
  });
  test("errores en palabras", () => {
    expect(planDeCobro([{ importe: "", metodo: "efectivo" }], "").error).toContain("Escribe");
    expect(planDeCobro([{ importe: "0", metodo: "efectivo" }], "").error).toBe("No hay nada que cobrar.");
    expect(planDeCobro([{ importe: "5", metodo: "efectivo" }, { importe: "5", metodo: "efectivo" }], "").error).toContain("iguales");
    expect(planDeCobro([{ importe: "5", metodo: "efectivo" }], "mucho").error).toContain("propina");
  });
});
