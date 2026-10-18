/** B6: ningún id que acaba en un filtro PostgREST se interpola como sintaxis. */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "@/lib/api/doble-supabase";
import { mockTransitorio } from "@/lib/api/doble-start";

let doble = crearDobleSupabase({});
const dbMock = await mockTransitorio("@/lib/supabase.server", { getSupabaseServerClient: () => doble as never });
beforeAll(() => dbMock.activar());
afterAll(() => dbMock.desactivar());
const { hayOcupadoExternoEnHueco, procesarCitaParaConexiones } = await import("./calendario-externo.server");

describe("B6: filtros de calendario externo", () => {
  it("no usa .or() con el employeeId que llega de una reserva", async () => {
    doble = crearDobleSupabase({ calendario_bloqueos_externos: [] });
    await hayOcupadoExternoEnHueco("salon", "e1,employee_id.is.null", "2026-10-18T10:00:00Z", "2026-10-18T11:00:00Z");
    const consultas = doble.consultas.filter((c) => c.tabla === "calendario_bloqueos_externos");
    expect(consultas).not.toHaveLength(0);
    expect(consultas.every((c) => !c.or?.length)).toBe(true);
  });

  it("tampoco interpola la profesional al elegir conexiones salientes", async () => {
    doble = crearDobleSupabase({ calendario_conexiones: [] });
    await procesarCitaParaConexiones("salon", {
      id: "cita", clientName: "Ana", service: "Corte", employeeId: "e1,estado.eq.activa",
      start: "2026-10-18T10:00:00Z", duration: 30, status: "confirmed",
    }, "upsert");
    const consultas = doble.consultas.filter((c) => c.tabla === "calendario_conexiones");
    expect(consultas).not.toHaveLength(0);
    expect(consultas.every((c) => !c.or?.length)).toBe(true);
  });
});
