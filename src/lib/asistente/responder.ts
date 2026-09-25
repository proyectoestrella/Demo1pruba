/**
 * El asistente: pregunta → respuesta. Sin IA: normaliza, extrae entidades,
 * clasifica por parecido contra el catálogo, reencamina por entidades y llama
 * al resolutor puro de la intención. Las fuentes se inyectan (fuentes.ts).
 *
 * Cuatro formas de respuesta (contrato con FRONTEND):
 *  - respuesta: el dato, con cifras, como mucho una acción y sugerencias.
 *  - elegir: falta algo o hay varias posibles; un botón por opción.
 *  - no-se: «No lo sé seguro, pero quizá buscabas:» y tres sugerencias.
 *  - escalar: dudas técnicas y funciones fuera de plan. PRIMERO los pasos y el
 *    apartado de la guía; DESPUÉS el contacto con el mensaje tipo.
 */
import { diaEnZona } from "./reloj";
import { extraerEntidades, NOMBRES_COMUNES, type Entidades } from "./entidades";
import type { ClientaA, FuentesAsistente, PlanSishow } from "./fuentes";
import { apartadoGuia } from "./guia";
import { candidatos, POR_ID, preguntaCon, reencaminar, VOCABULARIO, type Intencion } from "./intenciones";
import { enmascarar, MARCA_CLIENTA, MARCA_PRO, MARCA_SERVICIO } from "./mascara";
import { refuerzos } from "./pistas";
import { tieneAncla } from "./anclas";
import { normalizar } from "./normalizar";
import { desconocidos, puntuar, type Clasificacion } from "./parecido";
import { RESOLUTORES } from "./resolutores";
import { citasDelDia, visitasPorClienta } from "./resolutores/calculos";
import type { Accion, Cifra, Contexto } from "./resolutores/tipos";

export const CORREO_SOPORTE = "ejemplo@sishow.com";

export type RespuestaAsistente =
  | { tipo: "respuesta"; intencion: string; texto: string; cifras: Cifra[]; acciones: Accion[]; sugerencias: string[] }
  | { tipo: "elegir"; intencion: string | null; texto: string; opciones: Array<{ etiqueta: string; pregunta: string }> }
  | { tipo: "no-se"; texto: string; sugerencias: string[] }
  | {
      tipo: "escalar";
      intencion: string;
      texto: string;
      pasos: string[];
      guia: string | null;
      contacto: { cierre: string; correo: string; mensaje: string };
    };

export interface Asistente {
  responder(pregunta: string): RespuestaAsistente;
  /** Olvida el contexto («¿y mañana?» deja de enlazar). */
  reiniciar(): void;
  /**
   * Prepara el catálogo, los índices y los cálculos de marketing (~300 ms la
   * primera vez con 3.300 citas). Llamarlo al abrir el panel, en un momento
   * libre, para que la primera pregunta también tarde milisegundos.
   */
  precalentar(): void;
}

const RANGO_PLAN: Record<PlanSishow, number> = { reservas: 0, "reservas-asistente": 1, "todo-incluido": 2 };
const RE_SALUD = /\b(alergi\w*|alergic\w*|embaraz\w*|medicac\w*|medicament\w*|enfermedad\w*|patologi\w*|dermatitis|psoriasis|diabet\w*)\b/;
/** Seguimiento: «¿y mañana?», «y de sara», «¿y el sábado?». */
const RE_SEGUIMIENTO = /^(y|e|entonces y|vale y|ok y)\s+/;

interface Memoria {
  intencion: string;
  e: Entidades;
}

/** La pregunta enmascarada con las entidades que se han reconocido en ella. */
function enmascararPregunta(texto: string, e: Entidades, s: { servicios: Array<{ name: string }>; ahora: Date; timeZone: string }): string {
  const pros = e.profesionales.flatMap((p) => normalizar(p.name).split(" "));
  const clientas: string[] =
    e.clienta?.tipo === "una" ? normalizar(e.clienta.clienta.name).split(" ")
    : e.clienta?.tipo === "varias" ? e.clienta.opciones.flatMap((c) => normalizar(c.name).split(" "))
    : e.clienta?.tipo === "ninguna" ? e.clienta.buscado.split(" ").filter((p) => NOMBRES_COMUNES.has(p))
    : [];
  const servicios = s.servicios.flatMap((x) => normalizar(x.name).split(" ")).filter((w) => w.length >= 4);
  return enmascarar(texto, { pros, clientas, servicios, ahora: s.ahora, timeZone: s.timeZone });
}

