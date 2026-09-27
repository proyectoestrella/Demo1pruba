import { afterAll, beforeAll, describe, expect, it, setSystemTime } from "bun:test";

import { employeesForType, servicesForType, textosDeCarta } from "../mock/salon";
import { buildSeed } from "../mock/seed";
import { fechaLocal, hojaDelDia } from "../hoja-del-dia";
import { conHistorialColorPeluchic, conObservacionesPeluchic, conRespuestasReservaPeluchic, MEZCLA_PELUCHIC, PELUCHIC } from "./peluchic";

/**
 * Dolor nº3 de María, además del color y las respuestas: lo que recuerda de
 * cada clienta y hoy solo lleva en la cabeza (`Client.notes`, «Observaciones»
 * en la ficha). Mismo reloj que el resto de tests de esta demo.
 */
const LUNES_PRESENTACION = new Date("2026-09-28T09:30:00+02:00");
const ABRE_HOY = "2026-09-28";

/** Raíces de datos de salud (RGPD art. 9): ninguna observación puede llevarlas — ver `preguntaPorSalud`. */
const PALABRAS_DE_SALUD = /alerg|embaraz|medic|enferm/i;

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
  const citas = conRespuestasReservaPeluchic(conHistorialColorPeluchic(base.appointments, base.clients), base.clients);
  const clients = conObservacionesPeluchic(base.clients, citas);
  return { base, citas, clients };
}

/** Clientas (no clientes-duración-flexible) con cita hoy o mañana. */
function clientesDeLaVentana(citas: ReturnType<typeof conTodo>["citas"]) {
  const hoyStr = fechaLocal(LUNES_PRESENTACION);
  const mananaStr = fechaLocal(manana(LUNES_PRESENTACION));
  const ventana = [...hojaDelDia(citas, hoyStr), ...hojaDelDia(citas, mananaStr)];
  return new Map(ventana.filter((v) => v.cita.clientName !== "Marisol Iglesias").map((v) => [v.cita.clientId, v]));
}

describe("observaciones de la demo de PeluChic", () => {
  beforeAll(() => setSystemTime(LUNES_PRESENTACION));
  afterAll(() => setSystemTime());

  it("es determinista", () => {
    const a = conTodo().clients;
    const b = conTodo().clients;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("no toca ningún otro campo de la clienta, solo `notes`", () => {
    const { base, clients } = conTodo();
    const porId = new Map(base.clients.map((c) => [c.id, c]));
    for (const c of clients) {
      const original = porId.get(c.id)!;
      const { notes: _n1, ...resto } = c;
      const { notes: _n2, ...restoOriginal } = original;
      expect(resto).toEqual(restoOriginal);
    }
  });

  it("~50 % de las clientas con cita hoy o mañana tienen observación", () => {
    const { citas, clients } = conTodo();
    const ventana = clientesDeLaVentana(citas);
    const porId = new Map(clients.map((c) => [c.id, c]));
    expect(ventana.size).toBeGreaterThan(10);
    const conNota = [...ventana.keys()].filter((id) => !!porId.get(id)?.notes).length;
    const proporcion = conNota / ventana.size;
    expect(proporcion).toBeGreaterThanOrEqual(0.3);
    expect(proporcion).toBeLessThanOrEqual(0.7);
  });

  it("ninguna observación contiene datos de salud (RGPD art. 9)", () => {
    const { clients } = conTodo();
    for (const c of clients) {
      if (c.notes) expect(c.notes).not.toMatch(PALABRAS_DE_SALUD);
    }
  });

  it("son variadas, cortas y coherentes con la respuesta o la cita de esa clienta", () => {
    const { citas, clients } = conTodo();
    const ventana = clientesDeLaVentana(citas);
    const porId = new Map(clients.map((c) => [c.id, c]));
    const notas: string[] = [];

    for (const [clientId, v] of ventana) {
      const nota = porId.get(clientId)?.notes;
      if (!nota) continue;
      notas.push(nota);
      expect(nota.length).toBeLessThanOrEqual(120);

      if (nota.includes("primera hora")) expect(new Date(v.cita.start).getHours()).toBeLessThan(11);
      if (nota.startsWith("Pelo fino")) expect(v.cita.bookingAnswers?.hairType?.endsWith("fino")).toBe(true);
      if (nota.startsWith("Pelo grueso")) expect(v.cita.bookingAnswers?.hairType?.endsWith("grueso")).toBe(true);
      if (nota.startsWith("Pelo rizado")) expect(v.cita.bookingAnswers?.hairType?.startsWith("Rizado")).toBe(true);
      if (nota.includes("tono más cálido")) expect(v.cita.bookingAnswers?.hasColor).toBe("Sí");
      if (nota.startsWith("Siempre pide a")) {
        expect(["María", "Sara", "Noelia"].some((n) => nota === `Siempre pide a ${n}.`)).toBe(true);
      }
    }
    expect(notas.length).toBeGreaterThan(3);
    expect(new Set(notas).size).toBeGreaterThan(1); // no todas iguales.
  });

  it("no pisa una observación ya existente", () => {
    const base = semillaBase();
    const clientesConNotaPrevia = base.clients.map((c, i) => (i < 3 ? { ...c, notes: "Nota previa del salón." } : c));
    const citas = conRespuestasReservaPeluchic(conHistorialColorPeluchic(base.appointments, clientesConNotaPrevia), clientesConNotaPrevia);
    const clients = conObservacionesPeluchic(clientesConNotaPrevia, citas);
    for (let i = 0; i < 3; i++) expect(clients[i].notes).toBe("Nota previa del salón.");
  });
});
