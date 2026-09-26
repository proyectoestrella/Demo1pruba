/**
 * Periodos de la analítica: cortes de día, semana y mes, y las métricas que
 * se calculan sobre ellos.
 *
 * Todo lo de aquí son funciones puras: reciben las citas y una fecha "ahora",
 * y devuelven números. Ningún componente calcula nada por su cuenta, para que
 * los cortes se puedan probar y para que la pantalla de inicio y la de
 * Analítica no puedan contarse dos historias distintas.
 *
 * Convenciones que no se negocian:
 * - La semana empieza en LUNES (España), no en domingo.
 * - Los cortes son de hora local del navegador; el panel se usa en España.
 * - Un rango es `[inicio, fin)`: el fin queda fuera, así dos periodos
 *   consecutivos no comparten ni un milisegundo.
 */

import type { Appointment, Employee } from "./mock/types";
import { franjasProfesional } from "./horario-equipo";
import { cobradoDeCita } from "./pagos";

export type PeriodoId = "hoy" | "semana" | "mes" | "personalizado";

export interface Rango {
  /** Primer instante incluido. */
  inicio: Date;
  /** Primer instante EXCLUIDO. */
  fin: Date;
}

/** Rango elegido a mano, guardado como fechas `AAAA-MM-DD` (sin hora, sin zona). */
export interface RangoPersonalizado {
  desde: string;
  hasta: string;
}

/* -------------------------------------------------------------------------
 * Cortes de calendario
 * ---------------------------------------------------------------------- */

export function inicioDeDia(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function finDeDia(d: Date): Date {
  const out = inicioDeDia(d);
  out.setDate(out.getDate() + 1);
  return out;
}

/** Lunes de la semana de `d`, a las 00:00. */
export function inicioDeSemana(d: Date): Date {
  const out = inicioDeDia(d);
  // getDay(): 0 domingo … 6 sábado. Queremos retroceder hasta el lunes.
  const desdeLunes = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - desdeLunes);
  return out;
}

/** Día 1 del mes de `d`, a las 00:00. */
export function inicioDeMes(d: Date): Date {
  const out = inicioDeDia(d);
  out.setDate(1);
  return out;
}

/**
 * Suma meses conservando el día 1. Se usa siempre sobre un inicio de mes, así
 * que no hay que defenderse del 31 de enero → 31 de febrero.
 */
