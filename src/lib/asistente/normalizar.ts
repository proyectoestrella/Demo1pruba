/**
 * Normalización del texto de una pregunta para el asistente «inteligente sin
 * IA» (lote 7). Todo lo demás (parecido, entidades, intenciones) trabaja sobre
 * lo que sale de aquí, así que una dueña que escribe «q citas tngo mñn» y otra
 * que escribe «¿Qué citas tengo mañana?» acaban en el mismo sitio.
 *
 * Funciones puras, sin dependencias.
 */

/** Minúsculas y sin tildes. La «ñ» pasa a «n»: «manana» y «mañana» deben coincidir. */
export function sinTildes(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Abreviaturas y formas de chat → palabra completa (ya sin tildes). Se
 * aplican por palabra entera, nunca dentro de otra.
 */
export const ABREVIATURAS: Record<string, string> = {
  q: "que", k: "que", ke: "que", qe: "que",
  xq: "por que", pq: "por que", porq: "por que", xk: "por que", pk: "por que",
  x: "por", xa: "para", pa: "para", pra: "para",
  d: "de", dl: "del",
  tb: "tambien", tmb: "tambien", tbn: "tambien",
  mnn: "manana", mn: "manana", mna: "manana",
  kien: "quien", qien: "quien", kn: "quien",
  dnd: "donde", cdo: "cuando", qdo: "cuando", cnd: "cuando",
  cto: "cuanto", cta: "cuanta", ctos: "cuantos", ctas: "cuantas",
  tngo: "tengo", tng: "tengo", tgo: "tengo",
  hy: "hoy", oy: "hoy",
  finde: "fin de semana",
  sem: "semana", sema: "semana",
  prox: "proxima", proxi: "proxima", sig: "siguiente", sigte: "siguiente",
  ult: "ultima", ultm: "ultima",
  hrs: "horas", hs: "horas", hr: "hora",
  mins: "minutos", min: "minutos",
  clta: "clienta", cltas: "clientas", cli: "clienta",
  msj: "mensaje", wsp: "whatsapp", wasap: "whatsapp", whats: "whatsapp", guasap: "whatsapp",
  tlf: "telefono", tel: "telefono", tfno: "telefono",
  pf: "por favor", porfa: "por favor", xfa: "por favor", xfavor: "por favor",
  ok: "vale", oki: "vale", okey: "vale",
  gracia: "gracias", grax: "gracias", thx: "gracias",
  eur: "euros", pavos: "euros", pelas: "euros",
};

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const DECENAS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const CENTENAS: Record<string, number> = { cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500 };

/**
 * «treinta y cinco» → «35», «doscientos» → «200». «una» no se toca: casi
 * siempre es artículo («una cita»); las entidades ya lo tratan como 1 donde
 * toca («en una hora»).
 */
export function numerosEnCifras(palabras: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < palabras.length; i++) {
    const p = palabras[i];
    let valor: number | null = null;
    let consumidas = 1;
    if (p in CENTENAS) {
      valor = CENTENAS[p];
      const siguiente = numerosEnCifras(palabras.slice(i + 1, i + 4));
      const n = Number(siguiente[0]);
      if (Number.isFinite(n) && n < 100 && siguiente[0] !== palabras[i + 1]) {
        valor += n;
        consumidas += palabras.slice(i + 1, i + 4).length - (siguiente.length - 1);
      }
    } else if (p in DECENAS) {
      valor = DECENAS[p];
      if (palabras[i + 1] === "y" && palabras[i + 2] in UNIDADES && UNIDADES[palabras[i + 2]] < 10) {
        valor += UNIDADES[palabras[i + 2]];
        consumidas = 3;
      }
    } else if (p in UNIDADES && p !== "un") {
      valor = UNIDADES[p];
    }
    if (valor === null) out.push(p);
    else {
      out.push(String(valor));
      i += consumidas - 1;
    }
  }
  return out;
}

/**
 * Texto normalizado: sin tildes, sin signos (se conservan los dígitos, los
 * dos puntos de una hora «17:30» y la barra de una fecha «5/10»), con las
 * abreviaturas expandidas y los números en cifras.
 */
export function normalizar(texto: string): string {
  const limpio = sinTildes(texto)
    .replace(/€/g, " euros ")
    .replace(/(\d)[.,](\d)/g, "$1.$2") // 12,5 → 12.5
    .replace(/[^a-z0-9:/.\s]/g, " ")
    .replace(/(?<!\d)[.:/]|[.:/](?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const palabras = limpio
    .split(" ")
    .filter(Boolean)
    .flatMap((p) => (ABREVIATURAS[p] ?? p).split(" "));
  return numerosEnCifras(palabras).join(" ");
}

/** Palabras vacías: no aportan a decidir la intención. «no», «mas», «menos» y los interrogativos SÍ se quedan. */
export const PALABRAS_VACIAS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "en", "y", "o", "u",
  "me", "te", "se", "nos", "le", "les", "lo", "mi", "mis", "tu", "tus", "su", "sus", "es", "son", "esta", "este",
  "estan", "hay", "ha", "han", "he", "hemos", "por", "para", "con", "sin", "sobre", "que", "si", "ya", "pues",
  "vale", "bueno", "oye", "dime", "dame", "puedes", "podrias", "quiero", "saber", "favor", "gracias", "hola",
  "tengo", "tenemos", "tiene", "tienen", "ver", "mira", "porfa", "algo", "algun", "alguna", "alguno",
]);

/**
 * Raíz ligera en español: quita plurales y derivados frecuentes para que
 * «citas», «cita»; «cancelaciones», «cancelacion», «cancelada»; «clientas»,
 * «clientes» caigan juntos. No pretende ser un stemmer completo.
 */
export function raiz(palabra: string): string {
  let p = palabra;
  if (p.length <= 3 || /^\d/.test(p)) return p;
  const sufijos = [
    "aciones", "iciones", "amientos", "imientos", "amiento", "imiento", "acion", "icion",
    "idades", "idad", "mente", "adoras", "adores", "adora", "ador", "istas", "ista",
    "ando", "iendo", "adas", "idas", "ados", "idos", "ada", "ida", "ado", "ido",
    // Verbos en tercera persona, los más frecuentes en preguntas («vienen», «cuestan», «vinieron»).
    "ieron", "aron", "aban", "ian", "an", "en",
    "eses", "es", "s",
  ];
  if (p.endsWith("ces") && p.length >= 5) return `${p.slice(0, -3)}z`; // veces → vez, luces → luz
  for (const s of sufijos) {
    if (p.endsWith(s) && p.length - s.length >= 3) {
      p = p.slice(0, -s.length);
      break;
    }
  }
  // Género: cliente/clienta/cliento → client; cita/cito se quedan en «cit».
  if (p.length > 4 && /[aeo]$/.test(p)) p = p.slice(0, -1);
  return p;
}

/** Palabras con significado (sin vacías), normalizadas. */
export function palabras(texto: string): string[] {
  return normalizar(texto).split(" ").filter((p) => p && !PALABRAS_VACIAS.has(p));
}

/** Raíces de las palabras con significado. */
export function raices(texto: string): string[] {
  return palabras(texto).map(raiz);
}
