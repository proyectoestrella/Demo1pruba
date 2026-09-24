import { describe, expect, it } from "bun:test";
import { depositDueAt, depositState, extendDepositDueAt, parseDepositNote, serializeDepositNote } from "./deposit-deadline";
import { horaEnPalabras, mensajeDeFianza } from "./avisos";
import { parseBookingNote, serializeBookingNote } from "./booking-answers";
import { rowToAppointment } from "./salon-rows";

const requestedAt = "2026-09-24T12:00:00.000Z";
const dueAt = "2026-09-24T16:00:00.000Z";

describe("plazo de la señal", () => {
  it("suma las horas elegidas y amplía desde ahora si ya venció", () => {
    expect(depositDueAt(requestedAt, 4)).toBe(dueAt);
    expect(extendDepositDueAt(dueAt, 4, new Date("2026-09-24T17:00:00.000Z"))).toBe("2026-09-24T21:00:00.000Z");
  });

  it("avisa del vencimiento sin cambiar el estado de la cita", () => {
    const a = { status: "pending" as const, depositRequestedAt: requestedAt, depositDueAt: dueAt };
    expect(depositState(a, new Date("2026-09-24T15:59:59.000Z"))).toBe("requested");
    expect(depositState(a, new Date(dueAt))).toBe("expired");
    expect(a.status).toBe("pending");
    expect(depositState({ ...a, depositReceivedAt: dueAt }, new Date("2026-09-25T00:00:00.000Z"))).toBe("received");
    expect(depositState({ ...a, status: "cancelled" }, new Date(dueAt))).toBe("none");
  });

  it("conserva el vencimiento y las respuestas en la nota de Supabase", () => {
    const note = serializeDepositNote(serializeBookingNote("Prefiere la tarde", { hairLength: "Largo" }), {
      depositRequestedAt: requestedAt, depositDueAt: dueAt, depositPeriodHours: 4, depositEur: 10,
    });
    const deposit = parseDepositNote(note);
    expect(deposit.dueAt).toBe(dueAt);
    expect(deposit.requestedAt).toBe(requestedAt);
    expect(deposit.eur).toBe(10);
    expect(parseBookingNote(deposit.note)).toEqual({ note: "Prefiere la tarde", answers: { hairLength: "Largo" } });
    const restored = rowToAppointment({
      id: "uuid", local_id: "local", client_id: "client", client_name: "Ana", service_id: "corte",
      employee_id: "mario", start_at: "2026-09-25T12:00:00.000Z", duration_min: 60,
      price_eur: 30, status: "pending", client_confirmed_at: null, note: note ?? null,
    });
    expect(restored.depositRequestedAt).toBe(requestedAt);
    expect(restored.depositDueAt).toBe(dueAt);
    expect(restored.bookingAnswers?.hairLength).toBe("Largo");
    expect(parseDepositNote(note).note).not.toContain("siShow:senal");
  });

  it("incluye el plazo legible en el WhatsApp", () => {
    const message = mensajeDeFianza({
      clientName: "Ana", salonName: "PeluChic", startISO: "2026-09-26T12:00:00.000Z",
      importeEur: 10, bizumPhone: "600 000 000", deadlineISO: dueAt,
    }, requestedAt);
    expect(message).toContain(`tienes hasta hoy a las ${horaEnPalabras(dueAt)} para hacer el Bizum`);
    expect(message).toContain("10 € de señal por Bizum al 600 000 000");
  });
});
