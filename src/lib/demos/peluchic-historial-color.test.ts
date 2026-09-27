import { afterAll, beforeAll, describe, expect, it, setSystemTime } from "bun:test";

import { employeesForType, servicesForType, textosDeCarta } from "../mock/salon";
import { buildSeed } from "../mock/seed";
import { fechaLocal, hojaDelDia } from "../hoja-del-dia";
import { conHistorialColorPeluchic, MEZCLA_PELUCHIC, PELUCHIC } from "./peluchic";

/**
 * El dolor nº1 de María: mirar a mano, cada mañana, el color de ~20
 * clientas. La demo tiene que enseñar lo contrario. Mismo reloj que
 * `semilla.test.ts`: lunes 28 de septiembre de 2026 a las 9:30, día que
 * el salón cierra (por eso `abreHoy`).
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

describe("historial de color de la demo de PeluChic", () => {
  beforeAll(() => setSystemTime(LUNES_PRESENTACION));
  afterAll(() => setSystemTime());

  it("es determinista", () => {
    const a = conHistorialColorPeluchic(semillaBase().appointments, semillaBase().clients);
    const b = conHistorialColorPeluchic(semillaBase().appointments, semillaBase().clients);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("no cambia el número de citas del lunes ni de ninguna cita existente", () => {
    const base = semillaBase();
    const conHistorial = conHistorialColorPeluchic(base.appointments, base.clients);
    const hoyStr = fechaLocal(LUNES_PRESENTACION);
    expect(hojaDelDia(conHistorial, hoyStr).length).toBe(hojaDelDia(base.appointments, hoyStr).length);

    const porId = new Map(base.appointments.map((a) => [a.id, a]));
    for (const cita of conHistorial) {
      const original = porId.get(cita.id);
      if (original) expect(cita).toEqual(original); // ninguna cita ya sembrada se toca: solo se añade histórico.
    }
  });

  it("casi todas las citas de hoy y de mañana muestran su último color", () => {
    const base = semillaBase();
    const citas = conHistorialColorPeluchic(base.appointments, base.clients);
    const hoyStr = fechaLocal(LUNES_PRESENTACION);
    const mananaStr = fechaLocal(manana(LUNES_PRESENTACION));
    const relevantes = [...hojaDelDia(citas, hoyStr), ...hojaDelDia(citas, mananaStr)];
    const conColor = relevantes.filter((x) => x.ultimoColor?.colorFormula);
    expect(relevantes.length).toBeGreaterThan(15); // el lunes solo trae 19 citas: que el corpus sea real.
    expect(conColor.length / relevantes.length).toBeGreaterThanOrEqual(0.6);
  });

  it("las visitas añadidas son pasado importado (TPV 123), nunca antes de que la clienta existiera", () => {
    const base = semillaBase();
    const citas = conHistorialColorPeluchic(base.appointments, base.clients);
    const clientesPorId = new Map(base.clients.map((c) => [c.id, c]));
    const añadidas = citas.filter((c) => c.id.startsWith("a-color-hist-"));
    expect(añadidas.length).toBeGreaterThan(0);
    for (const cita of añadidas) {
      expect(cita.status).toBe("completed");
      expect(cita.origen).toBe("tpv123");
      expect(+new Date(cita.start)).toBeLessThan(+LUNES_PRESENTACION);
      const cliente = clientesPorId.get(cita.clientId);
      expect(cliente).toBeDefined();
      if (cliente) expect(+new Date(cita.start)).toBeGreaterThanOrEqual(+new Date(cliente.createdAt));
    }
  });

  it("no toca a la clienta de la duración flexible (Marisol Iglesias)", () => {
    const base = semillaBase();
    const citas = conHistorialColorPeluchic(base.appointments, base.clients);
    const suyas = citas.filter((c) => c.clientId === "c-duracion-flexible");
    expect(suyas.every((c) => !c.id.startsWith("a-color-hist-"))).toBe(true);
  });
});
