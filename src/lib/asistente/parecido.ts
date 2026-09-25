/**
 * Parecido léxico entre una pregunta y los ejemplos de cada intención, sin
 * modelo de IA (lote 7). Tres capas:
 *
 *  1. Frases del dominio que se funden en una sola palabra antes de nada
 *     («lista de espera», «no vino», «fin de semana»…).
 *  2. Palabras → forma canónica: raíz ligera (normalizar.ts) y grupos de
 *     sinónimos del salón (clienta/cliente/chica, cita/reserva/turno,
 *     dinero/caja/ingresos/cobrado, tinte/color, mechas/balayage…).
 *  3. Faltas: dos palabras casan también si su distancia de Damerau es
 *     pequeña para su longitud («cancelacoines», «mañaan»).
 *
 * La puntuación combina un Jaccard «blando» sobre esas palabras con el
 * parecido de trigramas del texto, y `clasificar` decide con umbral y
 * margen: si dos intenciones quedan casi empatadas, no elige: pregunta.
 *
 * Funciones puras. Los ejemplos se preparan una vez (`prepararCandidatos`)
 * para que clasificar cueste milisegundos.
 */
import { normalizar, PALABRAS_VACIAS, raiz } from "./normalizar";

/** Frases que significan una sola cosa. Se buscan sobre el texto normalizado. */
export const FRASES: Array<[RegExp, string]> = [
  [/\blista de espera\b/g, "listaespera"],
  [/\bno (?:ha |han )?(?:venido|vino|vinieron|aparecido|aparecio|se (?:ha )?presentado|se presento|asistio|acudio)\b/g, "planton"],
  [/\bno show(?:s)?\b|\bnoshow(?:s)?\b/g, "planton"],
  [/\bfin de semana\b/g, "findesemana"],
  [/\bpasado manana\b/g, "pasadomanana"],
  [/\bla semana (?:que viene|proxima|siguiente)\b|\bproxima semana\b|\bsemana que viene\b/g, "semanaproxima"],
  [/\bsemana pasada\b|\bla semana anterior\b/g, "semanapasada"],
  [/\bmes (?:que viene|proximo|siguiente)\b|\bproximo mes\b/g, "mesproximo"],
  [/\bmes pasado\b|\bmes anterior\b/g, "mespasado"],
  [/\bcuanto (?:dinero )?(?:llevo|llevamos|he hecho|hemos hecho|he sacado|hemos sacado)\b/g, "dinero"],
  [/\bpor que\b/g, "porque"],
  [/\bcuanto cuesta\b|\bcuanto vale\b|\bque precio\b/g, "precio"],
  [/\bsin cita\b|\bsin reserva\b|\bwalk ?in\b/g, "sincita"],
];

/**
 * Grupos de sinónimos del salón. La primera palabra de cada grupo es la
 * forma canónica; el resto (y sus raíces) se reescriben a ella.
 */
