/**
 * Entidades de una pregunta al asistente (lote 7): fecha o periodo, franja,
 * hora, número, profesional, servicio y clienta. Todo sobre el texto
 * normalizado y en la zona horaria del salón.
 *
 * Las fechas se calculan como días del calendario («AAAA-MM-DD») con
 * aritmética en UTC: un cambio de hora nunca desplaza un día.
 *
 * Regla de oro con las clientas: solo por palabras de su NOMBRE (nunca por
 * nota ni teléfono) y, si hay más de una posible, se pregunta. Nunca se
 * responde con los datos de otra clienta.
 */
import type { Client, Employee, Service } from "../mock/types";
import { ZONA_HORARIA_SALON, fechaEnZona } from "../zona-horaria";
import { normalizar, PALABRAS_VACIAS } from "./normalizar";
import { damerau, SINONIMOS } from "./parecido";

/* ------------------------------------------------------------------------ */
/* Calendario                                                               */
/* ------------------------------------------------------------------------ */

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

function aUtc(dia: string): number {
  const [y, m, d] = dia.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function deUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
/** Suma días a un «AAAA-MM-DD». */
export function sumarDias(dia: string, n: number): string {
  return deUtc(aUtc(dia) + n * 86_400_000);
}
/** 0 = domingo … 6 = sábado. */
export function diaSemana(dia: string): number {
  return new Date(aUtc(dia)).getUTCDay();
}
function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000) + 1;
}
function ultimoDiaDelMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function dia2(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
/** «sábado 27 sept» */
export function etiquetaDia(dia: string): string {
  const [, m, d] = dia.split("-").map(Number);
  return `${DIAS[diaSemana(dia)].replace("miercoles", "miércoles").replace("sabado", "sábado")} ${d} ${MESES_CORTOS[m - 1]}`;
}

export type Fecha =
  | { tipo: "dia"; dia: string; etiqueta: string }
  | { tipo: "periodo"; desde: string; hasta: string; dias: number; etiqueta: string };

function dia(d: string, etiqueta?: string): Fecha {
  return { tipo: "dia", dia: d, etiqueta: etiqueta ?? etiquetaDia(d) };
}
function periodo(desde: string, hasta: string, etiqueta: string): Fecha {
  return { tipo: "periodo", desde, hasta, dias: diasEntre(desde, hasta), etiqueta };
}

/** Lunes de la semana de un día (la semana va de lunes a domingo). */
function lunesDe(d: string): string {
  return sumarDias(d, -((diaSemana(d) + 6) % 7));
}

export interface Franja {
  desdeMin: number;
  hastaMin: number;
  etiqueta: string;
}

/**
 * Fecha o periodo de la pregunta y franja («por la tarde»). Devuelve también
 * el texto sin lo que ya se ha reconocido, para que el nombre de una clienta
 * no se confunda con «sábado» o «septiembre».
 */
export function extraerFecha(
  texto: string,
  ahora: Date = new Date(),
  timeZone: string = ZONA_HORARIA_SALON,
): { fecha: Fecha | null; franja: Franja | null; resto: string } {
  let t = ` ${normalizar(texto)} `;
  const hoy = fechaEnZona(ahora, timeZone);
  const [anio, mesHoy] = hoy.split("-").map(Number);
  let fecha: Fecha | null = null;
  let franja: Franja | null = null;
  const quitar = (re: RegExp) => { t = t.replace(re, " "); };
  const probar = (re: RegExp, f: (m: RegExpMatchArray) => Fecha | null) => {
    if (fecha) return;
    const m = t.match(re);
    if (!m) return;
    const r = f(m);
    if (r) { fecha = r; quitar(re); }
  };

  // Franjas primero: «por la mañana» no es el día de mañana.
  if (/\b(?:esta manana)\b/.test(t)) { franja = { desdeMin: 0, hastaMin: 14 * 60, etiqueta: "por la mañana" }; fecha = dia(hoy, "hoy"); quitar(/\besta manana\b/); }
  if (/\besta tarde\b/.test(t)) { franja = { desdeMin: 14 * 60, hastaMin: 24 * 60, etiqueta: "por la tarde" }; fecha = dia(hoy, "hoy"); quitar(/\besta tarde\b/); }
  if (/\b(?:por|de|en) (?:la|las) mananas?\b/.test(t)) { franja = { desdeMin: 0, hastaMin: 14 * 60, etiqueta: "por la mañana" }; quitar(/\b(?:por|de|en) (?:la|las) mananas?\b/); }
  if (/\b(?:por|de|en) (?:la|las) tardes?\b/.test(t)) { franja = { desdeMin: 14 * 60, hastaMin: 24 * 60, etiqueta: "por la tarde" }; quitar(/\b(?:por|de|en) (?:la|las) tardes?\b/); }
  const horas = t.match(/\bde (\d{1,2})(?::(\d{2}))? a (\d{1,2})(?::(\d{2}))?\b(?! de (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))/);
  if (horas && Number(horas[1]) <= 24 && Number(horas[3]) <= 24 && Number(horas[3]) > Number(horas[1])) {
    franja = { desdeMin: Number(horas[1]) * 60 + Number(horas[2] ?? 0), hastaMin: Number(horas[3]) * 60 + Number(horas[4] ?? 0), etiqueta: `de ${horas[1]}${horas[2] ? `:${horas[2]}` : ""} a ${horas[3]}${horas[4] ? `:${horas[4]}` : ""}` };
    quitar(new RegExp(horas[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const numMes = (nombre: string) => MESES.indexOf(nombre) + 1;
  const reMes = MESES.join("|");

  // Rangos de días: «del 5 al 9 de octubre», «del 28 de septiembre al 3 de octubre».
  probar(new RegExp(`\\bdel? (\\d{1,2})(?: de (${reMes}))? al? (\\d{1,2}) de (${reMes})\\b`), (m) => {
    const m2 = numMes(m[4]);
    const m1 = m[2] ? numMes(m[2]) : m2;
    const desde = dia2(anio, m1, Number(m[1]));
    const hasta = dia2(anio, m2, Number(m[3]));
    return aUtc(hasta) >= aUtc(desde) ? periodo(desde, hasta, `del ${Number(m[1])} ${MESES_CORTOS[m1 - 1]} al ${Number(m[3])} ${MESES_CORTOS[m2 - 1]}`) : null;
  });
  // «últimos 30 días», «últimas 2 semanas».
  probar(/\bultim[oa]s (\d{1,3}) (dias|semanas|meses)\b/, (m) => {
    const n = Number(m[1]) * (m[2] === "semanas" ? 7 : m[2] === "meses" ? 30 : 1);
    return periodo(sumarDias(hoy, -(n - 1)), hoy, `los últimos ${n} días`);
  });
  probar(/\bultima semana\b/, () => periodo(sumarDias(hoy, -6), hoy, "los últimos 7 días"));
  probar(/\bultimo mes\b/, () => periodo(sumarDias(hoy, -29), hoy, "los últimos 30 días"));
  // Semanas.
  probar(/\b(?:la )?semana (?:que viene|proxima|siguiente)\b|\bproxima semana\b/, () => {
    const l = sumarDias(lunesDe(hoy), 7);
    return periodo(l, sumarDias(l, 6), "la semana que viene");
  });
  probar(/\b(?:la )?semana pasada\b|\bla semana anterior\b/, () => {
    const l = sumarDias(lunesDe(hoy), -7);
    return periodo(l, sumarDias(l, 6), "la semana pasada");
  });
  probar(/\b(?:esta|toda la) semana\b/, () => periodo(lunesDe(hoy), sumarDias(lunesDe(hoy), 6), "esta semana"));
  probar(/\b(?:este |el )?fin de semana\b/, () => {
    const s = sumarDias(lunesDe(hoy), 5);
    return periodo(s, sumarDias(s, 1), "este fin de semana");
  });
  // Meses.
  probar(/\b(?:el )?mes (?:que viene|proximo|siguiente)\b|\bproximo mes\b/, () => {
    const [y, m] = mesHoy === 12 ? [anio + 1, 1] : [anio, mesHoy + 1];
    return periodo(dia2(y, m, 1), dia2(y, m, ultimoDiaDelMes(y, m)), MESES[m - 1]);
  });
  probar(/\b(?:el )?mes pasado\b|\bmes anterior\b/, () => {
    const [y, m] = mesHoy === 1 ? [anio - 1, 12] : [anio, mesHoy - 1];
    return periodo(dia2(y, m, 1), dia2(y, m, ultimoDiaDelMes(y, m)), MESES[m - 1]);
  });
  probar(/\beste mes\b|\bmes actual\b|\bde mes\b/, () => periodo(dia2(anio, mesHoy, 1), dia2(anio, mesHoy, ultimoDiaDelMes(anio, mesHoy)), "este mes"));
  probar(/\beste ano\b|\bano actual\b/, () => periodo(dia2(anio, 1, 1), dia2(anio, 12, 31), `${anio}`));
  probar(/\bano pasado\b/, () => periodo(dia2(anio - 1, 1, 1), dia2(anio - 1, 12, 31), `${anio - 1}`));
  // Días sueltos.
  probar(/\bpasado manana\b/, () => dia(sumarDias(hoy, 2), "pasado mañana"));
  probar(/\banteayer\b|\bantes de ayer\b/, () => dia(sumarDias(hoy, -2), "anteayer"));
  probar(/\bayer\b/, () => dia(sumarDias(hoy, -1), "ayer"));
  probar(/\bmanana\b/, () => dia(sumarDias(hoy, 1), "mañana"));
  probar(/\bhoy\b|\bahora\b|\besta noche\b/, () => dia(hoy, "hoy"));
  // «el 3 de octubre», «3/10», «03-10».
  probar(new RegExp(`\\b(?:el )?(\\d{1,2}) de (${reMes})\\b`), (m) => dia(dia2(anio, numMes(m[2]), Number(m[1]))));
  probar(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/, (m) => {
    const d = Number(m[1]);
    const mes = Number(m[2]);
    if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : anio;
    return dia(dia2(y, mes, d));
  });
  // Un mes a secas: «septiembre», «en octubre».
  probar(new RegExp(`\\b(${reMes})\\b`), (m) => {
    const mes = numMes(m[1]);
    return periodo(dia2(anio, mes, 1), dia2(anio, mes, ultimoDiaDelMes(anio, mes)), MESES[mes - 1]);
  });
  // Día de la semana: el próximo, o el de hoy si hoy es ese día; «pasado» mira atrás.
  probar(/\b(?:el )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?: (pasado|que viene|proximo))?\b/, (m) => {
    const objetivo = DIAS.indexOf(m[1]);
    const hoyDs = diaSemana(hoy);
    if (m[2] === "pasado") return dia(sumarDias(hoy, -(((hoyDs - objetivo + 7) % 7) || 7)));
    const delta = (objetivo - hoyDs + 7) % 7;
    return dia(sumarDias(hoy, m[2] ? delta || 7 : delta));
  });
  // «el 3»: el próximo día 3 (este mes si no ha pasado).
  probar(/\bel (\d{1,2})\b(?! de )(?!:)/, (m) => {
    const d = Number(m[1]);
    if (d < 1 || d > 31) return null;
    const [, , dHoy] = hoy.split("-").map(Number);
    const [y, mes] = d >= dHoy ? [anio, mesHoy] : mesHoy === 12 ? [anio + 1, 1] : [anio, mesHoy + 1];
    return d <= ultimoDiaDelMes(y, mes) ? dia(dia2(y, mes, d)) : null;
  });

  return { fecha, franja, resto: t.replace(/\s+/g, " ").trim() };
}

/** Hora suelta en minutos: «a las 17», «17:30», «a las 5 de la tarde». */
export function extraerHora(texto: string): number | null {
  const t = normalizar(texto);
  const m = t.match(/\b(?:a las|sobre las|las) (\d{1,2})(?::(\d{2}))?(?: (?:de la|por la) (tarde|noche))?\b/) ?? t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] && h < 12) h += 12;
  return h <= 24 && min < 60 ? h * 60 + min : null;
}

/** Primer número de la pregunta que no es parte de una hora ni de una fecha. */
export function extraerNumero(texto: string): number | null {
  const t = normalizar(texto).replace(/\b\d{1,2}[:/-]\d{1,2}\b/g, " ");
  const m = t.match(/\b(\d+(?:\.\d+)?)\b/);
  return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------------ */
/* Profesional, servicio y clienta                                          */
/* ------------------------------------------------------------------------ */

const sinAcentos = (s: string) => normalizar(s);

/** ¿Aparece esta palabra (o con una falta, si es larga) en la pregunta? */
function contienePalabra(palabras: string[], objetivo: string): boolean {
  return palabras.some((p) => p === objetivo || (objetivo.length >= 5 && p.length >= 5 && damerau(p, objetivo) <= 1));
}

/** Profesional por su nombre (primer nombre o completo). Si hay dos con el mismo nombre, las dos. */
export function extraerProfesional(texto: string, equipo: Employee[]): Employee[] {
  const palabras = normalizar(texto).split(" ");
  return equipo.filter((e) => {
    const nombre = sinAcentos(e.name).split(" ").filter(Boolean);
    return nombre.length > 0 && contienePalabra(palabras, nombre[0]);
  });
}

/** Alias de servicios de la especificación: palabra de la pregunta → palabras que buscar en el nombre. */
const ALIAS_SERVICIO: Record<string, string[]> = {
  tinte: ["tinte", "color", "coloracion", "tintar", "tenir"],
  mechas: ["mechas", "balayage", "reflejos", "babylights"],
  corte: ["corte", "cortar", "pelar", "pelado"],
  recogido: ["recogido", "mono", "semirecogido"],
  tratamiento: ["tratamiento", "hidratacion", "keratina", "capilar"],
  peinado: ["peinado", "peinar", "brushing", "secado"],
  novia: ["novia", "boda"],
  barba: ["barba", "afeitado", "perfilado"],
};

/**
 * Servicios de la carta que nombra la pregunta, por su nombre o por un alias
 * («color» encuentra «Tinte»). Varios si la pregunta nombra varios.
 */
export function extraerServicio(texto: string, servicios: Service[]): Service[] {
  const palabras = normalizar(texto).split(" ");
  const buscadas = new Set<string>();
  for (const [clave, alias] of Object.entries(ALIAS_SERVICIO)) {
    if (alias.some((a) => contienePalabra(palabras, a))) alias.concat(clave).forEach((a) => buscadas.add(a));
  }
  return servicios.filter((s) => {
    const nombre = sinAcentos(s.name).split(" ").filter((p) => p.length >= 4 && !PALABRAS_VACIAS.has(p));
    return nombre.some((p) => buscadas.has(p) || contienePalabra(palabras, p));
  });
}

/** Palabras que nunca son el nombre de una clienta (vocabulario del salón y de las preguntas). */
const NO_ES_NOMBRE = new Set<string>([
  ...PALABRAS_VACIAS,
  ...SINONIMOS.flat(),
  ...MESES, ...DIAS,
  "cuando", "cuanto", "cuanta", "cuantos", "cuantas", "quien", "quienes", "donde", "como", "cual", "cuales",
  "vino", "viene", "vienen", "venir", "volvio", "vuelve", "ultima", "ultimo", "vez", "veces", "lleva", "llevo",
  "hizo", "hecho", "hace", "ficha", "datos", "telefono", "notas", "gasta", "gastado", "frecuencia", "cada",
  "proxima", "proximo", "siguiente", "semana", "mes", "ano", "dia", "dias", "hoy", "manana", "ayer", "tarde",
  "noche", "hora", "horas", "minutos", "citas", "cita", "tiene", "tengo", "tenia", "dime", "dame", "sabes",
  "puedes", "quiero", "mira", "mirame", "busca", "buscame", "ensename", "abre", "abreme", "info", "informacion",
  "le", "la", "su", "sus", "de", "del", "que", "no", "si", "mas", "menos", "todas", "todos", "alguna", "alguien",
]);

export type ClientaEncontrada =
  | { tipo: "una"; clienta: Client }
  /** Varias posibles: hay que preguntar cuál. Nunca se elige sola. */
  | { tipo: "varias"; opciones: Client[]; buscado: string }
  | { tipo: "ninguna"; buscado: string };

/**
 * Clienta nombrada en la pregunta. Solo mira palabras que no son
 * vocabulario del salón, y solo compara con palabras del NOMBRE de cada
 * clienta. Si el nombre completo coincide con una sola, esa; si solo el nombre
 * de pila, y hay varias, se pregunta. `null` si la pregunta no nombra a nadie.
 * `excluir`: palabras ya usadas por otra entidad (una profesional llamada igual).
 */
export function extraerClienta(texto: string, clientes: Client[], excluir: string[] = []): ClientaEncontrada | null {
  const fuera = new Set([...NO_ES_NOMBRE, ...excluir.map(sinAcentos)]);
  const candidatas = normalizar(texto).split(" ").filter((p) => p.length >= 3 && !/^\d/.test(p) && !fuera.has(p));
  if (!candidatas.length) return null;
  const buscado = candidatas.join(" ");
  const puntos = clientes
    .map((c) => {
      const nombre = sinAcentos(c.name).split(" ").filter(Boolean);
      let exactas = 0;
      let conFalta = 0;
      for (const p of candidatas) {
        if (nombre.includes(p)) exactas++;
        else if (p.length >= 5 && nombre.some((n) => n.length >= 5 && damerau(n, p) <= 1)) conFalta++;
      }
      return { c, exactas, conFalta, total: exactas + conFalta };
    })
    .filter((x) => x.total > 0);
  if (!puntos.length) return { tipo: "ninguna", buscado };
  const mejor = Math.max(...puntos.map((x) => x.total * 10 + x.exactas));
  const empatadas = puntos.filter((x) => x.total * 10 + x.exactas === mejor).map((x) => x.c);
  if (empatadas.length === 1) return { tipo: "una", clienta: empatadas[0] };
  return { tipo: "varias", opciones: empatadas.slice(0, 5), buscado };
}

/* ------------------------------------------------------------------------ */
/* Todo junto                                                               */
/* ------------------------------------------------------------------------ */

export interface ContextoEntidades {
  clientes: Client[];
  equipo: Employee[];
  servicios: Service[];
  ahora?: Date;
  timeZone?: string;
}

export interface Entidades {
  fecha: Fecha | null;
  franja: Franja | null;
  hora: number | null;
  numero: number | null;
  profesionales: Employee[];
  servicios: Service[];
  clienta: ClientaEncontrada | null;
}

export function extraerEntidades(texto: string, ctx: ContextoEntidades): Entidades {
  const { fecha, franja, resto } = extraerFecha(texto, ctx.ahora, ctx.timeZone);
  const profesionales = extraerProfesional(resto, ctx.equipo);
  const servicios = extraerServicio(resto, ctx.servicios);
  const usadas = [
    ...profesionales.flatMap((e) => sinAcentos(e.name).split(" ")),
    ...servicios.flatMap((s) => sinAcentos(s.name).split(" ")),
    ...Object.values(ALIAS_SERVICIO).flat(),
  ];
  return {
    fecha,
    franja,
    hora: extraerHora(texto),
    numero: extraerNumero(resto),
    profesionales,
    servicios,
    clienta: extraerClienta(resto, ctx.clientes, usadas),
  };
}