/**
 * Clasifica y reordena por entidades: una intención que exige clienta,
 * profesional o servicio pierde si la pregunta no nombra ninguno, y las que
 * los nombran ganan un poco cuando la pregunta sí los trae.
 */
/** El último orden de puntuaciones (para ver si una intención de plan quedó cerca). */
let ultimoOrden: Array<{ id: string; puntuacion: number }> = [];

function clasificarConEntidades(masc: string, e: Entidades): Clasificacion {
  const tieneCli = masc.includes(MARCA_CLIENTA);
  const tienePro = masc.includes(MARCA_PRO);
  const tieneSer = masc.includes(MARCA_SERVICIO);
  // Solo el nombre de una clienta: su ficha.
  if (tieneCli && masc.split(" ").every((w) => w === MARCA_CLIENTA)) return { tipo: "acierto", id: "buscar-clienta", puntuacion: 1 };
  const extra = refuerzos(masc);
  const ancla = tieneAncla(masc);
  // Pregunta sobre otra cosa: si buena parte de sus palabras no sale en el
  // catálogo y ninguna pista la reconoce, pierde parecido con todo.
  const ajeno = Math.max(0, ...extra.values()) >= 0.45 ? 0 : desconocidos(masc, candidatos());
  const orden = puntuar(masc, candidatos()).map((o) => {
    const i = POR_ID.get(o.id);
    let f = 1;
    if (i?.requiere.includes("clienta") && !tieneCli) f *= 0.8;
    if (i?.requiere.includes("profesional") && !tienePro && !e.profesionales.length) f *= 0.8;
    if (i?.requiere.includes("servicio") && !tieneSer && !e.servicios.length) f *= 0.8;
    return { id: o.id, puntuacion: (o.puntuacion + (extra.get(o.id) ?? 0)) * f * (1 - 0.5 * ajeno) };
  }).sort((a, b) => b.puntuacion - a.puntuacion)
    // Sin nada del salón, solo pueden ganar la charla y la ayuda.
    .filter((o) => ancla || POR_ID.get(o.id)?.grupo === "charla" || POR_ID.get(o.id)?.categoria === "ayuda");
  ultimoOrden = orden;
  const umbral = 0.27;
  const margen = 0.03;
  const [primera, segunda, tercera] = orden;
  if (!primera || primera.puntuacion < umbral) return { tipo: "ninguna", mejores: orden.slice(0, 3) };
  if (segunda && primera.puntuacion - segunda.puntuacion < margen) {
    return { tipo: "dudosa", opciones: [primera, segunda, tercera].filter((o): o is { id: string; puntuacion: number } => !!o && primera.puntuacion - o.puntuacion < margen) };
  }
  return { tipo: "acierto", id: primera.id, puntuacion: primera.puntuacion };
}

function pregunta(id: string): string {
  const i = POR_ID.get(id);
  if (!i) return id;
  return `¿${i.pregunta.replace(/^¿|\?$/g, "")}?`;
}

function sugerenciasDe(id: string, n = 2): string[] {
  const i = POR_ID.get(id);
  if (!i) return [];
  return [...POR_ID.values()]
    .filter((x) => x.id !== id && x.grupo === "negocio" && x.categoria === i.categoria && !x.requiere.length)
    .slice(0, n)
    .map((x) => pregunta(x.id));
}

