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
  [/\bno (?:me )?(?:ha |han )?(?:venido|vino|vinieron|aparecido|aparecio|aparecieron|se (?:ha |han )?presentad[oa]s?|se present(?:o|aron|an|a)|asistio|acudio|acudieron)\b/g, "planton"],
  [/\bno show(?:s)?\b|\bnoshow(?:s)?\b|\bdado planton\b/g, "planton"],
  [/\bfin de semana\b/g, "findesemana"],
  [/\bpasado manana\b/g, "pasadomanana"],
  [/\bla semana (?:que viene|proxima|siguiente)\b|\bproxima semana\b|\bsemana que viene\b/g, "semanaproxima"],
  [/\bsemana pasada\b|\bla semana anterior\b/g, "semanapasada"],
  [/\bmes (?:que viene|proximo|siguiente)\b|\bproximo mes\b/g, "mesproximo"],
  [/\bmes pasado\b|\bmes anterior\b/g, "mespasado"],
  [/\bcuanto (?:dinero )?(?:llevo|llevamos|he hecho|hemos hecho|he sacado|hemos sacado)\b/g, "dinero"],
  [/\bpor que\b/g, "porque"],
  [/\bcuanto cuesta\b|\bcuanto vale\b|\bque precio\b|\ba cuanto (?:esta|sale|lo tenemos)\b|\bcuanto cobr\w* por\b/g, "precio"],
  [/\bsin cita\b|\bsin reserva\b|\bwalk ?in\b/g, "sincita"],
  // Clientas que se han ido: «no vuelven», «sin venir», «hace mucho que no viene».
  [/\bno (?:ha |han )?(?:vuelto|vuelve|vuelven|volvio|volvieron|repetido)\b|\bsin venir\b|\bhace (?:mucho|tiempo) que no (?:viene|vienen)\b|\bperdidas\b/g, "inactiva"],
  [/\bprimera vez\b|\bprimera visita\b/g, "nueva"],
  [/\bsin (?:marcar|cerrar|desenlace)\b|\bpor marcar\b|\bmarcar si (?:vino|vinieron)\b/g, "pormarcar"],
  [/\b(?:mas|mejor) a cuenta\b|\bmas rentable\b|\bmas renta\b|\bque mas renta\b|\bdeja mas por hora\b|\bpor hora\b/g, "rentable"],
  [/\bfuera de plazo\b|\bse (?:le |les )?(?:ha )?pas(?:o|ado) el plazo\b|\bplazo vencido\b/g, "vencida"],
  [/\bno (?:te |me )?(?:has |he )?entend\w*\b|\bno me entiendes\b/g, "noentiendo"],
  [/\bforma de pago\b|\bmetodo de pago\b|\btarjeta y (?:cuanto en )?efectivo\b/g, "metodopago"],
  [/\bprimer hueco\b|\bcuando (?:cabe|caben|puedo meter|hay sitio)\b|\bdonde cabe\b/g, "primerhueco"],
  [/\bmuy bien hecho\b|\bbien hecho\b|\beres (?:un|una) crack\b|\bque (?:bien|maquina)\b/g, "buentrabajo"],
];

/**
 * Grupos de sinónimos del salón. La primera palabra de cada grupo es la
 * forma canónica; el resto (y sus raíces) se reescriben a ella.
 */
