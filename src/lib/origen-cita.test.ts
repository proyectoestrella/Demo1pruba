import { expect, it } from "bun:test";
import { serializarOrigen, leerOrigen } from "./origen-cita";
import { serializeBookingNote, parseBookingNote } from "./booking-answers";
import { serializeDepositNote, parseDepositNote } from "./deposit-deadline";

it("conserva origen, respuestas y señal en la nota existente", () => {
  const reserva = serializeBookingNote("Prefiere tarde", { hairLength: "Largo" });
  const importada = serializarOrigen(reserva, "tpv123");
  const guardada = serializeDepositNote(importada, { depositRequestedAt: "2026-09-24T10:00:00Z" });
  const deposito = parseDepositNote(guardada);
  const origen = leerOrigen(deposito.note);
  const respuestas = parseBookingNote(origen.note);
  expect(origen.origen).toBe("tpv123");
  expect(respuestas).toEqual({ note: "Prefiere tarde", answers: { hairLength: "Largo" } });
  expect(deposito.requestedAt).toBe("2026-09-24T10:00:00Z");
  expect(leerOrigen("Nota normal")).toEqual({ note: "Nota normal" });
});