/** El plan en palabras: «Todo incluido (por confirmar)» → { nombre, nota }. */
function planEnPalabras(texto?: string): { nombre: string; nota: string | null } {
  const m = (texto ?? "").match(/^([^(]+?)\s*(?:\((.+)\))?$/);
  return { nombre: (m?.[1] ?? texto ?? "").trim(), nota: m?.[2]?.trim() ?? null };
}

function salonDe(texto: string, salon: string): string {
  return texto.replace(/soy María de PeluChic/g, `te escribo desde ${salon}`).replace(/PeluChic/g, salon);
}

function escalarPlan(i: Intencion, plan: PlanSishow, salon: string): RespuestaAsistente {
  const guiaRef = i.alternativa?.match(/\(guía ([^)]+)\)/)?.[1];
  const paso = (i.alternativa ?? "").replace(/\s*\(guía [^)]+\)\s*/, "").trim();
  const { nombre, nota } = planEnPalabras(i.plan);
  let texto: string;
  let cierre: string;
  if (i.planMinimo === null) {
    texto = "Eso siShow no lo hace, pero hoy puedes hacer esto:";
    cierre = "Si te interesa que lo tengamos, escríbenos a";
  } else if (i.planMinimo && RANGO_PLAN[plan] >= RANGO_PLAN[i.planMinimo] && !nota) {
    texto = `Eso ya entra en tu plan (**${nombre}**). Hoy puedes hacer esto:`;
    cierre = "Si no te aparece, escríbenos a";
  } else {
    texto = `Eso llega${nota ? `, ${nota.replace(/^hasta /, "hasta ")},` : ""} con el plan **${nombre}**. Mientras tanto, puedes hacer esto:`;
    cierre = "Si quieres activarlo, escríbenos a";
  }
  return {
    tipo: "escalar",
    intencion: i.id,
    texto,
    pasos: paso ? [paso.charAt(0).toUpperCase() + paso.slice(1)] : [],
    guia: apartadoGuia(guiaRef ? `§${guiaRef.replace(/^§/, "")}` : null),
    contacto: { cierre, correo: CORREO_SOPORTE, mensaje: salonDe(i.mensaje ?? "", salon) },
  };
}

function escalarTecnica(i: Intencion, salon: string): RespuestaAsistente {
  const pasos = (i.solucion ?? "").split(/;\s*/).map((p) => p.trim()).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return {
    tipo: "escalar",
    intencion: i.id,
    texto: "Prueba esto:",
    pasos,
    guia: apartadoGuia(i.guia),
    contacto: {
      cierre: "Si sigue sin ir, escríbenos a",
      correo: CORREO_SOPORTE,
      mensaje: `Hola, te escribo desde ${salon}. [Qué te pasa]. Me pasa desde [cuándo], en [móvil / iPad / ordenador]. Adjunto una captura.`,
    },
  };
}

function charla(id: string, c: Contexto): RespuestaAsistente {
  const s = c.estado;
  const r = (texto: string, sugerencias: string[] = []): RespuestaAsistente => ({ tipo: "respuesta", intencion: id, texto, cifras: [], acciones: [], sugerencias });
  switch (id) {
    case "saludo": {
      const n = citasDelDia(s, c.hoy).length;
      const sol = s.citas.filter((x) => x.status === "pending" && Date.parse(x.start) > s.ahora.getTime()).length;
      const extra = sol ? ` y ${sol === 1 ? "1 solicitud esperando" : `${sol} solicitudes esperando`}` : "";
      return r(`¡Hola! 👋 Hoy tienes ${n === 1 ? "1 cita" : `${n} citas`}${extra}. ¿Por dónde empezamos?`, [pregunta("citas-hoy"), pregunta("pendiente-de-ti")]);
    }
    case "gracias": return r("¡A ti! Aquí estoy para lo que necesites.");
    case "quien-eres": return r(`Soy el asistente de siShow para ${s.salonNombre}. No soy una inteligencia artificial: respondo con los datos de tu salón y nunca me invento nada.`);
    case "que-sabes-hacer": return r("Te digo cómo va el día, quién viene, tus huecos, lo que hizo cada clienta, lo que llevas cobrado y cómo va la señal.", [pregunta("citas-hoy"), pregunta("cobrado-periodo")]);
    case "despedida": return r(`¡Hasta luego! Que vaya bien el día en ${s.salonNombre}.`);
    case "buen-trabajo": return r("¡Gracias! El mérito es de tu agenda, que está muy bien llevada.");
    case "como-estas": return r("Muy bien, con los datos al día. ¿Te cuento cómo va hoy?", [pregunta("citas-hoy")]);
    case "no-entiendo": return r("Perdona, no me he explicado. Prueba con algo como «cuántas citas mañana» o «color de Elena».");
    case "ayuda-humana": return r(`Te pongo con el equipo de siShow: escríbenos a **${CORREO_SOPORTE}** y te contestamos lo antes posible.`);
    case "broma": {
      const h = (c.fuentes.huecos(c.hoy) ?? []).filter((x) => Date.parse(x.hasta) > s.ahora.getTime()).length;
      return r(h ? `Lo mío son los números: hoy te quedan ${h === 1 ? "1 hueco" : `${h} huecos`} por llenar. ¿Lo miramos?` : "Lo mío son los números, y hoy tu agenda está llena. ¡Día completo!", [pregunta("huecos-hoy")]);
    }
    default: return r("Aquí estoy.");
  }
}

