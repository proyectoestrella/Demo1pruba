/**
 * Barrido 27-sep: «¿qué se ha hecho fulanita?» — la función que más le gustó
 * a María en la demo — respondía «de X no tienes nada apuntado» aunque su
 * ficha sí tenía observaciones y notas técnicas, y «qué se ha hecho X» ni
 * siquiera se reconocía como la pregunta de la última visita.
 *
 * Tres fallos distintos, cada uno con su fixture mínima (sin depender de la
 * semilla de la demo PeluChic, que otro agente está tocando a la vez):
 *  1. Clasificación: «qué se ha hecho X» no estaba entre los ejemplos de
 *     `ultima-visita-clienta` (especificacion.ts).
 *  2. `ultimaVisitaClienta` no decía el último color si no era el de la
 *     última visita (mechas en mayo, corte en agosto: el corte no lleva
 *     color, pero el último color SÍ existe y hay que decirlo).
 *  3. `notasClienta` sumaba `Client.notes` crudo Y `avisos` (que ya traía
 *     «Observaciones: …» con el mismo texto) → salía dos veces en el panel
 *     real (fuentes-panel.ts); y nunca decía la nota técnica de una visita,
 *     porque `FichaA` no la llevaba.
 */
import { describe, expect, test } from "bun:test";
import { crearFuentesBackend, type DatosBackend } from "../fuentes-backend";
import { crearAsistente } from "../responder";
import { employeesForType, servicesForType } from "../../mock/salon";
import type { Appointment, Client, SalonProfile } from "../../mock/types";

const HORARIO = ["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "9:00–14:00", "Cerrado"];
const EQUIPO = ["Sara~Estilista"];
const CARTA = ["Corte~45~25~Peluquería", "Mechas~120~60~Peluquería"];

const perfil: SalonProfile = {
  id: "prueba", slug: "prueba", name: "Salón de Prueba", tagline: "", about: "", address: "",
  phone: "", instagram: "", openingHours: HORARIO, rating: 0, reviewCount: 0, specialties: [],
};
const equipo = employeesForType("peluqueria", EQUIPO, undefined, HORARIO);
const servicios = servicesForType("peluqueria", CARTA);
const AHORA = new Date("2026-09-27T10:00:00.000Z");

const clienta: Client = { id: "cli-elena", name: "Elena Prueba", phone: "+34 600 000 111", createdAt: "2025-01-01", notes: "Usa el número 8" };

// Mechas en mayo (con color y nota técnica) y un corte más reciente en
// agosto (sin color): el último color NO es de la última visita.
const citaConColorYNota: Appointment = {
  id: "cita-mechas", clientId: clienta.id, clientName: clienta.name, serviceIds: [servicios[1].id],
  employeeId: equipo[0].id, start: "2026-05-28T10:00:00.000Z", duration: 120, priceEur: 60,
  status: "completed", colorFormula: "Mechas finas, oxidante 20 vol", technicalNotes: "Dejar libre el contorno.",
};
const citaReciente: Appointment = {
  id: "cita-corte", clientId: clienta.id, clientName: clienta.name, serviceIds: [servicios[0].id],
  employeeId: equipo[0].id, start: "2026-08-13T10:00:00.000Z", duration: 45, priceEur: 25,
  status: "completed",
};

const datos: DatosBackend = { citas: [citaConColorYNota, citaReciente], clientes: [clienta], equipo, servicios, listaEspera: [], perfil, ahora: AHORA };
const asistente = () => crearAsistente(crearFuentesBackend(datos));

describe("preguntar por una clienta: qué se ha hecho / qué tiene apuntado (barrido 27-sep)", () => {
  test("«qué se ha hecho X» se reconoce como la última visita, con nombre completo o de pila", () => {
    for (const q of ["que se ha hecho Elena Prueba", "qué se ha hecho Elena", "q se ha hecho elena"]) {
      const r = asistente().responder(q);
      expect([q, r.tipo]).toEqual([q, "respuesta"]);
      if (r.tipo === "respuesta") expect([q, r.intencion]).toEqual([q, "ultima-visita-clienta"]);
    }
  });

  test("última visita: servicio, fecha y profesional de la visita más reciente, más el último color aunque sea de otra", () => {
    const r = asistente().responder("que se ha hecho Elena Prueba");
    expect(r.tipo).toBe("respuesta");
    if (r.tipo !== "respuesta") return;
    expect(r.texto).toContain("13 de agosto");
    expect(r.texto).toContain("Corte");
    expect(r.texto).toContain("Sara");
    expect(r.texto).toContain("Último color");
    expect(r.texto).toContain("Mechas finas, oxidante 20 vol");
    expect(r.acciones.some((a) => a.tipo === "abrir-ficha")).toBe(true);
  });

  test("qué tengo apuntado: observaciones una sola vez, más la nota técnica", () => {
    const r = asistente().responder("que tengo apuntado de Elena Prueba");
    expect(r.tipo).toBe("respuesta");
    if (r.tipo !== "respuesta") return;
    expect(r.texto).toContain("Usa el número 8");
    expect(r.texto).toContain("Dejar libre el contorno");
    expect(r.texto.split("Usa el número 8").length - 1).toBe(1);
  });

  test("sin observaciones ni notas técnicas: lo dice, no inventa", () => {
    const sinNada: DatosBackend = { ...datos, clientes: [{ ...clienta, notes: undefined }], citas: [citaReciente] };
    const r = crearAsistente(crearFuentesBackend(sinNada)).responder("que tengo apuntado de Elena Prueba");
    expect(r.tipo).toBe("respuesta");
    if (r.tipo === "respuesta") expect(r.texto).toContain("no tienes nada");
  });
});
