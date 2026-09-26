/**
 * Barrido de robustez de los resolutores del asistente (barrido de calidad
 * 2026-09-26): que ninguno reviente ni devuelva un dato roto (NaN, fecha
 * inválida, "undefined" en el texto) en dos situaciones que el corpus normal
 * no cubre:
 *
 *  - Salón recién dado de alta: equipo y carta reales, pero CERO citas y CERO
 *    clientas — el estado el primer día, antes de la primera reserva.
 *  - Demo PeluChic (~3.300 citas) con ids huérfanos: una cita apunta a un
 *    servicio, una profesional o una clienta que ya no existen en las listas
 *    activas (se borraron después de crear la cita), más un servicio libre
 *    (`libre:<nombre>`, "Otro…" en Nueva cita).
 *
 * Se llama a cada resolutor DIRECTAMENTE (no a través de `asistente.responder`,
 * que atrapa cualquier excepción y la convierte en un mensaje genérico —
 * bueno para el panel, malo para encontrar el fallo real).
 */
import { describe, expect, test } from "bun:test";
import { crearFuentesBackend, type DatosBackend } from "./fuentes-backend";
import { employeesForType, servicesForType } from "../mock/salon";
import { PREFIJO_LIBRE } from "../appointment-services";
import type { Appointment, Client, SalonProfile } from "../mock/types";
import { datosPeluChic } from "./prueba-peluchic";
import { AHORA_CORPUS } from "./evaluar";
import { RESOLUTORES } from "./resolutores";
import { INTENCIONES } from "./intenciones";
import type { Contexto, Respuesta } from "./resolutores/tipos";
import type { ClientaA } from "./fuentes";
import { diaEnZona } from "./reloj";

const REQUIERE = new Map(INTENCIONES.map((i) => [i.id, i.requiere]));