function noSe(mejores: Array<{ id: string }>): RespuestaAsistente {
  const vistos = new Set<string>();
  const sug: string[] = [];
  for (const m of mejores) {
    const i = POR_ID.get(m.id);
    if (!i || i.grupo !== "negocio" || vistos.has(i.id)) continue;
    vistos.add(i.id);
    sug.push(pregunta(i.id));
  }
  for (const id of ["citas-hoy", "huecos-hoy", "cobrado-periodo"]) if (sug.length < 3 && !vistos.has(id)) sug.push(pregunta(id));
  return { tipo: "no-se", texto: "No lo sé seguro, pero quizá buscabas:", sugerencias: sug.slice(0, 3) };
}

export function crearAsistente(fuentes: FuentesAsistente): Asistente {
  let memoria: Memoria | null = null;

  function responder(textoOriginal: string): RespuestaAsistente {
    const s = fuentes.estado();
    const hoy = diaEnZona(s.ahora, s.timeZone);
    const t = normalizar(textoOriginal);
    const ctxEnt = { vocabulario: VOCABULARIO, clientes: s.clientas, equipo: s.equipo, servicios: s.servicios, ahora: s.ahora, timeZone: s.timeZone };

    if (RE_SALUD.test(t)) {
      return { tipo: "respuesta", intencion: "salud", texto: "Eso no lo guarda siShow: son datos de salud y se preguntan en persona.", cifras: [], acciones: [], sugerencias: [] };
    }

    let e = extraerEntidades(textoOriginal, ctxEnt);
    let id: string | null = null;

    // Seguimiento: «¿y mañana?» repite la intención anterior con lo nuevo.
    const seguimiento = memoria && RE_SEGUIMIENTO.test(t) && t.split(" ").length <= 6;
    if (seguimiento && memoria) {
      const nuevo = e;
      const tieneAlgo = nuevo.fecha || nuevo.profesionales.length || nuevo.servicios.length || nuevo.clienta?.tipo === "una" || nuevo.clienta?.tipo === "varias";
      if (tieneAlgo) {
        e = {
          ...memoria.e,
          fecha: nuevo.fecha ?? (nuevo.profesionales.length || nuevo.clienta ? memoria.e.fecha : null),
          franja: nuevo.franja ?? memoria.e.franja,
          hora: nuevo.hora ?? memoria.e.hora,
          profesionales: nuevo.profesionales.length ? nuevo.profesionales : nuevo.clienta?.tipo === "una" ? [] : memoria.e.profesionales,
          servicios: nuevo.servicios.length ? nuevo.servicios : memoria.e.servicios,
          clienta: nuevo.clienta?.tipo === "una" || nuevo.clienta?.tipo === "varias" ? nuevo.clienta : memoria.e.clienta,
        };
        id = memoria.intencion;
        // «¿y mañana?» tras «citas de Sara hoy»: vuelve a la familia base antes de reencaminar.
        const base: Record<string, string> = { "citas-hoy-profesional": "citas-hoy", "citas-manana": "citas-hoy", "citas-dia": "citas-hoy", "citas-periodo": "citas-hoy", "citas-profesional-periodo": "citas-hoy", "huecos-dia": "huecos-hoy", "hueco-profesional": "huecos-hoy", "ocupacion-periodo": "ocupacion-hoy", "ocupacion-profesional": "ocupacion-hoy", "cobrado-periodo": "ingresos-hoy", "dinero-profesional": "ingresos-hoy" };
        if (nuevo.fecha || nuevo.profesionales.length) id = base[id] ?? id;
      }
    }

    if (!id) {
      const r = clasificarConEntidades(enmascararPregunta(textoOriginal, e, s), e);
      if (r.tipo === "acierto") id = r.id;
      else if (r.tipo === "dudosa") {
        const ids = [...new Set(r.opciones.map((o) => reencaminar(o.id, e, hoy)))];
        if (ids.length === 1) id = ids[0];
        else {
          return {
            tipo: "elegir",
            intencion: null,
            texto: "¿Qué quieres saber?",
            opciones: ids.map((x) => ({ etiqueta: POR_ID.get(x)?.pregunta ?? x, pregunta: textoConIntencion(x, e) })),
          };
        }
      } else {
        if (e.clienta?.tipo === "una") id = "buscar-clienta";
        else return noSe(r.mejores);
      }
    }

    id = reencaminar(id, e, hoy);
    const i = POR_ID.get(id);
    if (!i) return noSe([]);
    const ctx: Contexto = { fuentes, estado: s, e, hoy, pregunta: t };

    if (i.grupo === "charla") { memoria = null; return charla(i.id, ctx); }
    if (i.grupo === "plan") return escalarPlan(i, s.plan, s.salonNombre);
    if (i.grupo === "tecnica") return escalarTecnica(i, s.salonNombre);

    // El plan Reservas no incluye el asistente: se dice, con la alternativa.
    if (s.plan === "reservas") return escalarPlan(POR_ID.get("plan-asistente")!, s.plan, s.salonNombre);

    // Entidades que faltan: se pregunta, nunca se supone.
    let clienta: ClientaA | undefined;
    if (i.requiere.includes("clienta")) {
      const cl = e.clienta;
      if (cl?.tipo === "varias") {
        const pila = cl.opciones[0].name.split(" ")[0];
        return {
          tipo: "elegir",
          intencion: i.id,
          texto: `Tengo ${cl.opciones.length} ${pila}s: ${cl.opciones.map((c) => c.name).join(", ").replace(/, ([^,]*)$/, " y $1")}. ¿Cuál?`,
          opciones: cl.opciones.map((c) => ({ etiqueta: c.name, pregunta: preguntaCon(i.id, { clienta: c.name }) })),
        };
      }
      if (cl?.tipo !== "una") {
        memoria = { intencion: i.id, e };
        const nombres = cl?.tipo === "ninguna" ? cl.buscado.split(" ").filter((p) => NOMBRES_COMUNES.has(p)) : [];
        const buscado = nombres.length ? ` No encuentro a ninguna «${nombres.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(" ")}» entre tus clientas.` : "";
        return { tipo: "elegir", intencion: i.id, texto: `¿De qué clienta?${buscado} Escribe su nombre.`, opciones: [] };
      }
      clienta = cl.clienta;
    }
    if (i.requiere.includes("profesional") && !e.profesionales.length) {
      return {
        tipo: "elegir",
        intencion: i.id,
        texto: "¿De quién del equipo?",
        opciones: s.equipo.map((p) => ({ etiqueta: p.name.split(" ")[0], pregunta: textoConIntencion(i.id, { ...e, profesionales: [p] }) })),
      };
    }
    if (i.requiere.includes("servicio") && !e.servicios.length) {
      return {
        tipo: "elegir",
        intencion: i.id,
        texto: "¿De qué servicio?",
        opciones: s.servicios.filter((x) => x.active !== false).slice(0, 8).map((x) => ({ etiqueta: x.name, pregunta: textoConIntencion(i.id, { ...e, servicios: [x] }) })),
      };
    }

    const resolutor = RESOLUTORES[i.id];
    if (!resolutor) return noSe([]);
    let out;
    try {
      out = resolutor({ ...ctx, clienta });
    } catch {
      // Un dato raro no puede romper el panel: se dice, sin inventar.
      return { tipo: "respuesta", intencion: i.id, texto: "Ahora mismo no he podido calcularlo. Prueba en un momento o míralo en su pantalla.", cifras: [], acciones: [], sugerencias: sugerenciasDe(i.id) };
    }
    memoria = { intencion: i.id, e };
    return {
      tipo: "respuesta",
      intencion: i.id,
      texto: out.texto,
      cifras: out.cifras,
      acciones: out.acciones.slice(0, 1),
      sugerencias: out.sugerencias.length ? out.sugerencias : sugerenciasDe(i.id),
    };
  }

  /** La pregunta de un botón: la del catálogo con las entidades ya puestas. */
  function textoConIntencion(id: string, e: Entidades): string {
    const clienta = e.clienta?.tipo === "una" ? e.clienta.clienta.name : e.clienta?.tipo === "varias" ? e.clienta.opciones[0].name.split(" ")[0] : undefined;
    return preguntaCon(id, { clienta, pro: e.profesionales[0]?.name.split(" ")[0], servicio: e.servicios[0]?.name });
  }

  return {
    responder,
    reiniciar() {
      memoria = null;
    },
    precalentar() {
      candidatos();
      const s = fuentes.estado();
      const hoy = diaEnZona(s.ahora, s.timeZone);
      citasDelDia(s, hoy);
      visitasPorClienta(s);
      fuentes.huecos(hoy);
      fuentes.marketing.campanas();
      fuentes.marketing.franjaFloja();
      fuentes.marketing.segundaVisita();
      fuentes.marketing.resenas();
    },
  };
}