export const SINONIMOS: string[][] = [
  ["clienta", "cliente", "clientes", "clientas", "chica", "chicas", "senora", "senoras", "persona", "personas", "gente", "chico", "chicos", "senor"],
  ["cita", "citas", "reserva", "reservas", "turno", "turnos", "visita", "visitas", "servicio_reservado"],
  ["hueco", "huecos", "libre", "libres", "gap", "disponible", "disponibles", "disponibilidad", "sitio", "hueco_libre", "librar", "libran"],
  ["vino", "vinieron", "asistio", "asistieron", "aparecio", "llego", "llegaron", "acudio", "presento"],
  ["planton", "plantones", "faltar", "falto", "faltaron", "ausencia", "ausencias", "noshow"],
  ["dinero", "caja", "ingreso", "ingresos", "facturado", "facturacion", "facturar", "facturamos", "facturo", "cobrado", "cobrada", "cobro", "cobros", "cobrar", "cobramos", "ganado", "ganamos", "ganancia", "ganancias", "recaudado", "recaudacion", "euros", "pasta", "ventas", "venta", "sacar", "sacamos", "sacado", "sacar"],
  ["tinte", "tintes", "color", "colores", "coloracion", "tenir", "tinto", "formula", "formulas"],
  ["mechas", "mecha", "balayage", "reflejos", "babylights"],
  ["cancelar", "cancelada", "canceladas", "cancelado", "cancelacion", "cancelaciones", "anular", "anulada", "anulado", "anulacion", "cancelo", "cancelaron", "anulo", "borrar", "borro", "eliminar", "elimino", "quitar"],
  ["profesional", "profesionales", "estilista", "estilistas", "peluquera", "peluqueras", "peluquero", "barbero", "barberos", "empleada", "empleadas", "empleado", "trabajadora", "trabajadoras", "equipo", "companera", "companeras"],
  ["senal", "senales", "fianza", "fianzas", "deposito", "depositos", "adelanto", "anticipo"],
  ["corte", "cortes", "cortar", "pelado"],
  ["peinado", "peinados", "peinar", "recogido", "recogidos"],
  ["precio", "precios", "tarifa", "tarifas", "coste", "cuesta", "vale", "cobrar_por"],
  ["servicio", "servicios", "tratamiento", "tratamientos", "ofrecemos", "ofrezco", "carta"],
  ["hoy", "hoydia"],
  ["manana", "mananas"],
  ["ocupacion", "ocupada", "ocupado", "lleno", "llena", "llenos", "llenas", "completo", "completa", "porcentaje", "cargada", "cargadas", "hueco_ocupado"],
  ["nueva", "nuevas", "nuevo", "nuevos", "primera_vez", "primeriza"],
  ["recordatorio", "recordatorios", "recordar", "avisar", "aviso", "avisos"],
  ["ficha", "fichas", "historial", "historico"],
  ["whatsapp", "mensaje", "mensajes", "escribir"],
  ["semana", "semanal", "semanas"],
  ["mes", "meses", "mensual"],
  ["ano", "anos", "anual"],
  ["propina", "propinas"],
  ["hola", "buenas", "buenos", "hey", "saludos"],
  ["telefono", "movil", "email", "correo", "mail", "contacto", "contactar", "contacto_de", "llamar"],
  ["abierto", "abiertos", "abierta", "abrimos", "abre", "abrir", "abris", "cerrado", "cerrada", "cierra", "cerramos"],
  ["vencida", "vencidas", "vencido", "caducada", "caducadas", "caducado", "expirada", "expiradas", "plazo"],
  ["anotar", "anoto", "apuntar", "apunto", "apuntado", "guardar", "guardo", "anotado"],
  ["crear", "creo", "meter", "meto", "anadir", "anado", "agregar", "nueva_cita"],
  ["volver", "vuelven", "vuelve", "repiten", "repetir", "repite", "regresan", "fieles", "fiel", "recurrentes"],
  ["broma", "chiste", "chistes", "gracioso", "graciosa", "divertido"],
  ["preguntar", "preguntarte", "escribirte", "hablarte", "hablo", "pregunto"],
  ["enlace", "link", "url", "pagina", "web"],
  ["pendiente", "pendientes", "esperando", "espero", "falta", "faltan"],
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
  // «libra(s)» es peso o moneda: no se recorta a «libr-» ni se confunde con «libre».
  "libra", "libras",
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
  if (tope === 0 || Math.abs(a.length - b.length) > tope) return 0;
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

/**
 * Peso de cada término según en cuántas intenciones aparece (IDF): «señal»,
 * «plazo» o «email» deciden; «cuanto», «citas» u «hoy» apenas. Un término que
 * no sale en ningún ejemplo pesa como uno raro: la pregunta que habla de otra
 * cosa («el precio de la luz») pierde parecido con todo.
 */
export interface Pesos {
  idf: Map<string, number>;
  desconocido: number;
  /** Término → candidatos (por posición) que lo usan en algún ejemplo. */
  indice: Map<string, Set<number>>;
  /** Pesos de los términos de cada ejemplo, calculados una vez. */
  pesosEjemplo: WeakMap<EjemploPreparado, number[]>;
}

const PESOS = new WeakMap<CandidatoPreparado[], Pesos>();

export function prepararCandidatos(candidatos: Candidato[]): CandidatoPreparado[] {
  const out = candidatos.map((c) => ({ id: c.id, ejemplos: c.ejemplos.map(prepararEjemplo) }));
  const df = new Map<string, number>();
  const indice = new Map<string, Set<number>>();
  out.forEach((c, i) => {
    for (const t of new Set(c.ejemplos.flatMap((e) => e.terminos))) {
      df.set(t, (df.get(t) ?? 0) + 1);
      let s = indice.get(t);
      if (!s) indice.set(t, (s = new Set()));
      s.add(i);
    }
  });
  const n = out.length;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log((n + 1) / (d + 0.5)));
  const pesosEjemplo = new WeakMap<EjemploPreparado, number[]>();
  for (const c of out) for (const e of c.ejemplos) pesosEjemplo.set(e, e.terminos.map((t) => idf.get(t)!));
  PESOS.set(out, { idf, desconocido: Math.log((n + 1) / 1.5), indice, pesosEjemplo });
  return out;
}

const EQUIVALENTES = new WeakMap<Pesos, Map<string, Map<string, number>>>();

