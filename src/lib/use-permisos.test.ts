import { describe, expect, test } from "bun:test";
import { filtrarCitas, paginaDeRuta, veRuta } from "./use-permisos";
import { permisosDe } from "./permisos";
import type { Appointment } from "./mock/types";

const RUTAS_MENU = ["/app", "/app/calendar", "/app/appointments", "/app/waitlist", "/app/clients", "/app/hoja", "/app/employees", "/app/services", "/app/web", "/app/settings", "/app/insights", "/app/marketing"];
const ve = (rol: Parameters<typeof permisosDe>[0]) => RUTAS_MENU.filter((r) => veRuta(permisosDe(rol), r));

describe("gating de rutas por rol (lote 11)", () => {
  test("cada ruta del panel tiene su página", () => {
    for (const r of RUTAS_MENU) expect(paginaDeRuta(r)).not.toBeNull();
    expect(paginaDeRuta("/app/calendar?dia=2026-09-29")).toBe("calendario");
  });
  test("la gerente lo ve todo", () => {
    expect(ve("gerente")).toEqual(RUTAS_MENU);
  });
  test("la estilista: Hoy, Calendario, Citas, Clientas y Hoja; nada del salón", () => {
    expect(ve("estilista")).toEqual(["/app", "/app/calendar", "/app/appointments", "/app/clients", "/app/hoja"]);
  });
  test("recepción: agenda, clientas, lista de espera y servicios; sin dinero ni ajustes", () => {
    expect(ve("recepcion")).toEqual(["/app", "/app/calendar", "/app/appointments", "/app/waitlist", "/app/clients", "/app/hoja", "/app/services"]);
  });
  test("la subencargada ve todas las pantallas del menú", () => {
    expect(ve("subencargado")).toEqual(RUTAS_MENU);
  });
  test("/app/demos es interna y no pasa por la matriz", () => {
    expect(veRuta(permisosDe("estilista"), "/app/demos")).toBe(true);
  });
});

describe("citas que se pintan", () => {
  const cita = (id: string, employeeId: string) => ({ id, employeeId }) as Appointment;
  const citas = [cita("1", "noelia"), cita("2", "sara"), cita("3", "noelia")];
  test("la estilista ve solo las suyas", () => {
    expect(filtrarCitas(citas, permisosDe("estilista"), "noelia").map((c) => c.id)).toEqual(["1", "3"]);
  });
  test("una estilista sin profesional vinculada no ve ninguna", () => {
    expect(filtrarCitas(citas, permisosDe("estilista"), null)).toEqual([]);
  });
  test("recepción y gerente ven todas", () => {
    expect(filtrarCitas(citas, permisosDe("recepcion"), null)).toHaveLength(3);
    expect(filtrarCitas(citas, permisosDe("gerente"), "noelia")).toHaveLength(3);
  });
});
