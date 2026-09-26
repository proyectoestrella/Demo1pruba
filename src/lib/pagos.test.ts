import { describe, expect, it } from "bun:test";
import {
  agruparPagosPorCita,
  calcularDescuadre,
  cobradoDeCita,
  esperadoDelDia,
  pagoDeSenalAplicada,
  pagosPorMetodo,
  refSenalAplicada,
  totalPagos,
  TEXTO_CAJA_NO_FACTURA,
  type Pago,
} from "./pagos";

function pago(extra: Partial<Pago> = {}): Pago {
  return {
    id: "p-1", importeEur: 20, metodo: "efectivo", concepto: "servicio", origen: "sishow",
    fecha: "2026-09-28T10:00:00.000Z", createdAt: "2026-09-28T10:00:00.000Z", ...extra,
  };
}

describe("totales y por método", () => {
  it("suma y desglosa por método, con las tres siempre presentes", () => {
    const pagos = [pago({ metodo: "efectivo", importeEur: 20 }), pago({ id: "p-2", metodo: "tarjeta", importeEur: 15.5 }), pago({ id: "p-3", metodo: "efectivo", importeEur: 4.5 })];
    expect(totalPagos(pagos)).toBe(40);
    expect(pagosPorMetodo(pagos)).toEqual({ efectivo: 24.5, tarjeta: 15.5, bizum: 0 });
  });

  it("redondea al céntimo", () => {
    expect(totalPagos([pago({ importeEur: 0.1 }), pago({ id: "p-2", importeEur: 0.2 })])).toBe(0.3);
  });
});

describe("cobrado real de una cita, con fallback", () => {
  it("suma los pagos de esa cita si los hay", () => {
    const pagos = [pago({ appointmentId: "a-1", importeEur: 20 }), pago({ id: "p-2", appointmentId: "a-1", importeEur: 5 }), pago({ id: "p-3", appointmentId: "a-2", importeEur: 100 })];
    const mapa = agruparPagosPorCita(pagos);
    expect(mapa.get("a-1")).toBe(25);
    expect(cobradoDeCita("a-1", mapa, 999)).toBe(25);
  });

  it("sin pagos de esa cita, usa el fallback (comportamiento actual)", () => {
    const mapa = agruparPagosPorCita([pago({ appointmentId: "a-9" })]);
    expect(cobradoDeCita("a-1", mapa, 30)).toBe(30);
  });
});

describe("pago de la señal aplicada", () => {
  it("null si no hay nada aplicado", () => {
    expect(pagoDeSenalAplicada({ id: "a-1", clientId: "c-1", clientName: "Ana", depositAppliedEur: 0 })).toBeNull();
    expect(pagoDeSenalAplicada({ id: "a-1", clientId: "c-1", clientName: "Ana" })).toBeNull();
  });

  it("concepto senal, mismo importe, refExterna estable (idempotente al reaplicar)", () => {
    const ahora = new Date("2026-09-29T18:00:00.000Z");
    const p = pagoDeSenalAplicada({ id: "a-1", clientId: "c-1", clientName: "Ana", depositAppliedEur: 20, depositMethod: "bizum" }, ahora);
    expect(p).toMatchObject({ appointmentId: "a-1", clientId: "c-1", clientName: "Ana", importeEur: 20, metodo: "bizum", concepto: "senal", origen: "sishow", refExterna: "senal:a-1", fecha: ahora.toISOString() });
    expect(refSenalAplicada("a-1")).toBe("senal:a-1");
  });

  it("una transferencia recibida se apunta como efectivo (no hay ese método en caja)", () => {
    const p = pagoDeSenalAplicada({ id: "a-1", clientId: "c-1", clientName: "Ana", depositAppliedEur: 10, depositMethod: "transferencia" });
    expect(p?.metodo).toBe("bizum");
  });
});

describe("esperado del día y descuadre", () => {
  it("solo cuenta los pagos de ese día", () => {
    const pagos = [
      pago({ fecha: "2026-09-28T09:00:00.000Z", metodo: "efectivo", importeEur: 20 }),
      pago({ id: "p-2", fecha: "2026-09-28T19:00:00.000Z", metodo: "tarjeta", importeEur: 30 }),
      pago({ id: "p-3", fecha: "2026-09-27T09:00:00.000Z", metodo: "efectivo", importeEur: 999 }),
    ];
    const r = esperadoDelDia(pagos, new Date("2026-09-28T20:00:00.000Z"));
    expect(r).toEqual({ fecha: "2026-09-28", porMetodo: { efectivo: 20, tarjeta: 30, bizum: 0 }, total: 50 });
  });

  it("descuadre: positivo sobra, negativo falta", () => {
    expect(calcularDescuadre(100, 95)).toEqual({ efectivoContado: 100, efectivoEsperado: 95, descuadre: 5 });
    expect(calcularDescuadre(80, 95)).toEqual({ efectivoContado: 80, efectivoEsperado: 95, descuadre: -15 });
    expect(calcularDescuadre(95, 95).descuadre).toBe(0);
  });
});

it("el texto obligatorio dice que no hay tickets ni facturas y menciona Verifactu", () => {
  expect(TEXTO_CAJA_NO_FACTURA).toContain("no emite tickets ni facturas");
  expect(TEXTO_CAJA_NO_FACTURA).toContain("Verifactu");
});
