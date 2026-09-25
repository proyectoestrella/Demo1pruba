import { answerFor, clientasDePregunta, type SalonContext } from "../assistant-answers";
import { CHARLA, FAMILIAS, type FamiliaAsistente } from "./catalogo-arena";

/**
 * SUSTITUTO TEMPORAL del motor del asistente de BACKEND (lote 10). Da al
 * panel respuestas ESTRUCTURADAS con la forma que tendrá el motor: una
 * respuesta con cifra y acción, una pregunta de desambiguación, un «no lo sé,
 * pero…» con tres sugerencias o el escalado al equipo de siShow. Por dentro
 * usa las respuestas de siempre (`answerFor`) y el catálogo de la
 * especificación para el parecido léxico.
 *
 * CONECTAR: cuando llegue `src/lib/asistente/` de BACKEND, el panel llama a
 * su `responder(pregunta, fuentes)` y este fichero se borra. El tipo
 * `RespuestaAsistente` se ajusta al suyo.
 */

export const CORREO_SISHOW = "ejemplo@sishow.com";

export type Destino =
  | { tipo: "ruta"; to: string; search?: Record<string, string> }
  | { tipo: "ficha"; clientId: string }
  | { tipo: "preguntar"; texto: string };

export interface Accion {
  etiqueta: string;
  destino: Destino;
}

export type RespuestaAsistente =
  | { tipo: "respuesta"; texto: string; cifra: string | null; accion: Accion | null }
  | { tipo: "elegir"; texto: string; opciones: { etiqueta: string; pregunta: string }[] }
  | { tipo: "no-se"; texto: string; sugerencias: string[] }
  | { tipo: "escalar"; texto: string; correo: string; mensaje: string };

/** Normaliza como pide la especificación §0: minúsculas, sin tildes ni signos, abreviaturas. */
export function normalizar(t: string): string {
  const base = t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:«»"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const abrev: Record<string, string> = {
    q: "que", k: "que", ke: "que", qe: "que", xq: "por que", pq: "por que", mnn: "manana", mna: "manana", mana: "manana",
    hoi: "hoy", oy: "hoy", kien: "quien", qien: "quien", cuants: "cuantas", qntas: "cuantas", tb: "tambien", tmb: "tambien",
    sem: "semana", smn: "semana", finde: "fin de semana", dnd: "donde", x: "por", tlf: "telefono", tfno: "telefono", movil: "telefono",
    cliente: "clienta", clientes: "clientas", pelu: "peluqueria",
  };
  return base
    .split(" ")
    .map((w) => abrev[w.replace("ñ", "n")] ?? w)
    .join(" ");
}

const VACIAS = new Set(["el", "la", "los", "las", "de", "del", "a", "en", "un", "una", "y", "o", "me", "mi", "tengo", "hay", "es", "que", "se", "le", "lo", "por", "con", "para"]);
const tokens = (t: string) => normalizar(t).split(" ").filter((w) => w && !VACIAS.has(w));

/** Parecido léxico tolerante a faltas: coincidencia exacta o del mismo prefijo de 4 letras. */
export function parecido(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  let s = 0;
  for (const x of ta) {
    if (tb.includes(x)) s += 1;
    else if (x.length >= 4 && tb.some((y) => y.length >= 4 && y.slice(0, 4) === x.slice(0, 4))) s += 0.6;
  }
  return s / Math.max(ta.length, tb.length);
}

