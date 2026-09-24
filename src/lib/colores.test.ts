import { describe, expect, it } from "bun:test";
import { historialColores, ultimoColor } from "./colores";
import type { Appointment } from "./mock/types";

const cita = (id: string, start: string, colorFormula?: string, status: Appointment["status"] = "completed"): Appointment => ({
  id, start, colorFormula, status, clientId: "c1", clientName: "Ana", serviceIds: ["color"],
  employeeId: "emp1" as Appointment["employeeId"], duration: 60, priceEur: 30,
});

describe("historial de color", () => {
  it("ordena de más reciente a más antiguo y excluye canceladas y visitas futuras", () => {
    const citas = [cita("vieja", "2026-09-01T09:00:00Z", "6.0"), cita("futura", "2026-09-25T09:00:00Z", "8.0"), cita("nueva", "2026-09-20T09:00:00Z", "7.1"), cita("cancelada", "2026-09-22T09:00:00Z", "9.0", "cancelled")];
    expect(historialColores(citas, "c1", "2026-09-24T00:00:00Z").map((a) => a.id)).toEqual(["nueva", "vieja"]);
    expect(ultimoColor(citas, "c1", "2026-09-24T00:00:00Z")?.colorFormula).toBe("7.1");
  });
});
