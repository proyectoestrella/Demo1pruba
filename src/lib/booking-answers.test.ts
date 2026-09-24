import { describe, expect, it } from "bun:test";
import { bookingAnswersComplete, bookingQuestionsEnabled, parseBookingNote, serializeBookingNote } from "./booking-answers";

describe("preguntas al reservar", () => {
  it("usa el tipo de negocio como valor inicial y respeta el ajuste", () => {
    expect(bookingQuestionsEnabled({}, "peluqueria")).toBe(true);
    expect(bookingQuestionsEnabled({}, "barberia")).toBe(false);
    expect(bookingQuestionsEnabled({ bookingQuestionsEnabled: false }, "peluqueria")).toBe(false);
  });

  it("serializa respuestas y conserva la nota libre al leer de Supabase", () => {
    const answers = { hairLength: "Largo" as const, hasColor: "Sí" as const, colorDetail: "Castaño", recentChemical: "No" as const };
    const saved = serializeBookingNote("Prefiero por la tarde", answers);
    expect(parseBookingNote(saved)).toEqual({ note: "Prefiero por la tarde", answers });
    expect(parseBookingNote("Nota antigua")).toEqual({ note: "Nota antigua" });
  });

  it("solo exige detalles cuando la respuesta es sí", () => {
    expect(bookingAnswersComplete({ hairLength: "Corto", hasColor: "No", recentChemical: "No" })).toBe(true);
    expect(bookingAnswersComplete({ hairLength: "Corto", hasColor: "Sí", recentChemical: "No" })).toBe(false);
  });
});
