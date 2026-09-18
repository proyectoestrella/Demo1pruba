import { describe, expect, it } from "bun:test";
import { normalizePhone, findClientWithPenalty, isWithinNoticeWindow } from "./no-show";
import type { Client } from "./mock/types";

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: "c1",
    name: "Cliente de prueba",
    phone: "+34 600 000 007",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("normalizePhone", () => {
  it("se queda con los últimos 9 dígitos, sin espacios ni símbolos", () => {
    expect(normalizePhone("+34 600 000 007")).toBe("600000007");
    expect(normalizePhone("600000007")).toBe("600000007");
    expect(normalizePhone("34600000007")).toBe("600000007");
    expect(normalizePhone("600-000-007")).toBe("600000007");
  });

  it("vacío o undefined da cadena vacía", () => {
    expect(normalizePhone(undefined)).toBe("");
    expect(normalizePhone("")).toBe("");
  });
});

describe("findClientWithPenalty", () => {
  const clients = [
    client({ id: "c1", phone: "+34 600 000 007", penaltyEur: 7 }),
    client({ id: "c2", phone: "+34 611 222 333" }), // sin penalización
  ];

  it("encuentra al cliente penalizado por su teléfono, con o sin prefijo", () => {
    expect(findClientWithPenalty(clients, "+34 600 000 007")?.id).toBe("c1");
    expect(findClientWithPenalty(clients, "600000007")?.id).toBe("c1");
    expect(findClientWithPenalty(clients, "600 000 007")?.id).toBe("c1");
  });

  it("un cliente sin penalización no bloquea aunque coincida el teléfono", () => {
    expect(findClientWithPenalty(clients, "611222333")).toBeUndefined();
  });

  it("un teléfono que no coincide con nadie no bloquea", () => {
    expect(findClientWithPenalty(clients, "699999999")).toBeUndefined();
  });

  it("no bloquea mientras el teléfono no tiene 9 dígitos (se está tecleando)", () => {
    expect(findClientWithPenalty(clients, "600000")).toBeUndefined();
  });
});

describe("isWithinNoticeWindow", () => {
  it("una cita dentro de las próximas N horas cuenta como plantón al cancelar", () => {
    const now = new Date("2026-09-18T10:00:00");
    const start = new Date("2026-09-18T11:00:00").toISOString(); // en 1h
    expect(isWithinNoticeWindow(start, 2, now)).toBe(true);
  });

  it("una cita fuera del margen no cuenta como plantón", () => {
    const now = new Date("2026-09-18T10:00:00");
    const start = new Date("2026-09-19T10:00:00").toISOString(); // mañana
    expect(isWithinNoticeWindow(start, 2, now)).toBe(false);
  });

  it("una cita que ya empezó también cuenta (margen negativo)", () => {
    const now = new Date("2026-09-18T10:00:00");
    const start = new Date("2026-09-18T09:00:00").toISOString();
    expect(isWithinNoticeWindow(start, 2, now)).toBe(true);
  });
});
