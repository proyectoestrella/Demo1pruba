import { describe, expect, it } from "bun:test";
import type { Campana } from "../campanas";
import type { Appointment, Client, WaitlistEntry } from "../mock/types";
import type { Acceso } from "./autorizacion";
import { recortarDatosPanelPorPlan } from "./recorte";

/**
 * Núcleo puro de `listSalonData`: el handler lee Supabase y llama a esta
 * función justo antes de responder. Aquí se simula esa lectura, no se mira el
 * texto de la fuente, para probar la misma respuesta que recibiría una
 * llamada directa a la función de servidor.
 */
const gerente: Acceso = {
  tipo: "miembro",
  userId: "u-gerente",
  rol: "gerente",
  employeeId: null,
  displayName: "Tomás",
  permisosExtra: {},
};

const cita = (id: string, start: string): Appointment =>
  ({
    id,
    employeeId: "mario",
    clientId: `c-${id}`,
    clientName: `Clienta ${id}`,
    serviceIds: ["corte"],
    start,
    duration: 30,
    priceEur: 20,
    status: "confirmed",
  }) as Appointment;

const datos = {
  appointments: [
    cita("historial-oculto", "2026-08-15T10:00:00.000Z"),
    // Sigue siendo elegible para la reseña al cruzar el cambio de mes.
    cita("ayer", "2026-09-30T15:00:00.000Z"),
    cita("mes-actual", "2026-10-01T10:00:00.000Z"),
    cita("agenda-futura", "2026-11-15T10:00:00.000Z"),
  ],
  clients: [{ id: "ficha-operativa", name: "Ficha operativa", phone: "600000000" }] as Client[],
  waitlist: [{ id: "w-1", clientName: "Alicia" }] as WaitlistEntry[],
};

function campana(id: string, nombre: string): Campana {
  return {
    id,
    titulo: id,
    resumenAQuien: "Prueba",
    cifra: 1,
    cifraLabel: "persona",
    personas: [{ clientId: `c-${id}`, nombre, telefono: "699000000", detalle: "dato sensible" }],
    mensaje: "Mensaje preparado",
    coste: "Incluido",
  };
}

const campanas = [
  campana("resena", "Reseña permitida"),
  campana("no-vuelven", "Destinataria de campaña ampliada"),
  campana("huecos-flojos", "Patrón de horas flojas"),
];
const ahora = new Date("2026-10-01T14:00:00.000Z");

describe("respuesta de listSalonData recortada por plan", () => {
  it("Básico no entrega histórico de analítica ni listas de campañas ampliadas", () => {
    const respuesta = recortarDatosPanelPorPlan(
      gerente,
      { plan: "reservas", timeZone: "Europe/Madrid" },
      datos,
      campanas,
      ahora,
    );

    expect(respuesta.appointments.map((c) => c.id)).toEqual([
      "ayer",
      "mes-actual",
      "agenda-futura",
    ]);
    expect(respuesta.campanas?.map((c) => c.id)).toEqual(["resena"]);
    expect(respuesta.funcionesPlan).toEqual({ "analitica-avanzada": false, asistente: false });
    expect(JSON.stringify(respuesta)).not.toContain("historial-oculto");
    expect(JSON.stringify(respuesta)).not.toContain("Destinataria de campaña ampliada");
    expect(JSON.stringify(respuesta)).not.toContain("Patrón de horas flojas");
  });

  it("Estándar conserva el histórico para analítica avanzada, pero no recibe campañas ampliadas", () => {
    const respuesta = recortarDatosPanelPorPlan(
      gerente,
      { plan: "reservas-asistente", timeZone: "Europe/Madrid" },
      datos,
      campanas,
      ahora,
    );

    expect(respuesta.appointments).toEqual(datos.appointments);
    expect(respuesta.campanas?.map((c) => c.id)).toEqual(["resena"]);
    expect(respuesta.funcionesPlan).toEqual({ "analitica-avanzada": true, asistente: true });
    expect(JSON.stringify(respuesta)).not.toContain("Destinataria de campaña ampliada");
  });

  it("Embajador recibe la analítica completa y todas las campañas", () => {
    const respuesta = recortarDatosPanelPorPlan(
      gerente,
      { plan: "todo-incluido", timeZone: "Europe/Madrid" },
      datos,
      campanas,
      ahora,
    );

    expect(respuesta.appointments).toEqual(datos.appointments);
    expect(respuesta.campanas).toEqual(campanas);
    expect(respuesta.funcionesPlan).toEqual({ "analitica-avanzada": true, asistente: true });
  });

  it("una demo conserva todos los datos aunque su perfil diga Básico", () => {
    const respuesta = recortarDatosPanelPorPlan(
      { tipo: "demo" },
      { plan: "reservas", timeZone: "Europe/Madrid" },
      datos,
      campanas,
      ahora,
    );

    expect(respuesta.appointments).toEqual(datos.appointments);
    expect(respuesta.campanas).toEqual(campanas);
    expect(respuesta.funcionesPlan).toEqual({ "analitica-avanzada": true, asistente: true });
  });
});