const HORARIO = ["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "9:00–14:00", "Cerrado"];
const EQUIPO = ["María~Estilista", "Sara~Colorista"];
const CARTA = ["Corte y peinado~45~25~Peluquería", "Tinte~40~35~Peluquería"];

function contextoDe(datos: DatosBackend, opciones: { profesionalId?: string; servicioId?: string; clienta?: ClientaA } = {}) {
  const fuentes = crearFuentesBackend(datos);
  const estado = fuentes.estado();
  const hoy = diaEnZona(estado.ahora, estado.timeZone);
  const equipo = opciones.profesionalId ? estado.equipo.filter((p) => p.id === opciones.profesionalId) : [];
  const servicios = opciones.servicioId ? estado.servicios.filter((s) => s.id === opciones.servicioId) : [];
  const base: Contexto = {
    fuentes,
    estado,
    hoy,
    pregunta: "",
    e: { fecha: null, franja: null, hora: null, numero: null, profesionales: equipo, servicios, clienta: null },
    clienta: opciones.clienta,
  };
  return base;
}

/** Nada de "NaN", "undefined" ni fecha rota colada en el texto o en una cifra. */
function comprobarLimpia(id: string, r: Respuesta) {
  expect([id, typeof r.texto]).toEqual([id, "string"]);
  expect([id, r.texto]).toEqual([id, expect.not.stringContaining("NaN") as unknown as string]);
  expect([id, r.texto]).toEqual([id, expect.not.stringContaining("undefined") as unknown as string]);
  expect([id, r.texto]).toEqual([id, expect.not.stringContaining("Invalid Date") as unknown as string]);
  expect([id, r.texto]).toEqual([id, expect.not.stringContaining("[object Object]") as unknown as string]);
  for (const c of r.cifras) {
    expect([id, c.etiqueta, c.valor]).toEqual([id, c.etiqueta, expect.any(Number) as unknown as number]);
    expect([id, c.etiqueta, Number.isFinite(c.valor)]).toEqual([id, c.etiqueta, true]);
  }
}

describe("resolutores del asistente sobre un salón recién dado de alta (0 citas, 0 clientas)", () => {
  const equipo = employeesForType("peluqueria", EQUIPO, undefined, HORARIO);
  const servicios = servicesForType("peluqueria", CARTA);
  const perfil: SalonProfile = {
    id: "nuevo", slug: "nuevo", name: "Salón Nuevo", tagline: "", about: "", address: "",
    phone: "", instagram: "", openingHours: HORARIO, rating: 0, reviewCount: 0, specialties: [],
  };
  const datos: DatosBackend = { citas: [], clientes: [], equipo, servicios, listaEspera: [], perfil, ahora: AHORA_CORPUS };

  for (const [id] of Object.entries(RESOLUTORES)) {
    const requiere = REQUIERE.get(id) ?? [];
    // "clienta" es estructuralmente inalcanzable con 0 clientas: el asistente
    // pregunta "¿de qué clienta?" antes de llegar aquí (responder.ts). No es
    // un resolutor que un salón vacío pueda invocar de verdad.
    if (requiere.includes("clienta")) continue;
    test(`«${id}» no revienta ni ensucia el texto`, () => {
      const ctx = contextoDe(datos, {
        profesionalId: requiere.includes("profesional") ? equipo[0].id : undefined,
        servicioId: requiere.includes("servicio") ? servicios[0].id : undefined,
      });
      let r: Respuesta;
      expect(() => { r = RESOLUTORES[id](ctx); }).not.toThrow();
      comprobarLimpia(id, r!);
    });
  }
});

describe("resolutores del asistente con ids huérfanos en la demo PeluChic", () => {
  const d = datosPeluChic();
  const servicioBorradoId = d.servicios[0].id;
  const profesionalBorradoId = d.equipo[0].id;
  const clientaBorrada = d.clientes.find((c) => d.citas.some((a) => a.clientId === c.id && a.status === "completed"))!;

  const citaServicioBorrado: Appointment = {
    id: "a-huerfano-servicio", clientId: d.clientes[1].id, clientName: d.clientes[1].name,
    serviceIds: [servicioBorradoId], employeeId: d.equipo[1].id, start: "2026-09-25T09:00:00.000Z",
    duration: 30, priceEur: 20, status: "completed",
  };
  const citaProfesionalBorrado: Appointment = {
    id: "a-huerfano-profesional", clientId: d.clientes[2].id, clientName: d.clientes[2].name,
    serviceIds: [d.servicios[1].id], employeeId: profesionalBorradoId, start: "2026-09-24T09:00:00.000Z",
    duration: 30, priceEur: 20, status: "completed",
  };
  const citaClientaBorrada: Appointment = {
    id: "a-huerfano-clienta", clientId: clientaBorrada.id, clientName: clientaBorrada.name,
    serviceIds: [d.servicios[1].id], employeeId: d.equipo[1].id, start: "2026-09-23T09:00:00.000Z",
    duration: 30, priceEur: 20, status: "completed",
  };
  const citaServicioLibre: Appointment = {
    id: "a-servicio-libre", clientId: d.clientes[3].id, clientName: d.clientes[3].name,
    serviceIds: [`${PREFIJO_LIBRE}Peinado a mano`], employeeId: d.equipo[1].id, start: "2026-09-22T09:00:00.000Z",
    duration: 30, priceEur: 15, status: "completed",
  };

  const citas = [...d.citas, citaServicioBorrado, citaProfesionalBorrado, citaClientaBorrada, citaServicioLibre];
  // El equipo y la carta sin la profesional/el servicio que ahora faltan: la
  // cita antigua se queda huérfana, tal como pasaría en un salón real al
  // borrar a alguien del equipo o retirar un servicio de la carta.
  const equipo = d.equipo.filter((e) => e.id !== profesionalBorradoId);
  const servicios = d.servicios.filter((s) => s.id !== servicioBorradoId);
  const clientes: Client[] = d.clientes.filter((c) => c.id !== clientaBorrada.id);
  const datos: DatosBackend = { citas, clientes, equipo, servicios, listaEspera: d.listaEspera, perfil: d.perfil, ahora: AHORA_CORPUS };

  for (const [id] of Object.entries(RESOLUTORES)) {
    const requiere = REQUIERE.get(id) ?? [];
    if (requiere.includes("clienta") || requiere.includes("profesional") || requiere.includes("servicio")) continue;
    test(`«${id}» no revienta con ids huérfanos en la agenda`, () => {
      const ctx = contextoDe(datos);
      let r: Respuesta;
      expect(() => { r = RESOLUTORES[id](ctx); }).not.toThrow();
      comprobarLimpia(id, r!);
    });
  }

  test("ficha de la clienta borrada: no revienta al pedir su ficha aunque ya no esté en la lista", () => {
    const fuentes = crearFuentesBackend(datos);
    expect(() => fuentes.fichaClienta(clientaBorrada.id)).not.toThrow();
    expect(fuentes.fichaClienta(clientaBorrada.id)).toBeNull();
  });
});
