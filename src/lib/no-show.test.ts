import { describe, expect, it } from "bun:test";
import { normalizePhone, findClientWithPenalty, findClientByPhone, isBookingBlocked, isManualBlockRecord, manualBlockNote, previousPenaltyState, MANUAL_BLOCK_NOTE, isWithinNoticeWindow } from "./no-show";
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

describe("findClientByPhone", () => {
  const clients = [
    client({ id: "c1", name: "Marta", phone: "+34 600 000 007" }),
    client({ id: "c2", name: "Elena", phone: "611 222 333" }),
  ];

  it("reconoce a la clienta que repite aunque teclee el teléfono distinto", () => {
    expect(findClientByPhone(clients, "+34 600 000 007")?.id).toBe("c1");
    expect(findClientByPhone(clients, "600000007")?.id).toBe("c1");
    expect(findClientByPhone(clients, "600-000-007")?.id).toBe("c1");
    expect(findClientByPhone(clients, "0034 600 00 00 07")?.id).toBe("c1");
  });

  it("un teléfono que no coincide con nadie no devuelve ficha (se crea una nueva)", () => {
    expect(findClientByPhone(clients, "699999999")).toBeUndefined();
  });

  it("no reconoce a nadie mientras el teléfono no tiene 9 dígitos", () => {
    expect(findClientByPhone(clients, "600000")).toBeUndefined();
  });

  it("sin teléfono tecleado no hay coincidencia", () => {
    expect(findClientByPhone(clients, undefined)).toBeUndefined();
    expect(findClientByPhone(clients, "")).toBeUndefined();
  });
});

describe("isBookingBlocked", () => {
  it("con recargo a 0 ignora deuda y bloqueo de penalización antiguos", () => {
    expect(isBookingBlocked(client({ penaltyEur: 7, penaltyBlock: true }), { noShowFeeEur: 0 })).toBe(false);
  });

  it("el bloqueo manual funciona sin recargo y se levanta a mano", () => {
    const blocked = client({ manualBlock: true });
    expect(isBookingBlocked(blocked, { noShowFeeEur: 0 })).toBe(true);
    expect(isBookingBlocked({ ...blocked, manualBlock: false }, { noShowFeeEur: 0 })).toBe(false);
  });

  it("con recargo activo conserva el bloqueo por deuda", () => {
    expect(isBookingBlocked(client({ penaltyEur: 7 }), { noShowFeeEur: 7 })).toBe(true);
    expect(isBookingBlocked(client({ penaltyEur: 7, penaltyBlock: false }), { noShowFeeEur: 7 })).toBe(false);
  });
});

describe("isManualBlockRecord", () => {
  it("reconoce el bloqueo explícito y conserva una deuda antigua", () => {
    expect(isManualBlockRecord({ penalty_eur: 0, penalty_note: MANUAL_BLOCK_NOTE })).toBe(true);
    const note = manualBlockNote(client({ penaltyEur: 7, penaltyNote: "No vino", penaltyBlock: false }));
    expect(isManualBlockRecord({ penalty_eur: 7, penalty_note: note })).toBe(true);
    expect(previousPenaltyState(note)).toEqual({ note: "No vino", keep: undefined, block: false });
    expect(isManualBlockRecord({ penalty_eur: null, penalty_note: MANUAL_BLOCK_NOTE })).toBe(false);
    expect(isManualBlockRecord({ penalty_eur: 0, penalty_note: null })).toBe(false);
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
