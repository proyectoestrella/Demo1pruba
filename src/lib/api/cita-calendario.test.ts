import { describe, expect, it } from "bun:test";
import { accionCalendarioDe, citaParaCalendarioDeFila, parcheAfectaCalendario } from "./cita-calendario";

const FILA = {
  id: "5b0c6f0e-0000-4000-8000-000000000001",
  local_id: "a-new-123",
  salon_slug: "pruebas-sishow",
  client_name: "Lucía",
  service_id: "corte,peinado",
  employee_id: "maria",
  start_at: "2026-09-28T08:00:00+00:00",
  duration_min: 45,
  status: "confirmed",
  note: "Trae foto",
  price_eur: 25,
  paid_at: null,
};

describe("parcheAfectaCalendario", () => {
  it("hora, duración, profesional, estado, servicio, nota o nombre: sí", () => {
    for (const c of ["start_at", "duration_min", "employee_id", "status", "service_id", "note", "client_name"]) {
      expect(parcheAfectaCalendario({ [c]: "x" })).toBe(true);
    }
  });
  it("cobro, señal o precio: no (no se molesta a Google por eso)", () => {
    expect(parcheAfectaCalendario({ paid_at: "2026-09-28T09:00:00Z", payment_method: "bizum" })).toBe(false);
    expect(parcheAfectaCalendario({ deposit_received_at: "x", price_eur: 30 })).toBe(false);
    expect(parcheAfectaCalendario({})).toBe(false);
  });
});

describe("citaParaCalendarioDeFila", () => {
  it("construye la cita igual que syncAppointment (clave = local_id, servicios con « + »)", () => {
    expect(citaParaCalendarioDeFila(FILA)).toEqual({
      id: "a-new-123",
      clientName: "Lucía",
      service: "corte + peinado",
      employeeId: "maria",
      start: "2026-09-28T08:00:00.000Z",
      duration: 45,
      status: "confirmed",
      note: "Trae foto",
    });
  });

  it("sin nombre ni servicio usa los mismos comodines", () => {
    const c = citaParaCalendarioDeFila({ ...FILA, client_name: null, service_id: "", note: null });
    expect(c?.clientName).toBe("Cliente");
    expect(c?.service).toBe("Cita");
    expect(c?.note).toBeNull();
  });

  it("sin local_id, profesional, hora o duración válidas: null", () => {
    expect(citaParaCalendarioDeFila({ ...FILA, local_id: null })).toBeNull();
    expect(citaParaCalendarioDeFila({ ...FILA, employee_id: "" })).toBeNull();
    expect(citaParaCalendarioDeFila({ ...FILA, start_at: "mañana" })).toBeNull();
    expect(citaParaCalendarioDeFila({ ...FILA, duration_min: 0 })).toBeNull();
  });

  it("cancelada borra; cualquier otro estado crea o actualiza", () => {
    expect(accionCalendarioDe(citaParaCalendarioDeFila({ ...FILA, status: "cancelled" })!)).toBe("borrar");
    for (const status of ["pending", "confirmed", "completed", "late", "no-show"]) {
      expect(accionCalendarioDe(citaParaCalendarioDeFila({ ...FILA, status })!)).toBe("upsert");
    }
  });
});

/**
 * Como en salons.functions.guardia.test.ts: una función de servidor no se
 * puede llamar sin levantar el servidor entero, así que se comprueba en el
 * fuente que los dos caminos del panel avisan a los calendarios.
 */
describe("los caminos del panel llevan el cambio a los calendarios externos", async () => {
  const FUENTE = await Bun.file(new URL("./salons.functions.ts", import.meta.url)).text();
  const cuerpo = (nombre: string) => {
    const i = FUENTE.indexOf(`export const ${nombre} = createServerFn`);
    expect(i).toBeGreaterThan(-1);
    const j = FUENTE.indexOf("export const ", i + 10);
    return FUENTE.slice(i, j === -1 ? undefined : j);
  };

  it("syncAppointment (cita nueva y reserva pública)", () => {
    expect(cuerpo("syncAppointment")).toContain("procesarCitaParaConexiones(");
  });
  it("syncAppointmentPatch (confirmar, mover, cancelar)", () => {
    const c = cuerpo("syncAppointmentPatch");
    expect(c).toContain("parcheAfectaCalendario(columnas)");
    expect(c).toContain("procesarCitaParaConexiones(data.slug, cita, accionCalendarioDe(cita))");
  });
  it("deleteAppointment (eliminar)", () => {
    expect(cuerpo("deleteAppointment")).toContain('procesarCitaParaConexiones(data.slug, cita, "borrar")');
  });
});
