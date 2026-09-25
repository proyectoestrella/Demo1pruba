import { describe, expect, test } from "bun:test";
import { INTENCIONES, POR_ID, candidatos, enmascararEjemplo, reencaminar } from "./intenciones";
import { clasificar } from "./parecido";
import { extraerEntidades } from "./entidades";
import { FUNCIONES_POR_PLAN } from "../plan";

describe("catálogo", () => {
  test("al menos 80 intenciones de negocio y ids únicos", () => {
    expect(INTENCIONES.filter((i) => i.grupo === "negocio").length).toBeGreaterThanOrEqual(80);
    expect(POR_ID.size).toBe(INTENCIONES.length);
  });
  test("toda familia tiene al menos 3 ejemplos", () => {
    for (const i of INTENCIONES) expect([i.id, i.ejemplos.length >= 3]).toEqual([i.id, true]);
  });
  test("plan mínimo leído del documento y de la tabla compartida de planes", () => {
    expect(POR_ID.get("plan-asistente")?.planMinimo).toBe(FUNCIONES_POR_PLAN.asistente);
    expect(POR_ID.get("plan-importar-mensual")?.planMinimo).toBe(FUNCIONES_POR_PLAN["importacion-mensual"]);
    expect(POR_ID.get("no-hace-facturas")?.planMinimo).toBeNull();
  });
  test("más profesionales no depende del plan: entra en todos y no promete «Todo incluido»", () => {
    const i = POR_ID.get("plan-mas-profesionales");
    expect(i?.planMinimo).toBe("reservas");
    expect(`${i?.plan} ${i?.alternativa} ${i?.mensaje}`).not.toContain("Todo incluido");
  });
  test("los nombres de los ejemplos se enmascaran", () => {
    expect(enmascararEjemplo("cuando vino Lucía con Sara")).toBe("cuando vino zzclienta con zzpro");
  });
});

describe("reencaminado", () => {
  const ctx = {
    clientes: [{ id: "c1", name: "Lucía Pérez" }],
    equipo: [{ id: "e1", name: "Sara López" }],
    servicios: [{ id: "s1", name: "Tinte", durationMin: 60, priceEur: 40 }],
    ahora: new Date("2026-09-25T10:00:00Z"),
    timeZone: "Europe/Madrid",
  };
  const ir = (id: string, q: string) => reencaminar(id, extraerEntidades(q, ctx), "2026-09-25");
  test("fechas", () => {
    expect(ir("citas-hoy", "cuantas citas hay mañana")).toBe("citas-manana");
    expect(ir("citas-hoy", "citas del lunes")).toBe("citas-dia");
    expect(ir("citas-hoy", "citas de esta semana")).toBe("citas-periodo");
    expect(ir("citas-dia", "citas hoy")).toBe("citas-hoy");
  });
  test("profesional", () => {
    expect(ir("citas-hoy", "citas de sara hoy")).toBe("citas-hoy-profesional");
    expect(ir("ocupacion-hoy", "ocupacion de sara")).toBe("ocupacion-profesional");
  });
});

describe("sonda de la auditoría", () => {
  const casos: Array<[string, string]> = [
    ["cuantas citas tengo hoy", "citas-hoy"],
    ["hola", "saludo"],
    ["como pongo la señal", "tec-senal"],
    ["cuantas señales me faltan por cobrar", "senales-pendientes"],
    ["hay alguien en lista de espera", "lista-espera"],
    ["que servicio es el mas pedido", "servicio-mas-pedido"],
  ];
  for (const [q, id] of casos)
    test(q, () => {
      const r = clasificar(q, candidatos());
      expect(r.tipo === "acierto" ? r.id : r).toBe(id);
    });
});
