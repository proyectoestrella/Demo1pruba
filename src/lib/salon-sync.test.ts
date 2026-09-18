import { afterEach, describe, expect, it, mock } from "bun:test";

/**
 * La garantía más importante de todo el backend: una demo de venta (las ~54 del
 * rutero, sin fila en `salons`) no llama a Supabase NUNCA. Se prueba contando
 * las llamadas reales a las server functions con el módulo interceptado.
 */
const llamadas: string[] = [];
const registra =
  (nombre: string) =>
  (...args: unknown[]) => {
    llamadas.push(nombre);
    void args;
    return Promise.resolve({ synced: true as const });
  };

mock.module("./api/salons.functions", () => ({
  syncAppointment: registra("syncAppointment"),
  deleteAppointment: registra("deleteAppointment"),
  saveSalonProfile: registra("saveSalonProfile"),
  applyClientPenalty: registra("applyClientPenalty"),
  clearClientPenalty: registra("clearClientPenalty"),
  saveClientNotes: registra("saveClientNotes"),
  getSalonProfile: registra("getSalonProfile"),
  listSalonData: registra("listSalonData"),
  checkClientPenalty: registra("checkClientPenalty"),
}));

const {
  pushAppointment,
  pushAppointmentDeletion,
  pushSalonProfile,
  pushPenalty,
  pushPenaltyCleared,
  pushClientNotes,
} = await import("./salon-sync");
const { salon } = await import("./mock/salon");

const cita = {
  id: "a-new-1",
  clientId: "c-1",
  clientName: "Marta",
  serviceIds: ["corte"],
  employeeId: "mario" as const,
  start: "2026-09-26T13:00:00.000Z",
  duration: 30,
  priceEur: 15,
  status: "pending" as const,
};

const cliente = {
  id: "c-1",
  name: "Marta",
  phone: "+34 600 111 222",
  createdAt: "2026-09-01T00:00:00.000Z",
  notes: "Usa el número 8",
};

afterEach(() => {
  llamadas.length = 0;
});

describe("salon-sync con slug null (demo de venta)", () => {
  it("no hace ni una sola llamada a Supabase", () => {
    pushAppointment(null, cita);
    pushAppointmentDeletion(null, "a-new-1");
    pushSalonProfile(null, salon);
    pushPenalty(null, cliente, 7, "No vino");
    pushPenaltyCleared(null, cliente, "Perdonada");
    pushClientNotes(null, cliente);
    expect(llamadas).toEqual([]);
  });
});

describe("salon-sync con un salón real", () => {
  it("sube la cita, el borrado y el perfil", () => {
    pushAppointment("the-best-shave-barber", cita);
    pushAppointmentDeletion("the-best-shave-barber", "a-new-1");
    pushSalonProfile("the-best-shave-barber", salon);
    expect(llamadas).toEqual(["syncAppointment", "deleteAppointment", "saveSalonProfile"]);
  });

  it("sube penalización, perdón y notas del cliente", () => {
    pushPenalty("the-best-shave-barber", cliente, 7, "No vino");
    pushPenaltyCleared("the-best-shave-barber", cliente, "Perdonada");
    pushClientNotes("the-best-shave-barber", cliente);
    expect(llamadas).toEqual(["applyClientPenalty", "clearClientPenalty", "saveClientNotes"]);
  });

  it("sin teléfono no hay ficha que marcar: no se llama a nada", () => {
    const sinTelefono = { ...cliente, phone: "" };
    pushPenalty("the-best-shave-barber", sinTelefono, 7);
    pushPenaltyCleared("the-best-shave-barber", sinTelefono);
    pushClientNotes("the-best-shave-barber", sinTelefono);
    pushPenalty("the-best-shave-barber", undefined, 7);
    expect(llamadas).toEqual([]);
  });
});
