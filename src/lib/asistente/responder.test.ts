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

  test("plan cerca de negocio: responde la de negocio y avisa de la de plan", () => {
    const r = nuevo().responder("puedo descargarme el resumen del mes?");
    expect(r.tipo).toBe("respuesta");
    if (r.tipo !== "respuesta") return;
    expect(r.intencion).toBe("resumen-mes");
    expect(r.tambien?.intencion).toBe("plan-informe-mensual");
    expect(r.texto).toContain("Si te referías a recibir el informe del mes por correo, eso llega con el plan **Todo incluido**");
    // Con Todo incluido tampoco: esa función está «por confirmar».
    const n = nuevo().responder("cuantas citas tengo hoy");
    expect(n.tipo === "respuesta" && n.tambien).toBeFalsy();
  });

  test("7c: fallos que encontró FRONTEND en el panel", () => {
    const a = nuevo().responder("qien no ha venido desde hace 2 meses");
    expect(a.tipo === "respuesta" && a.intencion).toBe("clientas-inactivas");
    const b = nuevo().responder("quiero mandar sms a todas mis clientas");
    expect(b.tipo === "escalar" && b.intencion).toBe("no-campanas-automaticas");
    const c = nuevo().responder("cuánto he facturado este mes");
    expect(c.tipo === "respuesta" && c.texto).toContain("de citas ya hechas");
    expect(c.tipo === "respuesta" && c.texto).toContain("de las que faltan");
  });

  test("7c: dos intenciones vecinas en la misma pregunta → pregunta cuál", () => {
    const r = nuevo().responder("que le queda a noelia hoy y cual es la siguiente?");
    expect(r.tipo === "respuesta" ? r.intencion : r.tipo).not.toBe("lista-citas-hoy");
    const s = nuevo().responder("a quien se le paso el plazo de la señal");
    expect(s.tipo === "respuesta" && s.intencion).toBe("senales-vencidas");
    const t = nuevo().responder("cual es el plazo para la señal");
    expect(t.tipo === "respuesta" && t.intencion).toBe("regla-senal");
  });

  test("7c: vocabulario coloquial del salón y cálculos sueltos", () => {
    expect(nuevo().responder("¿quién está ahora en cabina?").tipo).toBe("respuesta");
    expect(nuevo().responder("no se ni que preguntarte").tipo === "respuesta").toBe(true);
    for (const q of ["cuanto cuesta un iphone 17 ahora?", "sabes algo de la renta de este año?", "cuanto es 15% de 340?"]) {
      const r = nuevo().responder(q);
      expect([q, r.tipo === "respuesta" && ["negocio", "plan", "tecnica"].includes(require("./intenciones").POR_ID.get(r.intencion)?.grupo) && require("./intenciones").POR_ID.get(r.intencion)?.categoria !== "ayuda"]).toEqual([q, false]);
    }
  });

  test("7e: comparar periodos da las mismas cifras que Analítica", () => {
    const { resumenDePeriodo, comparar } = require("../periodos") as typeof import("../periodos");
    const d = datosPeluChic();
    for (const [q, tipo] of [["cuántas tengo esta semana comparado con la anterior", "semana"], ["como va el mes comparado con el pasado", "mes"]] as const) {
      const a = asistentePeluChic({ ahora: AHORA_CORPUS }).asistente;
      let r = a.responder(q);
      if (r.tipo === "elegir") r = a.responder(r.opciones.find((o) => /compar/i.test(o.etiqueta))!.pregunta);
      expect(r.tipo === "respuesta" && r.intencion).toBe("comparar-periodos");
      if (r.tipo !== "respuesta") continue;
      const ana = resumenDePeriodo(d.citas, tipo, d.equipo, AHORA_CORPUS);
      expect(r.cifras.find((x) => x.etiqueta === "citas")?.valor).toBe(ana.actual.citas);
      expect(r.cifras.find((x) => x.etiqueta === "citas antes")?.valor).toBe(ana.previo.citas);
      expect(r.cifras.find((x) => x.etiqueta === "variación")?.valor).toBe(comparar(ana.actual.citas, ana.previo.citas).variacionPct!);
      expect(r.texto).toContain(`${ana.actual.ocupacion} %`);
    }
  });

  test("7e: reservas por confirmar y libras a kilos", () => {
    const r = nuevo().responder("reservas nuevas esperando que las confirme");
    expect(r.tipo === "respuesta" && r.intencion).toBe("solicitudes-pendientes");
    expect(nuevo().responder("como convierto libras a kilos").tipo).toBe("no-se");
    const l = nuevo().responder("Sara cuando libra un rato la semana que viene?");
    expect(l.tipo === "respuesta" && l.intencion).toBe("hueco-profesional");
  });

  test("7e-27: solicitudes con la hora pasada cuentan igual que en la tarjeta de Hoy", () => {
    const d = datosPeluChic();
    const pend = d.citas.filter((x) => x.status === "pending");
    // Tarde: todas las solicitudes de la demo ya han pasado su hora.
    const tarde = new Date(Math.max(...pend.map((x) => Date.parse(x.start))) + 3_600_000);
    const a = asistentePeluChic({ ahora: tarde }).asistente;
    const r = a.responder("reservas nuevas esperando que las confirme");
    expect(r.tipo === "respuesta" && r.intencion).toBe("solicitudes-pendientes");
    if (r.tipo !== "respuesta") return;
    expect(r.cifras[0].valor).toBe(pend.length);
    expect(r.texto).toContain("ya han pasado su hora: cámbiales la fecha o recházalas");
    expect(r.acciones[0].etiqueta).toBe("Ver solicitudes");
    // Mezcla: justo después de la primera.
    const medio = new Date(Date.parse(pend.map((x) => x.start).sort()[0]) + 60_000);
    const m = asistentePeluChic({ ahora: medio }).asistente.responder("que solicitudes tengo por confirmar");
    if (m.tipo === "respuesta" && pend.length > 1) expect(m.texto).toMatch(new RegExp(`^Tienes \\*\\*${pend.length} por confirmar\\*\\*, \\d+ con la hora ya pasada`));
    const p = asistentePeluChic({ ahora: tarde }).asistente.responder("que tengo pendiente");
    expect(p.tipo === "respuesta" && p.texto).toContain(`${pend.length} solicitudes por confirmar (todas con la hora ya pasada)`);
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
