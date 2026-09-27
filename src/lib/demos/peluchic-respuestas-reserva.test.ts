import { afterAll, beforeAll, describe, expect, it, setSystemTime } from "bun:test";

import { employeesForType, servicesForType, textosDeCarta } from "../mock/salon";
import { buildSeed } from "../mock/seed";
import { fechaLocal, hojaDelDia } from "../hoja-del-dia";
import { conHistorialColorPeluchic, conRespuestasReservaPeluchic, MEZCLA_PELUCHIC, PELUCHIC } from "./peluchic";

/**
 * Dolor nº2 de María, además del color (ver peluchic-historial-color.test.ts):
 * mirar a mano qué le dijo cada clienta al reservar. Mismo reloj que los
 * demás tests de esta demo: lunes 28 de septiembre de 2026 a las 9:30.
 */
const LUNES_PRESENTACION = new Date("2026-09-28T09:30:00+02:00");
const ABRE_HOY = "2026-09-28";

function semillaBase() {
  const equipo = employeesForType("peluqueria", PELUCHIC.team, PELUCHIC.teamHours, PELUCHIC.openingHours, PELUCHIC.teamIds, ABRE_HOY);
  const carta = servicesForType("peluqueria", PELUCHIC.menu, textosDeCarta(PELUCHIC));
  return buildSeed("peluqueria", equipo, carta, { duracionFlexible: true, mezcla: MEZCLA_PELUCHIC });
}

function manana(hoy: Date): Date {
  const m = new Date(hoy);
  m.setDate(m.getDate() + 1);
  return m;
}

function conTodo() {
  const base = semillaBase();
  const conHistorial = conHistorialColorPeluchic(base.appointments, base.clients);
  return { base, citas: conRespuestasReservaPeluchic(conHistorial, base.clients) };
}

/** Ids válidos: las preguntas del perfil y el detalle de las que lo llevan. */
const IDS_CONOCIDOS = new Set<string>();
for (const p of PELUCHIC.preguntasReserva ?? []) {
  IDS_CONOCIDOS.add(p.id);
  if (p.detalle) IDS_CONOCIDOS.add(p.detalle.id);
}

describe("respuestas de reserva de la demo de PeluChic", () => {
  beforeAll(() => setSystemTime(LUNES_PRESENTACION));
  afterAll(() => setSystemTime());

  it("PeluChic tiene cuatro preguntas: las tres de siempre más «¿Cómo es tu pelo?»", () => {
    const ids = (PELUCHIC.preguntasReserva ?? []).map((p) => p.id);
    expect(ids).toEqual(["hairLength", "hasColor", "recentChemical", "hairType"]);
    const hairType = PELUCHIC.preguntasReserva!.find((p) => p.id === "hairType")!;
    expect(hairType.tipo).toBe("opcion");
    expect(hairType.opciones).toHaveLength(9); // 3 texturas × 3 grosores, sin cambiar el modelo de preguntas.
  });

  it("es determinista", () => {
    const a = conTodo().citas;
    const b = conTodo().citas;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("no cambia el número de citas del lunes ni ningún otro campo de la cita", () => {
    const { base, citas } = conTodo();
    const conHistorial = conHistorialColorPeluchic(base.appointments, base.clients);
    const hoyStr = fechaLocal(LUNES_PRESENTACION);
    expect(hojaDelDia(citas, hoyStr).length).toBe(hojaDelDia(base.appointments, hoyStr).length);

    const porId = new Map(conHistorial.map((a) => [a.id, a]));
    for (const cita of citas) {
      const original = porId.get(cita.id);
      if (!original) continue;
      const { bookingAnswers: _b1, ...resto } = cita;
      const { bookingAnswers: _b2, ...restoOriginal } = original;
      expect(resto).toEqual(restoOriginal); // solo cambia bookingAnswers: nunca hora, precio ni profesional.
    }
  });

  it("~75 % de las citas de hoy y de mañana traen respuestas", () => {
    const { citas } = conTodo();
    const hoyStr = fechaLocal(LUNES_PRESENTACION);
    const mananaStr = fechaLocal(manana(LUNES_PRESENTACION));
    const relevantes = [...hojaDelDia(citas, hoyStr), ...hojaDelDia(citas, mananaStr)];
    expect(relevantes.length).toBeGreaterThan(15); // el lunes solo trae 19 citas: que el corpus sea real.
    const conRespuestas = relevantes.filter((x) => x.cita.bookingAnswers).length;
    const proporcion = conRespuestas / relevantes.length;
    expect(proporcion).toBeGreaterThanOrEqual(0.6);
    expect(proporcion).toBeLessThanOrEqual(0.9);
  });

  it("todas las respuestas usan ids de preguntas existentes en el perfil", () => {
    const { citas } = conTodo();
    const hoyStr = fechaLocal(LUNES_PRESENTACION);
    const mananaStr = fechaLocal(manana(LUNES_PRESENTACION));
    const relevantes = [...hojaDelDia(citas, hoyStr), ...hojaDelDia(citas, mananaStr)]
      .map((x) => x.cita.bookingAnswers)
      .filter((b): b is NonNullable<typeof b> => !!b);
    expect(relevantes.length).toBeGreaterThan(0);
    for (const respuestas of relevantes) {
      for (const id of Object.keys(respuestas)) expect(IDS_CONOCIDOS.has(id)).toBe(true);
    }
  });

  it("no son todas iguales ni absurdas: hay clientas con color y sin él, y las opciones son válidas", () => {
    const { citas } = conTodo();
    const hoyStr = fechaLocal(LUNES_PRESENTACION);
    const mananaStr = fechaLocal(manana(LUNES_PRESENTACION));
    const relevantes = [...hojaDelDia(citas, hoyStr), ...hojaDelDia(citas, mananaStr)]
      .map((x) => x.cita.bookingAnswers)
      .filter((b): b is NonNullable<typeof b> => !!b);

    const hairLengthQ = PELUCHIC.preguntasReserva!.find((p) => p.id === "hairLength")!;
    const hairTypeQ = PELUCHIC.preguntasReserva!.find((p) => p.id === "hairType")!;
    for (const b of relevantes) {
      if (b.hairLength) expect(hairLengthQ.opciones).toContain(b.hairLength);
      if (b.hairType) expect(hairTypeQ.opciones).toContain(b.hairType);
      if (b.hasColor) expect(["Sí", "No"]).toContain(b.hasColor);
      if (b.recentChemical) expect(["Sí", "No"]).toContain(b.recentChemical);
      // El detalle solo aparece junto a un «Sí» (igual que exige limpiarRespuestas).
      if (b.colorDetail) expect(b.hasColor).toBe("Sí");
      if (b.chemicalDetail) expect(b.recentChemical).toBe("Sí");
    }
    expect(relevantes.some((b) => b.hasColor === "No")).toBe(true); // p. ej., una clienta de depilación de cejas.
    expect(relevantes.some((b) => b.hasColor === "Sí")).toBe(true);
    expect(new Set(relevantes.map((b) => b.hairLength)).size).toBeGreaterThan(1);
    expect(new Set(relevantes.map((b) => b.hairType)).size).toBeGreaterThan(1);
  });

  it("no toca a la clienta de la duración flexible (Marisol Iglesias)", () => {
    const { citas } = conTodo();
    const suyas = citas.filter((c) => c.clientId === "c-duracion-flexible");
    expect(suyas.every((c) => !c.bookingAnswers)).toBe(true);
  });
});