export const SINONIMOS: string[][] = [
  ["clienta", "cliente", "clientes", "clientas", "chica", "chicas", "senora", "senoras", "persona", "personas", "gente", "chico", "chicos", "senor"],
  ["cita", "citas", "reserva", "reservas", "turno", "turnos", "visita", "visitas", "servicio_reservado"],
  ["hueco", "huecos", "libre", "libres", "gap", "disponible", "disponibles", "disponibilidad", "sitio", "hueco_libre"],
  ["vino", "vinieron", "asistio", "asistieron", "aparecio", "llego", "llegaron", "acudio", "presento"],
  ["planton", "plantones", "faltar", "falto", "faltaron", "ausencia", "ausencias", "noshow"],
  ["dinero", "caja", "ingreso", "ingresos", "facturado", "facturacion", "facturar", "factura", "cobrado", "cobrada", "cobro", "cobros", "ganado", "ganancia", "ganancias", "recaudado", "recaudacion", "euros", "pasta", "ventas", "venta"],
  ["tinte", "tintes", "color", "colores", "coloracion", "tenir", "tinto"],
  ["mechas", "mecha", "balayage", "reflejos", "babylights"],
  ["cancelar", "cancelada", "canceladas", "cancelado", "cancelacion", "cancelaciones", "anular", "anulada", "anulacion", "cancelo", "cancelaron", "anulo"],
  ["profesional", "profesionales", "estilista", "estilistas", "peluquera", "peluqueras", "peluquero", "barbero", "barberos", "empleada", "empleadas", "empleado", "trabajadora", "trabajadoras", "equipo", "companera", "companeras"],
  ["senal", "senales", "fianza", "fianzas", "deposito", "depositos", "adelanto", "anticipo", "bizum"],
  ["corte", "cortes", "cortar", "pelado"],
  ["peinado", "peinados", "peinar", "recogido", "recogidos"],
  ["precio", "precios", "tarifa", "tarifas", "coste", "cuesta", "vale", "cobrar_por"],
  ["servicio", "servicios", "tratamiento", "tratamientos", "trabajo"],
  ["hoy", "hoydia"],
  ["manana", "mananas"],
  ["ocupacion", "ocupada", "ocupado", "lleno", "llena", "completo", "completa", "hueco_ocupado"],
  ["nueva", "nuevas", "nuevo", "nuevos", "primera_vez", "primeriza"],
  ["recordatorio", "recordatorios", "recordar", "avisar", "aviso", "avisos"],
  ["ficha", "fichas", "historial", "historico"],
  ["whatsapp", "mensaje", "mensajes", "escribir"],
  ["semana", "semanal", "semanas"],
  ["mes", "meses", "mensual"],
  ["ano", "anos", "anual"],
  ["propina", "propinas"],
  ["hola", "buenas", "buenos", "hey", "saludos"],
];

const CANON = (() => {
  const m = new Map<string, string>();
  for (const grupo of SINONIMOS) {
    const canon = grupo[0];
    for (const w of grupo) {
      m.set(w, canon);
      m.set(raiz(w), canon);
    }
  }
  return m;
})();

/** Aplica las frases del dominio a un texto ya normalizado. */
export function fundirFrases(normalizado: string): string {
  let t = normalizado;
  for (const [re, rep] of FRASES) t = t.replace(re, rep);
  return t;
}

/**
 * Palabras cerradas que no se recortan: interrogativos, indefinidos y los
 * tokens que salen de fundir frases. «quien» no debe quedarse en «qui».
 */
const SIN_RAIZ = new Set([
  "quien", "quienes", "cuando", "cuanto", "cuanta", "cuantos", "cuantas", "donde", "como", "cual", "cuales",
  "alguien", "nadie", "nada", "todo", "toda", "todos", "todas", "cada", "otro", "otra", "mas", "menos", "no",
  "porque", "hoy", "ayer", "ahora", "luego", "despues", "antes",
  ...FRASES.map(([, rep]) => rep),
]);

/** Forma canónica de una palabra: su sinónimo de grupo o, si no tiene, su raíz. */
export function canonica(palabra: string): string {
  if (SIN_RAIZ.has(palabra)) return CANON.get(palabra) ?? palabra;
  return CANON.get(palabra) ?? CANON.get(raiz(palabra)) ?? raiz(palabra);
}

/** Palabras canónicas con significado de un texto libre. */
export function terminos(texto: string): string[] {
  return fundirFrases(normalizar(texto))
    .split(" ")
    .filter((p) => p && !PALABRAS_VACIAS.has(p))
    .map(canonica);
}

/** Distancia de Damerau-Levenshtein (transposiciones adyacentes cuentan 1). */
export function damerau(a: string, b: string): number {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (!n) return m;
  if (!m) return n;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)]);
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + coste);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

/** Faltas toleradas según la longitud: nada en palabras cortas (evita «mes» = «mas»). */
function faltasPermitidas(longitud: number): number {
  if (longitud < 5) return 0;
  if (longitud < 8) return 1;
  return 2;
}

/** ¿Son la misma palabra, contando sinónimos y faltas? Devuelve 1, 0,8 (con falta) o 0. */
export function casan(a: string, b: string): number {
  if (a === b) return 1;
  if (/^\d/.test(a) || /^\d/.test(b)) return 0;
  const tope = faltasPermitidas(Math.min(a.length, b.length));
  if (tope === 0) return 0;
  return damerau(a, b) <= tope ? 0.8 : 0;
}