function sumarMeses(d: Date, n: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

function sumarDias(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** `AAAA-MM-DD` de una fecha, en hora local (no en UTC: `toISOString` se va de día). */
export function claveDeDia(d: Date): string {
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Interpreta `AAAA-MM-DD` como medianoche LOCAL. `new Date("2026-09-20")` sería UTC. */
export function deClaveDeDia(clave: string): Date {
  const [a, m, d] = clave.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

/* -------------------------------------------------------------------------
 * Rango del periodo elegido y su comparación
 * ---------------------------------------------------------------------- */

export function rangoDePeriodo(
  id: PeriodoId,
  now: Date = new Date(),
  personalizado?: RangoPersonalizado | null,
): Rango {
  switch (id) {
    case "hoy":
      return { inicio: inicioDeDia(now), fin: finDeDia(now) };
    case "semana": {
      const inicio = inicioDeSemana(now);
      return { inicio, fin: sumarDias(inicio, 7) };
    }
    case "mes": {
      const inicio = inicioDeMes(now);
      return { inicio, fin: sumarMeses(inicio, 1) };
    }
    case "personalizado": {
      if (!personalizado) return { inicio: inicioDeDia(now), fin: finDeDia(now) };
      // Si las fechas vienen al revés, se ordenan en vez de devolver un rango vacío.
      const a = deClaveDeDia(personalizado.desde);
      const b = deClaveDeDia(personalizado.hasta);
      const [ini, fin] = +a <= +b ? [a, b] : [b, a];
      return { inicio: ini, fin: finDeDia(fin) };
    }
  }
}

/**
 * El periodo anterior con el que se compara, derivado del elegido — nunca
 * escrito a mano en un componente.
 *
 * Y la parte que evita mentir: si el periodo elegido está EN CURSO (hoy a
 * medias, una semana por la mitad, un mes recién empezado), el anterior se
 * recorta al mismo tramo. Comparar 5 días de este mes contra los 31 del
 * anterior daría un "-84 %" que no significa nada.
 */
export function rangoAnterior(id: PeriodoId, rango: Rango, now: Date = new Date()): Rango {
  let inicio: Date;
  let fin: Date;
  switch (id) {
    case "hoy":
      inicio = sumarDias(rango.inicio, -1);
      fin = sumarDias(rango.fin, -1);
      break;
    case "semana":
      inicio = sumarDias(rango.inicio, -7);
      fin = sumarDias(rango.fin, -7);
      break;
    case "mes":
      inicio = sumarMeses(rango.inicio, -1);
      fin = rango.inicio;
      break;
    case "personalizado": {
      const duracion = +rango.fin - +rango.inicio;
      inicio = new Date(+rango.inicio - duracion);
      fin = new Date(rango.inicio);
      break;
    }
  }
  const transcurrido = +now - +rango.inicio;
  if (transcurrido > 0 && +now < +rango.fin) {
    const recorte = new Date(+inicio + transcurrido);
    if (+recorte < +fin) fin = recorte;
  }
  return { inicio, fin };
}

/** ¿El periodo elegido sigue corriendo ahora mismo? */
export function enCurso(rango: Rango, now: Date = new Date()): boolean {
  return +now >= +rango.inicio && +now < +rango.fin;
}

/**
 * Los `n` periodos anteriores al elegido, del más antiguo al más reciente,
 * incluido el propio. Alimenta la minigráfica sin inventarse cubos: para
 * "mes" son meses de calendario de verdad, no bloques de 30 días.
 */
export function periodosPrevios(id: PeriodoId, rango: Rango, n: number): Rango[] {
  const out: Rango[] = [];
  for (let i = n - 1; i >= 0; i--) {
    switch (id) {
      case "hoy":
        out.push({ inicio: sumarDias(rango.inicio, -i), fin: sumarDias(rango.fin, -i) });
        break;
      case "semana":
        out.push({ inicio: sumarDias(rango.inicio, -7 * i), fin: sumarDias(rango.fin, -7 * i) });
        break;
      case "mes": {
        const inicio = sumarMeses(rango.inicio, -i);
        out.push({ inicio, fin: sumarMeses(inicio, 1) });
        break;
      }
      case "personalizado": {
        const duracion = +rango.fin - +rango.inicio;
        out.push({
          inicio: new Date(+rango.inicio - duracion * i),
          fin: new Date(+rango.fin - duracion * i),
        });
        break;
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------
 * Etiquetas en español
 * ---------------------------------------------------------------------- */

export const ETIQUETA_PERIODO: Record<PeriodoId, string> = {
  hoy: "Hoy",
  semana: "Esta semana",
  mes: "Este mes",
  personalizado: "Fechas",
};

const FECHA_CORTA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const FECHA_LARGA = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "20 sept" · "20 sept – 26 sept" — el último día del rango, que es inclusivo. */
export function textoRango(rango: Rango): string {
  const ultimo = sumarDias(rango.fin, -1);
  if (claveDeDia(rango.inicio) === claveDeDia(ultimo)) return FECHA_LARGA.format(rango.inicio);
  return `${FECHA_CORTA.format(rango.inicio)} – ${FECHA_CORTA.format(ultimo)}`;
}

/** Días naturales que abarca el rango (el fin es exclusivo). */
export function diasDelRango(rango: Rango): number {
  return Math.max(1, Math.round((+rango.fin - +rango.inicio) / 86_400_000));
}

/**
 * Contra qué se está comparando, dicho en voz alta. Cambia cuando el periodo
 * va a medias, porque entonces la comparación tampoco es la obvia.
 */
export function textoComparacion(id: PeriodoId, rango: Rango, now: Date = new Date()): string {
  const parcial = enCurso(rango, now);
  switch (id) {
    case "hoy":
      return parcial ? "vs. ayer a esta hora" : "vs. ayer";
    case "semana":
      return parcial ? "vs. la semana pasada a estas alturas" : "vs. la semana pasada";
    case "mes":
      return parcial ? "vs. el mes pasado a estas alturas" : "vs. el mes pasado";
    case "personalizado": {
      const dias = diasDelRango(rango);
      return dias === 1 ? "vs. el día anterior" : `vs. los ${dias} días anteriores`;
    }
  }
}

/* -------------------------------------------------------------------------
 * Métricas del periodo
 * ---------------------------------------------------------------------- */

/** ¿Cae esta cita dentro del rango? */
/**
 * Citas ordenadas por inicio, una vez por lista (barrido de calidad
 * 2026-09-26). `resumenDePeriodo` mira 10 rangos (actual, previo y 8 cubos
 * de la minigráfica) y antes cada uno recorría y parseaba las 3.300 citas;
 * ahora cada rango es una búsqueda binaria y un trozo. Las citas sin fecha
 * legible no caen en ningún rango, igual que antes.
 */
const ordenPorLista = new WeakMap<Appointment[], { ms: Float64Array; citas: Appointment[] }>();
function ordenadas(appts: Appointment[]) {
  let o = ordenPorLista.get(appts);
  if (!o) {
    const pares: Array<[number, Appointment]> = [];
    for (const a of appts) {
      const t = +new Date(a.start);
      if (Number.isFinite(t)) pares.push([t, a]);
    }
    pares.sort((x, y) => x[0] - y[0]);
    o = { ms: Float64Array.from(pares, (p) => p[0]), citas: pares.map((p) => p[1]) };
    ordenPorLista.set(appts, o);
  }
  return o;
}
function primeraPosicion(ms: Float64Array, t: number): number {
  let lo = 0;
  let hi = ms.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ms[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
/** Las citas con inicio en `[rango.inicio, rango.fin)`. */
function citasDelRango(appts: Appointment[], rango: Rango): Appointment[] {
  const o = ordenadas(appts);
  return o.citas.slice(primeraPosicion(o.ms, +rango.inicio), primeraPosicion(o.ms, +rango.fin));
}

/** Huecos de media hora que el equipo tiene abiertos en el rango, día a día. */
export function capacidadDelRango(rango: Rango, equipo: Employee[]): number {
  let slots = 0;
  const d = new Date(rango.inicio);
  while (+d < +rango.fin) {
    const dia = d.getDay();
    for (const e of equipo) {
      slots += franjasProfesional(e, dia).reduce((total, jornada) => total + (jornada.end - jornada.start) / 30, 0);
    }
    d.setDate(d.getDate() + 1);
  }
  return slots;
}

export interface MetricasPeriodo {
  /** Citas no canceladas del periodo. */
  citas: number;
  /** Euros de las citas que no son plantón. */
  caja: number;
  /** % de la capacidad del equipo ocupado, 0–100. `null` si el equipo no abre en el rango. */
  ocupacion: number | null;
  /** Personas cuya PRIMERA cita de todo el histórico cae dentro del periodo. */
  clientesNuevos: number;
  /** Citas canceladas con fecha dentro del periodo. */
  cancelaciones: number;
}

export const METRICAS_VACIAS: MetricasPeriodo = {
  citas: 0,
  caja: 0,
  ocupacion: 0,
  clientesNuevos: 0,
  cancelaciones: 0,
};

/**
 * Fecha de la primera cita de cada cliente en todo el histórico. Se calcula
 * una vez por lista de citas y se reutiliza en todos los periodos: es lo que
 * evita recorrer el histórico entero por cada tarjeta y por cada cubo de la
 * minigráfica.
 */
const primerasPorLista = new WeakMap<Appointment[], Map<string, number>>();
export function primerasCitas(appts: Appointment[]): Map<string, number> {
  // La store sustituye el array en cada cambio: su identidad es la versión de los datos.
  const hecho = primerasPorLista.get(appts);
  if (hecho) return hecho;
  const out = new Map<string, number>();
  primerasPorLista.set(appts, out);
  for (const a of appts) {
    if (a.status === "cancelled" || a.status === "blocked") continue;
    if (!a.clientId) continue;
    const t = +new Date(a.start);
    const previo = out.get(a.clientId);
    if (previo === undefined || t < previo) out.set(a.clientId, t);
  }
  return out;
}

export function metricasDePeriodo(
  appts: Appointment[],
  rango: Rango,
  equipo: Employee[],
  primeras: Map<string, number> = primerasCitas(appts),
  /**
   * Lo cobrado real por cita (`agruparPagosPorCita`, lib/pagos.ts). Sin este
   * mapa, `caja` sigue siendo `priceEur` como hasta hoy — es responsabilidad
   * de quien llama pasarlo solo cuando el salón ya usa Caja.
   */
  pagosPorCita?: Map<string, number>,
): MetricasPeriodo {
  let citas = 0;
  let caja = 0;
  let minutos = 0;
  let cancelaciones = 0;
  const nuevos = new Set<string>();

  for (const a of citasDelRango(appts, rango)) {
    if (a.status === "cancelled") {
      cancelaciones += 1;
      continue;
    }
    if (a.status === "blocked") continue;
    citas += 1;
    minutos += a.duration;
    if (a.status !== "no-show") caja += pagosPorCita ? cobradoDeCita(a.id, pagosPorCita, a.priceEur) : a.priceEur;
    const primera = primeras.get(a.clientId);
    if (primera !== undefined && primera >= +rango.inicio && primera < +rango.fin) {
      nuevos.add(a.clientId);
    }
  }

  const capacidad = capacidadDelRango(rango, equipo);
  return {
    citas,
    caja,
    ocupacion: capacidad > 0 ? Math.min(100, Math.round((minutos / 30 / capacidad) * 100)) : null,
    clientesNuevos: nuevos.size,
    cancelaciones,
  };
}

/* -------------------------------------------------------------------------
 * Comparación honesta
 * ---------------------------------------------------------------------- */

export interface Comparacion {
  /** Valor del periodo elegido. */
  valor: number;
  /** Valor del periodo anterior equivalente, o `null` si no hay con qué comparar. */
  anterior: number | null;
  /**
   * Variación en %, redondeada. `null` cuando NO se puede afirmar nada:
   * el periodo anterior estaba vacío o no existía. Nadie rellena este hueco
   * con un número de adorno — si es `null`, la tarjeta lo dice.
   */
  variacionPct: number | null;
}

export function comparar(valor: number, anterior: number | null): Comparacion {
  if (anterior === null || anterior === 0) {
    return { valor, anterior, variacionPct: null };
  }
  return { valor, anterior, variacionPct: Math.round(((valor - anterior) / anterior) * 100) };
}

export interface ResumenPeriodo {
  id: PeriodoId;
  rango: Rango;
  rangoPrevio: Rango;
  parcial: boolean;
  textoRango: string;
  textoComparacion: string;
  actual: MetricasPeriodo;
  previo: MetricasPeriodo;
  /** ¿Hubo alguna actividad en el periodo anterior? Si no, no hay nada que comparar. */
  hayComparacion: boolean;
  /**
   * El equipo no abre ni un solo día del periodo elegido. Un domingo con el
   * salón cerrado da cero citas y cero caja, y comparar ese cero contra el
   * sábado sale "-100 %": cierto, pero cuenta como hundimiento del negocio
   * algo que es el horario de siempre. Cuando esto es `true` las tarjetas no
   * enseñan variación y lo dicen con todas las letras.
   */
  cerrado: boolean;
  /** Series para las minigráficas, del cubo más antiguo al actual. */
  series: {
    citas: number[];
    caja: number[];
    ocupacion: number[];
    clientesNuevos: number[];
  };
}

const CUBOS_MINIGRAFICA = 8;

/**
 * Todo lo que necesita la fila de tarjetas, de una sola pasada. Es la única
 * puerta de entrada que usan los componentes.
 */
export function resumenDePeriodo(
  appts: Appointment[],
  id: PeriodoId,
  equipo: Employee[],
  now: Date = new Date(),
  personalizado?: RangoPersonalizado | null,
  /** Igual que en `metricasDePeriodo`: opcional, mismo fallback a `priceEur`. */
  pagosPorCita?: Map<string, number>,
): ResumenPeriodo {
  const rango = rangoDePeriodo(id, now, personalizado);
  const rangoPrevio = rangoAnterior(id, rango, now);
  const primeras = primerasCitas(appts);

  const actual = metricasDePeriodo(appts, rango, equipo, primeras, pagosPorCita);
  const previoVacio = +rangoPrevio.fin <= +rangoPrevio.inicio;
  const previo = previoVacio
    ? METRICAS_VACIAS
    : metricasDePeriodo(appts, rangoPrevio, equipo, primeras, pagosPorCita);

  const cubos = periodosPrevios(id, rango, CUBOS_MINIGRAFICA).map((r) =>
    metricasDePeriodo(appts, r, equipo, primeras, pagosPorCita),
  );

  return {
    id,
    rango,
    rangoPrevio,
    parcial: enCurso(rango, now),
    textoRango: textoRango(rango),
    textoComparacion: textoComparacion(id, rango, now),
    actual,
    previo,
    hayComparacion:
      !previoVacio && (previo.citas > 0 || previo.caja > 0 || previo.cancelaciones > 0),
    cerrado: capacidadDelRango(rango, equipo) === 0,
    series: {
      citas: cubos.map((m) => m.citas),
      caja: cubos.map((m) => m.caja),
      ocupacion: cubos.map((m) => m.ocupacion ?? 0),
      clientesNuevos: cubos.map((m) => m.clientesNuevos),
    },
  };
}
