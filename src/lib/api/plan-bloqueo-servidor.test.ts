/**
 * Contrato de borde del plan: se ejecuta la función de servidor real con el
 * doble de Supabase. No prueba el texto de la implementación ni una función
 * pura: simula a una gerente que llama `listSalonData` directamente.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase, tokenConSesion } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";

type FuncionProtegida = "analitica-avanzada" | "asistente";
type RespuestaPanel = {
  appointments: Array<{ id: string; clientName: string }>;
  clients: Array<{ id: string; name: string }>;
  waitlist: unknown[];
  funcionesPlan?: Record<FuncionProtegida, boolean>;
};

let cabecera: string | null = null;
let sinSupabase = false;
let doble = crearDobleSupabase({});
const supabase = await mockTransitorio("../supabase.server", {
  getSupabaseServerClient: () => (sinSupabase ? null : doble) as never,
});
const request = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: ((nombre: string) => (nombre.toLowerCase() === "authorization" ? (cabecera ?? undefined) : undefined)) as never,
  getRequestUrl: (() => new URL("https://sishow.test/app")) as never,
});
beforeAll(() => { supabase.activar(); request.activar(); });
afterAll(() => { supabase.desactivar(); request.desactivar(); });
instalarDobleStart();
const S = await import("./salons.functions?plan-bloqueo");

const cita = (id: string, fecha: string, nombre: string) => ({
  id: `fila-${id}`,
  local_id: id,
  salon_slug: "real",
  client_id: `clienta-${id}`,
  client_name: nombre,
  service_id: "corte",
  employee_id: "ana",
  start_at: fecha,
  duration_min: 30,
  price_eur: 20,
  status: "confirmed",
  client_confirmed_at: null,
  note: null,
});

function cargarSalon(plan: unknown = "reservas") {
  doble = crearDobleSupabase(
    {
      salons: [{ slug: "real", profile: { name: "PeluChic", plan, phone: "600000000" } }],
      salon_members: [{ user_id: "ana", salon_slug: "real", rol: "gerente", estado: "activa" }],
      appointments: [
        cita("historial-largo", "2001-01-01T10:00:00.000Z", "Clienta de histórico"),
        cita("agenda-futura", "2099-01-01T10:00:00.000Z", "Clienta futura"),
      ],
      clients: [
        {
          id: "clienta-historial-largo",
          salon_slug: "real",
          name: "Ficha operativa",
          phone: "600000000",
          email: null,
          notes: "No se recorta por plan",
          penalty_eur: null,
          penalty_note: null,
          created_at: "2001-01-01T10:00:00.000Z",
        },
      ],
      waitlist: [],
    },
    { tokens: { "tk-ana": "ana" } },
  );
}

async function cargarPanel(): Promise<RespuestaPanel> {
  return llamar<RespuestaPanel>(S.listSalonData, { slug: "real", vista: "panel" });
}

beforeEach(() => {
  cabecera = `Bearer ${tokenConSesion("tk-ana")}`;
  sinSupabase = false;
  cargarSalon();
});

describe("bloqueo de analítica avanzada y asistente en el servidor", () => {
  it("Básico no recibe el histórico de analítica ni la activación del asistente, aunque llame a la función", async () => {
    const respuesta = await cargarPanel();

    expect(respuesta.appointments.map((cita) => cita.id)).toEqual(["agenda-futura"]);
    expect(JSON.stringify(respuesta)).not.toContain("Clienta de histórico");
    // Las fichas operativas siguen intactas: no son una función de pago.
    expect(respuesta.clients.map((clienta) => clienta.name)).toEqual(["Ficha operativa"]);
    expect(respuesta.funcionesPlan).toEqual({ "analitica-avanzada": false, asistente: false });
  });

  for (const plan of ["reservas-asistente", "todo-incluido"] as const) {
    it(`${plan} recibe el histórico y tiene activadas ambas funciones`, async () => {
      cargarSalon(plan);

      const respuesta = await cargarPanel();

      expect(respuesta.appointments.map((cita) => cita.id).sort()).toEqual(["agenda-futura", "historial-largo"]);
      expect(JSON.stringify(respuesta)).toContain("Clienta de histórico");
      expect(respuesta.funcionesPlan).toEqual({ "analitica-avanzada": true, asistente: true });
    });
  }

  it("un plan desconocido falla cerrado como Básico", async () => {
    cargarSalon("un-plan-inventado");

    const respuesta = await cargarPanel();

    expect(respuesta.appointments.map((cita) => cita.id)).toEqual(["agenda-futura"]);
    expect(respuesta.funcionesPlan).toEqual({ "analitica-avanzada": false, asistente: false });
  });

  it("si falla la lectura del perfil que contiene el plan, no entrega datos protegidos", async () => {
    // La primera lectura de `salons` identifica a la gerente; la segunda es
    // la lectura del perfil que el propio handler hace antes de responder.
    doble = crearDobleSupabase(
      {
        salons: [{ slug: "real", profile: { name: "PeluChic", plan: "reservas-asistente" } }],
        salon_members: [{ user_id: "ana", salon_slug: "real", rol: "gerente", estado: "activa" }],
        appointments: [cita("historial-largo", "2001-01-01T10:00:00.000Z", "Clienta de histórico")],
        clients: [],
        waitlist: [],
      },
      { errorDespuesDe: { salons: { lectura: 2, mensaje: "timeout" } }, tokens: { "tk-ana": "ana" } },
    );

    await expect(cargarPanel()).rejects.toThrow("No se ha podido comprobar el plan");
  });

  it("una demo explícita sin Supabase conserva las dos funciones; sus datos siguen siendo locales", async () => {
    sinSupabase = true;

    const respuesta = await llamar<RespuestaPanel>(S.listSalonData, { slug: "peluchic", vista: "panel" });

    expect(respuesta).toMatchObject({
      appointments: [],
      clients: [],
      waitlist: [],
      funcionesPlan: { "analitica-avanzada": true, asistente: true },
    });
  });
});
