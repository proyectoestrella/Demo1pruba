import { describe, expect, test } from "bun:test";
import { AHORA_CORPUS } from "./evaluar";
import { asistentePeluChic, datosPeluChic } from "./prueba-peluchic";
import { CORREO_SOPORTE } from "./responder";

const nuevo = (plan?: "reservas" | "reservas-asistente" | "todo-incluido") => asistentePeluChic({ ahora: AHORA_CORPUS, plan }).asistente;

describe("responder", () => {
  test("cifra primero: la respuesta de negocio lleva cifras y como mucho una acción", () => {
    const r = nuevo().responder("cuantas citas tengo hoy");
    expect(r.tipo).toBe("respuesta");
    if (r.tipo !== "respuesta") return;
    expect(r.texto).toMatch(/^Hoy tienes \*\*\d+ citas?\*\*/);
    expect(r.cifras[0].unidad).toBe("citas");
    expect(r.acciones.length).toBeLessThanOrEqual(1);
  });

  test("contexto: «¿y mañana?» repite la pregunta anterior con el día nuevo", () => {
    const a = nuevo();
    a.responder("citas de Sara hoy");
    const r = a.responder("¿y mañana?");
    expect(r.tipo === "respuesta" && r.intencion).toBe("citas-hoy-profesional");
    if (r.tipo === "respuesta") expect(r.texto).toMatch(/^Sara tiene \*\*\d+ citas?\*\* mañana/);
  });

  test("datos de salud: nunca", () => {
    const r = nuevo().responder("¿Lucía García tiene alergia al tinte?");
    expect(r.tipo === "respuesta" && r.texto).toContain("datos de salud");
  });

  test("varias clientas con el mismo nombre: pregunta cuál, con un botón por cada una", () => {
    const r = nuevo().responder("color de marta");
    expect(r.tipo).toBe("elegir");
    if (r.tipo !== "elegir") return;
    expect(r.intencion).toBe("ultimo-color-clienta");
    expect(r.opciones.length).toBeGreaterThan(1);
    expect(r.opciones.every((o) => /^¿Qué color le pusimos a Marta .+\?$/.test(o.pregunta))).toBe(true);
  });

  test("una clienta que no existe: lo dice y no responde con otra", () => {
    const r = nuevo().responder("cuando vino zoraida");
    expect(r.tipo).toBe("elegir");
    if (r.tipo === "elegir") expect(r.texto).toContain("No encuentro a ninguna «Zoraida»");
  });

  test("«renta» no es la clienta Renata", () => {
    const r = nuevo().responder("servicio que mas renta");
    expect(r.tipo === "respuesta" && r.intencion).toBe("servicio-mas-rentable");
  });

  test("falta la profesional: ofrece el equipo", () => {
    const r = nuevo().responder("que es lo que mas hace");
    expect(r.tipo).toBe("elegir");
    if (r.tipo !== "elegir") return;
    expect(r.intencion).toBe("lo-que-mas-hace");
    expect(r.opciones.map((o) => o.etiqueta)).toEqual(["María", "Sara", "Noelia"]);
    expect(r.opciones[1].pregunta).toBe("¿Qué es lo que más hace Sara?");
  });

  test("fuera del dominio: sin nada del salón no adivina", () => {
    for (const q of ["¿cuánto vale el iPhone?", "dame una receta de lentejas", "cuando es la luna llena este mes"]) expect([q, nuevo().responder(q).tipo]).toEqual([q, "no-se"]);
    expect(nuevo().responder("puedo ver las citas en el iphone").tipo).toBe("respuesta");
  });

  test("no entiende: «No lo sé seguro» y tres sugerencias", () => {
    const r = nuevo().responder("receta de tortilla de patatas");
    expect(r.tipo).toBe("no-se");
    if (r.tipo === "no-se") {
      expect(r.texto).toBe("No lo sé seguro, pero quizá buscabas:");
      expect(r.sugerencias).toHaveLength(3);
    }
  });

  test("duda técnica: primero los pasos y la guía, después el contacto", () => {
    const r = nuevo().responder("como pongo la señal");
    expect(r.tipo).toBe("escalar");
    if (r.tipo !== "escalar") return;
    expect(Object.keys(r)).toEqual(["tipo", "intencion", "texto", "pasos", "guia", "contacto"]);
    expect(r.pasos.length).toBeGreaterThan(0);
    expect(r.guia).toBe("§9 Ajustes");
    expect(r.contacto.correo).toBe(CORREO_SOPORTE);
    expect(r.contacto.mensaje).toContain("PeluChic");
    expect(r.contacto.mensaje).toContain("[cuándo]");
  });

  test("fuera de plan: alternativa de hoy, guía y mensaje tipo", () => {
    const r = nuevo().responder("quiero meter a otra peluquera en el equipo");
    expect(r.tipo).toBe("escalar");
    if (r.tipo !== "escalar") return;
    expect(r.texto).toContain("Todo incluido");
    expect(r.pasos[0]).toContain("3 profesionales");
    expect(r.guia).toBe("§6 Equipo");
    expect(r.contacto.cierre).toContain("activarlo");
  });

  test("algo que no hace ningún plan: lo dice sin prometerlo", () => {
    const r = nuevo().responder("puedo hacer facturas");
    expect(r.tipo === "escalar" && r.texto).toContain("siShow no lo hace");
  });

  test("plan Reservas: las preguntas de negocio remiten a Reservas + Asistente", () => {
    const r = nuevo("reservas").responder("cuantas citas tengo hoy");
    expect(r.tipo === "escalar" && r.intencion).toBe("plan-asistente");
  });

  test("charla con carisma y el dato del día", () => {
    const r = nuevo().responder("hola");
    expect(r.tipo === "respuesta" && r.texto).toMatch(/^¡Hola! 👋 Hoy tienes \d+ citas?/);
  });

  test("toda intención de negocio tiene resolutor y responde sin romper con la demo", () => {
    const { INTENCIONES } = require("./intenciones") as typeof import("./intenciones");
    const { RESOLUTORES } = require("./resolutores") as typeof import("./resolutores");
    const d = datosPeluChic();
    const conVisitas = d.clientes.find((c) => d.citas.some((x) => x.clientId === c.id && x.status === "completed"))!;
    const { fuentes } = asistentePeluChic({ ahora: AHORA_CORPUS });
    const e = {
      fecha: null, franja: null, hora: null, numero: null,
      profesionales: [d.equipo[1]], servicios: [d.servicios[1]], clienta: { tipo: "una" as const, clienta: conVisitas },
    };
    for (const i of INTENCIONES.filter((x) => x.grupo === "negocio")) {
      const r = RESOLUTORES[i.id]({ fuentes, estado: fuentes.estado(), e, hoy: "2026-09-25", pregunta: "", clienta: conVisitas });
      expect([i.id, typeof r.texto === "string" && r.texto.length > 5, r.acciones.length <= 1]).toEqual([i.id, true, true]);
    }
  });
});
