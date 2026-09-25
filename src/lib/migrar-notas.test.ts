import { describe, expect, it } from "bun:test";
import { parcheCitaDesdeNota, parcheClienteDesdeNota } from "./migrar-notas";
import { serializeBookingNote } from "./booking-answers";
import { serializeDepositNote } from "./deposit-deadline";
import { serializarOrigen } from "./origen-cita";
import { MANUAL_BLOCK_NOTE } from "./no-show";

describe("relleno de citas desde la nota", () => {
  const nota = serializeDepositNote(
    serializarOrigen(serializeBookingNote("Trae foto", { hairLength: "Largo" }), "tpv123"),
    { depositRequestedAt: "2026-09-25T10:00:00.000Z", depositDueAt: "2026-09-25T12:00:00.000Z", depositPeriodHours: 2, depositEur: 10 },
  )!;

  it("saca respuestas, origen y plazo a sus columnas y deja la nota limpia", () => {
    expect(parcheCitaDesdeNota({ note: nota })).toEqual({
      note: "Trae foto",
      booking_answers: { hairLength: "Largo" },
      deposit_due_at: "2026-09-25T12:00:00.000Z",
      deposit_period_hours: 2,
      origen: "tpv123",
    });
  });

  it("no pisa una columna que ya tenga valor", () => {
    const p = parcheCitaDesdeNota({ note: nota, booking_answers: { hairLength: "Corto" }, deposit_due_at: "x", deposit_period_hours: 4, origen: "tpv123" });
    expect(p).toEqual({ note: "Trae foto" });
  });

  it("una nota sin marcadores no genera parche", () => {
    expect(parcheCitaDesdeNota({ note: "solo texto" })).toBeNull();
    expect(parcheCitaDesdeNota({ note: null })).toBeNull();
  });
});

describe("relleno del bloqueo manual desde penalty_note", () => {
  it("enciende manual_block, restaura la deuda anterior y borra la deuda inventada de 0 €", () => {
    const fila = { penalty_eur: 0, penalty_note: `${MANUAL_BLOCK_NOTE}|${JSON.stringify({ note: "No vino el 12", keep: true, block: false })}` };
    expect(parcheClienteDesdeNota(fila)).toEqual({ manual_block: true, penalty_note: "No vino el 12", penalty_keep: true, penalty_block: false, penalty_eur: null, penalty_at: null });
  });

  it("conserva una deuda real que hubiera debajo del bloqueo", () => {
    const fila = { penalty_eur: "15", penalty_note: `${MANUAL_BLOCK_NOTE}|{}` };
    expect(parcheClienteDesdeNota(fila)).toEqual({ manual_block: true, penalty_note: null, penalty_keep: false, penalty_block: true });
  });

  it("una ficha normal no genera parche", () => {
    expect(parcheClienteDesdeNota({ penalty_eur: 15, penalty_note: "Plantón" })).toBeNull();
    expect(parcheClienteDesdeNota({ penalty_eur: null, penalty_note: null })).toBeNull();
  });
});
