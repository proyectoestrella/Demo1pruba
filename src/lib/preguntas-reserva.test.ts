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

describe("lista propia: orden, aplicables, validación y obligatorias", () => {
  const lista = [
    { id: "alergias", texto: "¿Alguna alergia?", tipo: "texto" as const, obligatoria: false, activa: true },
    { id: "ocasion", texto: "¿Para qué ocasión?", tipo: "opcion" as const, opciones: ["Boda", "Graduación", "Otra"], obligatoria: true, activa: true, servicios: ["peinado-de-novia", "recogido-de-evento"] },
    { id: "invitadas", texto: "¿Cuántas personas?", tipo: "numero" as const, obligatoria: false, activa: true, servicios: ["recogido-de-evento"] },
    { id: "retirada", texto: "Antigua", tipo: "texto" as const, obligatoria: true, activa: false },
    { id: "tinte", texto: "¿Llevas tinte?", tipo: "si_no" as const, obligatoria: false, activa: true, detalle: { id: "tinteCual", texto: "¿Cuál?", obligatorio: true } },
  ];

  it("respeta el orden del salón y solo las activas que aplican a los servicios", async () => {
    const { preguntasAplicables } = await import("./preguntas-reserva");
    expect(preguntasAplicables(lista, ["corte"]).map((p) => p.id)).toEqual(["alergias", "tinte"]);
    expect(preguntasAplicables(lista, ["peinado-de-novia"]).map((p) => p.id)).toEqual(["alergias", "ocasion", "tinte"]);
    expect(preguntasAplicables(lista, ["corte", "recogido-de-evento"]).map((p) => p.id)).toEqual(["alergias", "ocasion", "invitadas", "tinte"]);
  });

  it("valida por tipo y descarta lo que no es de estas preguntas", async () => {
    const { limpiarRespuestas } = await import("./preguntas-reserva");
    expect(limpiarRespuestas(lista, {
      alergias: "  Al amoníaco  ", ocasion: "Cumpleaños", invitadas: "3,5", tinte: "No", tinteCual: "Castaño", intrusa: "x",
    })).toEqual({ alergias: "Al amoníaco", invitadas: "3.5", tinte: "No" });
    expect(limpiarRespuestas(lista, { ocasion: "Boda", tinte: "Sí", tinteCual: "Rubio" })).toEqual({ ocasion: "Boda", tinte: "Sí", tinteCual: "Rubio" });
    expect(limpiarRespuestas(lista, { invitadas: "muchas" })).toBeUndefined();
  });

  it("obligatorias: la propia y el detalle obligatorio de un «Sí»", async () => {
    const { obligatoriasSinResponder, preguntasAplicables } = await import("./preguntas-reserva");
    const novia = preguntasAplicables(lista, ["peinado-de-novia"]);
    expect(obligatoriasSinResponder(novia, {})).toEqual(["ocasion"]);
    expect(obligatoriasSinResponder(novia, { ocasion: "Boda", tinte: "Sí" })).toEqual(["tinteCual"]);
    expect(obligatoriasSinResponder(novia, { ocasion: "Boda", tinte: "Sí", tinteCual: "Rubio" })).toEqual([]);
    // Una obligatoria inactiva o que no aplica no bloquea.
    expect(obligatoriasSinResponder(preguntasAplicables(lista, ["corte"]), {})).toEqual([]);
  });

  it("ids nuevos estables y sin chocar con los existentes ni con sus detalles", async () => {
    const { idPreguntaNueva } = await import("./preguntas-reserva");
    const id = idPreguntaNueva(lista, 1_000_000);
    expect(id).toBe("plfls");
    expect(idPreguntaNueva([...lista, { ...lista[0], id }], 1_000_000)).toBe("plfls2");
  });
});
