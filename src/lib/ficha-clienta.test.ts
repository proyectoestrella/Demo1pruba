import { describe, expect, it } from "bun:test";
import { fichaDeClienta } from "./ficha-clienta";
import type { Appointment, Client, Employee, Service } from "./mock/types";

const clienta: Client = { id: "c1", name: "Marta Martín", phone: "600 123 456", createdAt: "2025-01-01" };
const servicio: Service = { id: "color", name: "Color raíz", description: "", durationMin: 60, priceEur: 40 };
const profesional = { id: "mario", name: "Sara" } as Employee;
const cita = (id: string, start: string, patch: Partial<Appointment> = {}): Appointment => ({
  id, clientId: "c1", clientName: clienta.name, employeeId: "mario", serviceIds: ["color"],
  start, duration: 60, priceEur: 40, status: "completed", ...patch,
});
const base = { clientes: [clienta], servicios: [servicio], equipo: [profesional], ahora: new Date("2026-09-24T12:00:00Z") };

describe("fichaDeClienta", () => {
  it("ordena solo visitas completadas y calcula el resumen orientativo", () => {
    const ficha = fichaDeClienta("c1", { ...base, citas: [
      cita("antigua", "2025-10-01T10:00:00Z", { origen: "tpv123", colorFormula: "7.1" }),
      cita("ultima", "2026-08-01T10:00:00Z", { priceEur: 55, technicalNotes: "Matizar", bookingAnswers: { hairLength: "Largo" } }),
      cita("cancelada", "2026-09-01T10:00:00Z", { status: "cancelled" }),
      cita("futura", "2026-10-01T10:00:00Z", { status: "confirmed" }),
    ] });
    expect(ficha.visitas.map((v) => v.id)).toEqual(["ultima", "antigua"]);
    expect(ficha.visitas[1].origen).toBe("tpv123");
    expect(ficha.visitas[0].origen).toBe("sishow");
    expect(ficha.visitas[0].bookingAnswers?.hairLength).toBe("Largo");
    expect(ficha.resumen.numeroVisitas).toBe(2);
    expect(ficha.resumen.frecuenciaMediaDias).toBeGreaterThan(300);
    expect(ficha.resumen.gastoTotal).toBe(95);
    expect(ficha.resumen.gastoUltimos12Meses).toBe(95);
    expect(ficha.resumen.ultimoColor).toEqual({ formula: "7.1", fecha: "2025-10-01T10:00:00Z" });
    expect(ficha.resumen.servicioHabitual).toBe("Color raíz");
    expect(ficha.resumen.profesionalHabitual).toBe("Sara");
    expect(ficha.resumen.proximaCita).toBe("2026-10-01T10:00:00Z");
  });

  it("avisa solo de datos presentes y de un retraso real respecto al hábito de color", () => {
    const citas = [
      cita("previa", "2026-04-03T10:00:00Z", { colorFormula: "6.0" }),
      cita("a", "2026-05-01T10:00:00Z", { colorFormula: "6.0" }),
      cita("b", "2026-05-29T10:00:00Z", { colorFormula: "7.0" }),
      cita("proxima", "2026-10-01T10:00:00Z", { status: "confirmed", depositRequestedAt: "2026-09-20T10:00:00Z", depositDueAt: "2026-09-21T10:00:00Z" }),
    ];
    const ficha = fichaDeClienta("c1", { ...base, citas, clientes: [{ ...clienta, notes: "Cuero sensible", manualBlock: true }] });
    expect(ficha.avisos).toContain("Observaciones: Cuero sensible");
    expect(ficha.avisos).toContain("Reserva por internet bloqueada a mano");
    expect(ficha.avisos).toContain("Señal vencida de la próxima cita");
    expect(ficha.avisos.some((a) => a.includes("8 semanas"))).toBe(true);
    expect(fichaDeClienta("c1", { ...base, citas: [] }).avisos).toEqual([]);
    const pendiente = fichaDeClienta("c1", { ...base, citas: [cita("proxima", "2026-10-01T10:00:00Z", {
      status: "confirmed", depositRequestedAt: "2026-09-24T10:00:00Z", depositDueAt: "2026-09-25T10:00:00Z",
    })] });
    expect(pendiente.avisos).toEqual(["Señal pendiente de la próxima cita"]);
  });

  it("excluye importes anteriores a los últimos doce meses", () => {
    const ficha = fichaDeClienta("c1", { ...base, citas: [
      cita("vieja", "2024-08-01T10:00:00Z", { priceEur: 25 }),
      cita("nueva", "2026-08-01T10:00:00Z", { priceEur: 40 }),
    ] });
    expect(ficha.resumen.gastoTotal).toBe(65);
    expect(ficha.resumen.gastoUltimos12Meses).toBe(40);
  });
});
