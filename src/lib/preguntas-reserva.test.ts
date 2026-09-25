import { describe, expect, it } from "bun:test";
import { preguntasDelSalon, preguntasPorDefecto } from "./preguntas-reserva";
import { bookingAnswersComplete, parseBookingNote, serializeBookingNote } from "./booking-answers";

describe("compatibilidad: un salón sin lista propia no nota nada", () => {
  it("las de siempre, con sus ids y textos, activas según el tipo de negocio", () => {
    const peluqueria = preguntasDelSalon({}, "peluqueria");
    expect(peluqueria.map((p) => p.id)).toEqual(["hairLength", "hasColor", "recentChemical"]);
    expect(peluqueria.every((p) => p.activa && !p.obligatoria)).toBe(true);
    expect(peluqueria[0]).toMatchObject({ tipo: "opcion", opciones: ["Corto", "Medio", "Largo", "Muy largo"], texto: "¿Qué largo de pelo tienes?" });
    expect(peluqueria[1].detalle).toEqual({ id: "colorDetail", texto: "¿Cuál es tu color o tinte?", obligatorio: false });
    expect(preguntasDelSalon({}, "barberia").every((p) => !p.activa)).toBe(true);
  });

  it("los dos interruptores de siempre siguen mandando mientras no haya lista", () => {
    const l = preguntasDelSalon({ bookingQuestionsEnabled: true, bookingQuestionsRequired: true }, "barberia");
    expect(l.every((p) => p.activa && p.obligatoria && (!p.detalle || p.detalle.obligatorio))).toBe(true);
  });

  it("una lista propia manda, aunque esté vacía", () => {
    expect(preguntasDelSalon({ preguntasReserva: [] }, "peluqueria")).toEqual([]);
  });

  it("las respuestas guardadas de antes se leen igual", () => {
    const antes = { hairLength: "Largo", hasColor: "Sí", colorDetail: "Castaño", recentChemical: "No" };
    const nota = serializeBookingNote("Por la tarde", antes);
    expect(parseBookingNote(nota)).toEqual({ note: "Por la tarde", answers: antes });
    expect(bookingAnswersComplete({ hairLength: "Corto", hasColor: "Sí", recentChemical: "No" })).toBe(false);
  });

  it("la nota de respaldo guarda también respuestas a preguntas propias", () => {
    const nota = serializeBookingNote(undefined, { hairLength: "Corto", alergias: "Al amoníaco" });
    expect(parseBookingNote(nota).answers).toEqual({ hairLength: "Corto", alergias: "Al amoníaco" });
  });

  it("preguntasPorDefecto son las mismas en cualquier llamada (ids estables)", () => {
    expect(preguntasPorDefecto({}, "unisex").map((p) => p.id)).toEqual(preguntasPorDefecto({}, "peluqueria").map((p) => p.id));
  });
});

describe("respuestas legibles en el panel y en el CSV", () => {
  it("con el texto de la pregunta, en el orden del formulario, detalle incluido", async () => {
    const { respuestasLegibles } = await import("./preguntas-reserva");
    const r = respuestasLegibles({}, "peluqueria", { recentChemical: "No", hasColor: "Sí", colorDetail: "Castaño 5.3", hairLength: "Largo" });
    expect(r.map((x) => `${x.pregunta} ${x.respuesta}`)).toEqual([
      "¿Qué largo de pelo tienes? Largo",
      "¿Llevas color o tinte ahora? Sí · Castaño 5.3",
      "¿Te has hecho algún tratamiento químico en el último mes (tinte, mechas, alisado, permanente)? No",
    ]);
  });

  it("el CSV de citas lleva una columna con las respuestas", async () => {
    const { citasToCsv } = await import("./export-csv");
    const perfil = { preguntasReserva: [{ id: "alergias", texto: "¿Alguna alergia?", tipo: "texto" as const, obligatoria: false, activa: true }] };
    const csv = citasToCsv([{ id: "a", clientId: "c", clientName: "Ana", serviceIds: [], employeeId: "mario", start: "2026-09-29T15:00:00.000Z", duration: 30, priceEur: 20, status: "confirmed", bookingAnswers: { alergias: "Al amoníaco" } }], {}, {}, { perfil, tipo: "peluqueria" });
    expect(csv).toContain("¿Alguna alergia? Al amoníaco");
  });
});
