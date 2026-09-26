import { describe, expect, test } from "bun:test";
import { avisoVueltaGoogle, filasCalendario, pareceContrasenaDeApp, type ConexionCalendario } from "./calendarios-panel";
import { permisosDe } from "./permisos";

const equipo = [
  { id: "maria", name: "María" },
  { id: "noelia", name: "Noelia" },
];
const conexion = (id: string, employeeId: string | null, estado: ConexionCalendario["estado"] = "activa"): ConexionCalendario => ({
  id, proveedor: "google", employeeId, estado, cuenta: "x@gmail.com", ultimoError: null, ultimoErrorEn: null, creada: "", actualizada: "",
});

describe("Ajustes › Calendarios (lote 14c)", () => {
  test("la gerente: el del salón y uno por profesional", () => {
    const f = filasCalendario(permisosDe("gerente"), null, equipo, [conexion("a", null), conexion("b", "noelia")]);
    expect(f.map((x) => `${x.titulo}:${x.conexiones.length}`)).toEqual(["Calendario del salón:1", "María:0", "Noelia:1"]);
  });
  test("la estilista: solo el suyo", () => {
    const f = filasCalendario(permisosDe("estilista"), "noelia", equipo, [conexion("a", null), conexion("b", "noelia")]);
    expect(f.map((x) => `${x.titulo}:${x.employeeId}:${x.conexiones.length}`)).toEqual(["Tu calendario:noelia:1"]);
  });
  test("recepción no ve la sección", () => {
    expect(filasCalendario(permisosDe("recepcion"), null, equipo, [])).toEqual([]);
  });
  test("las desconectadas no cuentan", () => {
    expect(filasCalendario(permisosDe("gerente"), null, equipo, [conexion("a", null, "desconectada")])[0].conexiones).toEqual([]);
  });
  test("contraseña de aplicación de Apple", () => {
    expect(pareceContrasenaDeApp("abcd-efgh-ijkl-mnop")).toBe(true);
    expect(pareceContrasenaDeApp("abcdefghijklmnop")).toBe(true);
    expect(pareceContrasenaDeApp("MiClave123")).toBe(false);
  });
  test("aviso al volver de Google", () => {
    expect(avisoVueltaGoogle({ calendario: "ok" })?.ok).toBe(true);
    expect(avisoVueltaGoogle({ calendario: "error", motivo: "acceso_denegado" })?.texto).toContain("acceso_denegado");
    expect(avisoVueltaGoogle({})).toBeNull();
  });
});

import { bloquesDeOcupado, esBloqueExterno } from "./calendarios-panel";

describe("lo ocupado fuera, en el calendario del panel (14c)", () => {
  test("un bloque por hueco y profesional, sin título ni clienta", () => {
    const b = bloquesDeOcupado([{ employeeId: "noelia", inicio: "2026-09-26T10:00:00Z", fin: "2026-09-26T11:30:00Z", proveedor: "google" }], ["maria", "noelia"]);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ employeeId: "noelia", duration: 90, status: "blocked", note: "Ocupado (Google)", clientName: "" });
    expect(esBloqueExterno(b[0])).toBe(true);
  });
  test("lo del calendario del salón bloquea a todo el equipo", () => {
    const b = bloquesDeOcupado([{ employeeId: null, inicio: "2026-09-26T10:00:00Z", fin: "2026-09-26T10:30:00Z", proveedor: "apple" }], ["maria", "noelia"]);
    expect(b.map((x) => `${x.employeeId}:${x.note}`)).toEqual(["maria:Ocupado (Apple)", "noelia:Ocupado (Apple)"]);
  });
});
