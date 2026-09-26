import { describe, expect, test } from "bun:test";
import { diasAnteriores, movimientosDelDia, pendientesDeCobrar, porHora, resumen, sumarDias, textoResumen, variacion } from "./caja-resumen-panel";
import type { Appointment } from "./mock/types";
import type { Pago } from "./pagos";

const Z = "Europe/Madrid";
const cita = (id: string, start: string, extra: Partial<Appointment> = {}): Appointment =>
  ({ id, clientId: "c" + id, clientName: "Clienta " + id, serviceIds: ["corte"], employeeId: "maria", start, duration: 45, priceEur: 25, status: "completed", ...extra }) as Appointment;
const pago = (id: string, fecha: string, importeEur: number, extra: Partial<Pago> = {}): Pago =>
  ({ id, importeEur, metodo: "tarjeta", concepto: "servicio", origen: "sishow", fecha, createdAt: fecha, ...extra }) as Pago;

describe("caja del día (lote 16)", () => {
  test("junta pagos y citas cobradas sin contar dos veces la misma cita", () => {
    const citas = [
      cita("1", "2026-09-26T08:00:00Z", { paidAt: "2026-09-26T08:50:00Z", paymentMethod: "efectivo" }),
      cita("2", "2026-09-26T09:00:00Z", { paidAt: "2026-09-26T09:50:00Z", paymentMethod: "tarjeta" }),
    ];
    const pagos = [pago("p", "2026-09-26T09:50:00Z", 30, { appointmentId: "2" })];
    const m = movimientosDelDia(pagos, citas, "2026-09-26", Z);
    expect(m.map((x) => x.fuente)).toEqual(["cita", "pago"]);
    expect(resumen(m)).toEqual({ total: 55, cobros: 2, porMetodo: { efectivo: 25, tarjeta: 30, bizum: 0 } });
  });
  test("el día es el de Madrid, no el UTC", () => {
    const pagos = [pago("p", "2026-09-26T22:30:00Z", 10)]; // 00:30 del 27 en Madrid
    expect(movimientosDelDia(pagos, [], "2026-09-27", Z)).toHaveLength(1);
    expect(movimientosDelDia(pagos, [], "2026-09-26", Z)).toHaveLength(0);
  });
  test("por hora: cubre la jornada y suma cada hora", () => {
    const m = movimientosDelDia([pago("a", "2026-09-26T08:10:00Z", 10), pago("b", "2026-09-26T08:40:00Z", 5)], [], "2026-09-26", Z);
    const h = porHora(m);
    expect(h[0].hora).toBe(9);
    expect(h.find((x) => x.hora === 10)?.total).toBe(15);
  });
  test("comparación y días anteriores", () => {
    expect(variacion(120, 100)).toBe(20);
    expect(variacion(10, 0)).toBeNull();
    expect(sumarDias("2026-10-01", -1)).toBe("2026-09-30");
    const d = diasAnteriores([pago("a", "2026-09-24T10:00:00Z", 10)], [], "2026-09-26", Z, 5);
    expect(d).toEqual([{ dia: "2026-09-24", resumen: { total: 10, cobros: 1, porMetodo: { efectivo: 0, tarjeta: 10, bizum: 0 } } }]);
  });
  test("pendientes: de hoy, ya empezadas, cobrables y sin cobrar", () => {
    const citas = [
      cita("a", "2026-09-26T08:00:00Z", { status: "confirmed" }),
      cita("b", "2026-09-26T15:00:00Z", { status: "confirmed" }), // aún no
      cita("c", "2026-09-26T08:00:00Z", { status: "cancelled" }),
      cita("d", "2026-09-26T08:00:00Z", { paidAt: "2026-09-26T09:00:00Z" }),
    ];
    expect(pendientesDeCobrar(citas, "2026-09-26", Z, new Date("2026-09-26T12:00:00Z")).map((a) => a.id)).toEqual(["a"]);
  });
  test("texto para copiar", () => {
    const t = textoResumen({ salon: "PeluChic", etiquetaDia: "sábado, 26 de septiembre", r: { total: 55, cobros: 2, porMetodo: { efectivo: 25, tarjeta: 30, bizum: 0 } }, porProfesional: [{ nombre: "María", total: 55 }], pendientes: 1 });
    expect(t).toContain("*Caja de PeluChic* · sábado, 26 de septiembre");
    expect(t).toContain("· Tarjeta: 30,00 €");
    expect(t).toContain("Sin cobrar todavía: 1 cita");
  });
});