/** Trigramas de un texto (con bordes), para el parecido de forma. */
export function trigramas(texto: string): Set<string> {
  const t = ` ${texto} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (!a.size && !b.size) return 0;
  let comunes = 0;
  for (const x of a) if (b.has(x)) comunes++;
  return comunes / (a.size + b.size - comunes);
}

/** Un ejemplo ya preparado. */
export interface EjemploPreparado {
  terminos: string[];
  trigramas: Set<string>;
}

export function prepararEjemplo(texto: string): EjemploPreparado {
  const t = terminos(texto);
  return { terminos: t, trigramas: trigramas(t.join(" ")) };
}

/**
 * Jaccard «blando»: cada término de la pregunta busca su mejor pareja en el
 * ejemplo (igual, sinónimo o con falta). Penaliza por igual lo que sobra en
 * la pregunta y lo que le falta respecto al ejemplo.
 */
function jaccardBlando(pregunta: string[], ejemplo: string[]): number {
  if (!pregunta.length || !ejemplo.length) return 0;
  const usados = new Set<number>();
  let suma = 0;
  for (const p of pregunta) {
    let mejor = 0;
    let idx = -1;
    ejemplo.forEach((e, i) => {
      if (usados.has(i)) return;
      const c = casan(p, e);
      if (c > mejor) {
        mejor = c;
        idx = i;
      }
    });
    if (idx >= 0) {
      usados.add(idx);
      suma += mejor;
    }
  }
  return suma / (pregunta.length + ejemplo.length - suma);
}

/** Parecido entre 0 y 1 entre una pregunta preparada y un ejemplo preparado. */
export function parecido(pregunta: EjemploPreparado, ejemplo: EjemploPreparado): number {
  return 0.75 * jaccardBlando(pregunta.terminos, ejemplo.terminos) + 0.25 * jaccard(pregunta.trigramas, ejemplo.trigramas);
}

export interface Candidato {
  id: string;
  ejemplos: string[];
}

export interface CandidatoPreparado {
  id: string;
  ejemplos: EjemploPreparado[];
}

export function prepararCandidatos(candidatos: Candidato[]): CandidatoPreparado[] {
  return candidatos.map((c) => ({ id: c.id, ejemplos: c.ejemplos.map(prepararEjemplo) }));
}

export type Clasificacion =
  | { tipo: "acierto"; id: string; puntuacion: number }
  /** Dos o tres intenciones casi empatadas: hay que preguntar cuál. */
  | { tipo: "dudosa"; opciones: Array<{ id: string; puntuacion: number }> }
  | { tipo: "ninguna"; mejores: Array<{ id: string; puntuacion: number }> };

export interface OpcionesClasificar {
  /** Por debajo, no se responde. */
  umbral?: number;
  /** Si la segunda queda a menos de esto de la primera, se pregunta. */
  margen?: number;
}

/** Puntuación de cada candidato (su mejor ejemplo), de mayor a menor. */
export function puntuar(pregunta: string, candidatos: CandidatoPreparado[]): Array<{ id: string; puntuacion: number }> {
  const p = prepararEjemplo(pregunta);
  return candidatos
    .map((c) => ({ id: c.id, puntuacion: Math.max(0, ...c.ejemplos.map((e) => parecido(p, e))) }))
    .sort((a, b) => b.puntuacion - a.puntuacion);
}

export function clasificar(
  pregunta: string,
  candidatos: CandidatoPreparado[],
  { umbral = 0.34, margen = 0.04 }: OpcionesClasificar = {},
): Clasificacion {
  const orden = puntuar(pregunta, candidatos);
  const [primera, segunda, tercera] = orden;
  if (!primera || primera.puntuacion < umbral) return { tipo: "ninguna", mejores: orden.slice(0, 3) };
  if (segunda && primera.puntuacion - segunda.puntuacion < margen) {
    const opciones = [primera, segunda, tercera].filter(
      (o): o is { id: string; puntuacion: number } => !!o && primera.puntuacion - o.puntuacion < margen,
    );
    return { tipo: "dudosa", opciones };
  }
  return { tipo: "acierto", id: primera.id, puntuacion: primera.puntuacion };
}