/**
 * Palabras del catálogo que casan con `t` (exacta = 1, con falta = 0,8).
 * Se calcula una vez por término: el bucle de comparación ya no llama a
 * Damerau, solo consulta este mapa.
 */
function equivalentes(t: string, w: Pesos): Map<string, number> {
  let m = EQUIVALENTES.get(w);
  if (!m) EQUIVALENTES.set(w, (m = new Map()));
  let v = m.get(t);
  if (!v) {
    v = new Map();
    for (const k of w.idf.keys()) {
      const c = casan(t, k);
      if (c > 0) v.set(k, c);
    }
    if (m.size > 50_000) m.clear();
    m.set(t, v);
  }
  return v;
}

/** Parte de la pregunta que el catálogo no conoce (0 = todo conocido, 1 = nada). */
export function desconocidos(pregunta: string, candidatos: CandidatoPreparado[]): number {
  const w = PESOS.get(candidatos);
  const t = terminos(pregunta).filter((x) => !x.startsWith("zz"));
  if (!w || !t.length) return 0;
  // Por peso, no por número: una palabra ajena pesa como una rara, y «receta
  // de lentejas fácil» es casi toda ajena aunque «fácil» salga en algún ejemplo.
  const pesoDe = (x: string) => w.idf.get(x) ?? w.desconocido;
  const total = t.reduce((a, x) => a + pesoDe(x), 0);
  const fuera = t.filter((x) => !conocida(x, w)).reduce((a, x) => a + pesoDe(x), 0);
  return total ? fuera / total : 0;
}

const PESO_CACHE = new WeakMap<Pesos, Map<string, number>>();
const CONOCIDA = new WeakMap<Pesos, Map<string, boolean>>();

/** ¿La conoce el catálogo, exacta o con una falta? Cacheado por término. */
function conocida(t: string, w: Pesos): boolean {
  let m = CONOCIDA.get(w);
  if (!m) CONOCIDA.set(w, (m = new Map()));
  let v = m.get(t);
  if (v === undefined) {
    v = w.idf.has(t);
    if (!v) for (const k of w.idf.keys()) if (casan(t, k) > 0) { v = true; break; }
    m.set(t, v);
  }
  return v;
}

function peso(t: string, w: Pesos): number {
  const v = w.idf.get(t);
  if (v !== undefined) return v;
  let m = PESO_CACHE.get(w);
  if (!m) PESO_CACHE.set(w, (m = new Map()));
  let x = m.get(t);
  if (x === undefined) {
    // Con una falta, el peso de la palabra conocida más parecida.
    x = w.desconocido;
    for (const [k, y] of w.idf) if (casan(t, k) > 0) { x = y; break; }
    m.set(t, x);
  }
  return x;
}

function jaccardPonderado(
  pregunta: string[],
  pp: number[],
  ejemplo: string[],
  pe: number[],
  eq: (p: string, e: string) => number = casan,
): number {
  if (!pregunta.length || !ejemplo.length) return 0;
  const usados = new Set<number>();
  let suma = 0;
  pregunta.forEach((p, qi) => {
    let mejor = 0;
    let idx = -1;
    ejemplo.forEach((e, i) => {
      if (usados.has(i)) return;
      const c = eq(p, e);
      if (c > mejor) {
        mejor = c;
        idx = i;
      }
    });
    if (idx >= 0) {
      usados.add(idx);
      suma += mejor * Math.min(pp[qi], pe[idx]);
    }
  });
  const wq = pp.reduce((a, b) => a + b, 0);
  const we = pe.reduce((a, b) => a + b, 0);
  return suma / (wq + we - suma);
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
  const w = PESOS.get(candidatos);
  if (!w) {
    return candidatos
      .map((c) => ({ id: c.id, puntuacion: Math.max(0, ...c.ejemplos.map((e) => parecido(p, e))) }))
      .sort((a, b) => b.puntuacion - a.puntuacion);
  }
  const pp = p.terminos.map((t) => peso(t, w));
  const eqs = p.terminos.map((t) => equivalentes(t, w));
  const eqDe = new Map(p.terminos.map((t, i) => [t, eqs[i]]));
  const eq = (a: string, b: string) => (a === b ? 1 : (eqDe.get(a)?.get(b) ?? 0));
  // Solo pueden puntuar las intenciones que comparten alguna palabra (exacta o con falta) con la pregunta.
  const vivos = new Set<number>();
  for (const m of eqs) for (const k of m.keys()) for (const i of w.indice.get(k) ?? []) vivos.add(i);
  return candidatos
    .map((c, i) => ({
      id: c.id,
      puntuacion: !vivos.has(i)
        ? 0
        : Math.max(
            0,
            ...c.ejemplos.map((e) => 0.8 * jaccardPonderado(p.terminos, pp, e.terminos, w.pesosEjemplo.get(e)!, eq) + 0.2 * jaccard(p.trigramas, e.trigramas)),
          ),
    }))
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
