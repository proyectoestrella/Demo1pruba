import { describe, expect, it } from "bun:test";
import {
  agruparPagosPorCita,
  calcularDescuadre,
  cobradoDeCita,
  esperadoDelDia,
  pagosDelDia,
  pagosEntreDias,
  ventanaUtcDelDia,
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

describe("el día de un pago es el de la zona del salón, no el día UTC", () => {
  const madrid = "Europe/Madrid";
  // Noche del cambio de hora de 2026: el domingo 25 de octubre, a las 03:00 (CEST, +2) vuelven a ser las 02:00 (CET, +1).
  const antesDeMedianoche24 = pago({ id: "a", fecha: "2026-10-24T21:30:00.000Z", importeEur: 1 }); // 23:30 del sábado 24
  const primeraHora25 = pago({ id: "b", fecha: "2026-10-24T22:30:00.000Z", importeEur: 2 }); // 00:30 del domingo 25 (+2)
  const horaRepetida25 = pago({ id: "c", fecha: "2026-10-25T01:30:00.000Z", importeEur: 4 }); // 02:30 del 25, ya en +1
  const ultimaHora25 = pago({ id: "d", fecha: "2026-10-25T22:30:00.000Z", importeEur: 8 }); // 23:30 del 25 (+1)
  const primeraHora26 = pago({ id: "e", fecha: "2026-10-25T23:30:00.000Z", importeEur: 16 }); // 00:30 del lunes 26 (+1)
  const todos = [antesDeMedianoche24, primeraHora25, horaRepetida25, ultimaHora25, primeraHora26];

  it("un cobro a las 00:30 de Madrid es del día nuevo", () => {
    expect(pagosDelDia(todos, "2026-10-25", madrid).map((p) => p.id)).toEqual(["b", "c", "d"]);
    expect(pagosDelDia(todos, "2026-10-24", madrid).map((p) => p.id)).toEqual(["a"]);
    expect(pagosDelDia(todos, "2026-10-26", madrid).map((p) => p.id)).toEqual(["e"]);
  });

  it("esperadoDelDia del domingo del cambio de hora (25 h) suma solo lo suyo", () => {
    const r = esperadoDelDia(todos, "2026-10-25", madrid);
    expect(r.fecha).toBe("2026-10-25");
    expect(r.total).toBe(14);
    expect(r.porMetodo.efectivo).toBe(14);
    // Con un instante, el día se toma en la zona: 22:30Z del 24 es el 25 en Madrid.
    expect(esperadoDelDia(todos, new Date("2026-10-24T22:30:00.000Z"), madrid).fecha).toBe("2026-10-25");
  });

  it("pagosEntreDias incluye los dos extremos por día local", () => {
    expect(pagosEntreDias(todos, "2026-10-25", "2026-10-26", madrid).map((p) => p.id)).toEqual(["b", "c", "d", "e"]);
  });

  it("la ventana UTC para pedir a la base de datos cubre el día local de cualquier zona", () => {
    const v = ventanaUtcDelDia("2026-10-25");
    for (const p of [primeraHora25, horaRepetida25, ultimaHora25]) {
      expect(p.fecha >= v.desde && p.fecha < v.hasta).toBe(true);
    }
  });
});

// Barrido de calidad 2026-09-26: un salón recién dado de alta (cero pagos
// todavía) no puede reventar ninguna de estas cuentas.
describe("salón sin ningún pago apuntado", () => {
  it("totales y desglose a cero, sin NaN", () => {
    expect(totalPagos([])).toBe(0);
    expect(pagosPorMetodo([])).toEqual({ efectivo: 0, tarjeta: 0, bizum: 0 });
    expect(agruparPagosPorCita([])).toEqual(new Map());
  });

  it("esperadoDelDia y descuadre sobre cero pagos", () => {
    const r = esperadoDelDia([], "2026-09-27");
    expect(r).toEqual({ fecha: "2026-09-27", porMetodo: { efectivo: 0, tarjeta: 0, bizum: 0 }, total: 0 });
    expect(calcularDescuadre(0, 0).descuadre).toBe(0);
  });

  it("cobradoDeCita sin mapa de pagos usa el fallback tal cual", () => {
    expect(cobradoDeCita("a1", new Map(), 25)).toBe(25);
  });
});

describe("pagos con una cita ya borrada (ids huérfanos)", () => {
  it("agruparPagosPorCita y cobradoDeCita no necesitan que la cita siga viva", () => {
    const pagos = [pago({ appointmentId: "a-borrada", importeEur: 12 })];
    const mapa = agruparPagosPorCita(pagos);
    expect(mapa.get("a-borrada")).toBe(12);
    expect(cobradoDeCita("a-borrada", mapa, 99)).toBe(12);
  });

  it("pagosToCsvGestoria no revienta con un clientId que ya no está en la lista", async () => {
    const { pagosToCsvGestoria } = await import("./export-csv");
    const csv = pagosToCsvGestoria([pago({ clientId: "c-borrada", clientName: undefined })], {});
    expect(csv).not.toContain("undefined");
  });
});