/** Las familias del catálogo más parecidas a la pregunta, de más a menos. */
export function familiasParecidas(pregunta: string, n = 3): FamiliaAsistente[] {
  return FAMILIAS.map((f) => ({ f, s: Math.max(...f.ejemplos.map((e) => parecido(pregunta, e)), parecido(pregunta, f.responde) * 0.8) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.f);
}

const RUTA_DE_ACCION: { patron: RegExp; destino: Destino }[] = [
  { patron: /hoja de ma[nñ]ana/i, destino: { tipo: "ruta", to: "/app/hoja", search: { dia: "manana" } } },
  { patron: /hoja del d[ií]a/i, destino: { tipo: "ruta", to: "/app/hoja", search: { dia: "hoy" } } },
  { patron: /calendario|nueva cita|dar (la )?cita|ese d[ií]a/i, destino: { tipo: "ruta", to: "/app/calendar" } },
  { patron: /anal[ií]tica|excel/i, destino: { tipo: "ruta", to: "/app/insights" } },
  { patron: /marketing|campa|preparar (env[ií]o|mensaje)/i, destino: { tipo: "ruta", to: "/app/marketing" } },
  { patron: /clientas/i, destino: { tipo: "ruta", to: "/app/clients" } },
  { patron: /equipo/i, destino: { tipo: "ruta", to: "/app/employees" } },
  { patron: /servicios/i, destino: { tipo: "ruta", to: "/app/services" } },
  { patron: /lista de espera/i, destino: { tipo: "ruta", to: "/app/waitlist" } },
  { patron: /mi p[aá]gina|tu web|copiar enlace/i, destino: { tipo: "ruta", to: "/app/web" } },
  { patron: /ajustes/i, destino: { tipo: "ruta", to: "/app/settings" } },
  { patron: /citas|marcar|confirmar|hoy/i, destino: { tipo: "ruta", to: "/app/appointments" } },
];

function accionDe(etiqueta: string | null): Accion | null {
  if (!etiqueta) return null;
  const r = RUTA_DE_ACCION.find((x) => x.patron.test(etiqueta));
  return r ? { etiqueta, destino: r.destino } : null;
}

/** La cifra que se destaca: el primer importe, porcentaje o número con su unidad. */
export function cifraDe(texto: string): string | null {
  const m = texto.match(/\d[\d.]*(?:,\d+)?\s?(?:€|%|h(?:\s?\d+)?|min|citas?|clientas?|huecos?)?/);
  return m ? m[0].trim() : null;
}

const ESCALAR = /no (me )?funciona|error|se ha roto|no carga|no puedo entrar|hablar con (alguien|una persona)|soporte|ayuda humana/;

export function responder(pregunta: string, ctx: SalonContext): RespuestaAsistente {
  const q = normalizar(pregunta);
  if (!q) return { tipo: "no-se", texto: "Escríbeme lo que quieres saber.", sugerencias: FAMILIAS.slice(0, 3).map((f) => f.ejemplos[0]) };

  if (ESCALAR.test(q) || /^(quiero hablar con alguien|persona|soporte)$/.test(q)) {
    return {
      tipo: "escalar",
      texto: "Te pongo con el equipo de siShow. Copia este mensaje y mándalo a nuestro correo; te contestamos lo antes posible.",
      correo: CORREO_SISHOW,
      mensaje: `Hola, soy de ${ctx.salonName}. Tengo un problema: «${pregunta.trim()}». Me pasa desde hoy, en [móvil / iPad / ordenador]. Adjunto una captura.`,
    };
  }

  const charla = CHARLA.find((c) => c.ejemplos.some((e) => normalizar(e) === q));
  if (charla) return { tipo: "respuesta", texto: charla.respuesta.replace(/\s*\[[^\]]+\]/g, ""), cifra: null, accion: null };

  // Desambiguación: dos o más clientas con ese nombre.
  const clienta = clientasDePregunta(pregunta, ctx.clients);
  if (clienta && clienta.matches.length > 1) {
    return {
      tipo: "elegir",
      texto: `Tengo ${clienta.matches.length} clientas con ese nombre. ¿Cuál?`,
      opciones: clienta.matches.slice(0, 5).map((c) => ({ etiqueta: c.name, pregunta: `ficha de ${c.name}` })),
    };
  }

  // Primero tal cual; si no, con el texto normalizado («kien viene mñn» → «quien viene manana»).
  let texto = answerFor(pregunta, ctx);
  if (texto.startsWith("No sé responder")) texto = answerFor(q, ctx);
  if (texto.startsWith("No sé responder")) {
    // Tres sugerencias parecidas, sin repetir lo que ya ha escrito ella.
    const propias = new Set([q]);
    const sugerencias = familiasParecidas(pregunta, 8)
      .map((f) => f.ejemplos.find((e) => !propias.has(normalizar(e))) ?? f.ejemplos[0])
      .filter((e, i, l) => !propias.has(normalizar(e)) && l.indexOf(e) === i)
      .slice(0, 3);
    return {
      tipo: "no-se",
      texto: "No lo tengo claro, pero quizá buscabas:",
      sugerencias: sugerencias.length === 3 ? sugerencias : FAMILIAS.slice(0, 3).map((f) => f.ejemplos[0]),
    };
  }

  if (clienta?.matches.length === 1 && texto.startsWith("Ficha de ")) {
    return { tipo: "respuesta", texto, cifra: null, accion: { etiqueta: "Abrir ficha", destino: { tipo: "ficha", clientId: clienta.matches[0].id } } };
  }
  const familia = familiasParecidas(pregunta, 1)[0];
  return { tipo: "respuesta", texto, cifra: cifraDe(texto), accion: accionDe(familia?.accion ?? null) };
}
