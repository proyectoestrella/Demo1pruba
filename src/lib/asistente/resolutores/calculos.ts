/** Cálculos comunes de los resolutores, sobre la instantánea del salón. */
import { diaEnZona, horaCorta } from "../reloj";
import { diaSemana, etiquetaDia, sumarDias } from "../entidades";
import type { CitaA, EstadoAsistente } from "../fuentes";
import type { Contexto, Rango } from "./tipos";

const FUERA = new Set(["cancelled", "blocked"]);

/** Cuenta como cita del salón (no anulada ni bloqueo de agenda). */
export function activa(c: CitaA): boolean {
  return !FUERA.has(c.status);
}

export function diaDe(c: CitaA, s: EstadoAsistente): string {
  return diaEnZona(c.start, s.timeZone);
}

/** «9:00», «17:30». */
export function hora(iso: string, s: EstadoAsistente): string {
  return horaCorta(iso, s.timeZone);
}

export function fin(c: CitaA): number {
  return Date.parse(c.start) + c.duration * 60_000;
}

/** Citas activas de un rango de días, ordenadas por hora. Índice por día cacheado por instantánea. */
const INDICE = new WeakMap<CitaA[], Map<string, CitaA[]>>();
export function porDia(s: EstadoAsistente): Map<string, CitaA[]> {
  let m = INDICE.get(s.citas);
  if (!m) {
    m = new Map();
    for (const c of s.citas) {
      const d = diaDe(c, s);
      let l = m.get(d);
      if (!l) m.set(d, (l = []));
      l.push(c);
    }
    for (const l of m.values()) l.sort((a, b) => a.start.localeCompare(b.start));
    INDICE.set(s.citas, m);
  }
  return m;
}

export function dias(r: Rango): string[] {
  const out: string[] = [];
  for (let d = r.desde; d <= r.hasta && out.length < 400; d = sumarDias(d, 1)) out.push(d);
  return out;
}

/** Todas las citas del rango (incluidas anuladas): filtra tú. */
export function citasDe(s: EstadoAsistente, r: Rango): CitaA[] {
  const m = porDia(s);
  return dias(r).flatMap((d) => m.get(d) ?? []);
}

export function citasDelDia(s: EstadoAsistente, dia: string): CitaA[] {
  return (porDia(s).get(dia) ?? []).filter(activa);
}

function primeroDeMes(hoy: string): string {
  return `${hoy.slice(0, 8)}01`;
}
function ultimoDeMes(hoy: string): string {
  const [a, m] = hoy.split("-").map(Number);
  const d = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${hoy.slice(0, 8)}${String(d).padStart(2, "0")}`;
}
export function esteMes(hoy: string): Rango {
  return { desde: primeroDeMes(hoy), hasta: ultimoDeMes(hoy), etiqueta: "este mes" };
}
export function mesPasado(hoy: string): Rango {
  const r = esteMes(sumarDias(primeroDeMes(hoy), -1));
  return { ...r, etiqueta: "el mes pasado" };
}
export function estaSemana(hoy: string): Rango {
  const l = sumarDias(hoy, -((diaSemana(hoy) + 6) % 7));
  return { desde: l, hasta: sumarDias(l, 6), etiqueta: "esta semana" };
}
export function soloHoy(hoy: string): Rango {
  return { desde: hoy, hasta: hoy, etiqueta: "hoy" };
}

/** El rango que nombra la pregunta, o el de por defecto de la intención. */
export function rangoDe(c: Contexto, porDefecto: (hoy: string) => Rango): Rango {
  const f = c.e.fecha;
  if (!f) return porDefecto(c.hoy);
  if (f.tipo === "dia") return { desde: f.dia, hasta: f.dia, etiqueta: etiquetaRelativa(f.dia, c.hoy) };
  return { desde: f.desde, hasta: f.hasta, etiqueta: f.etiqueta };
}

/** «hoy», «mañana», «ayer» o «el sábado 27 sept». */
export function etiquetaRelativa(dia: string, hoy: string): string {
  if (dia === hoy) return "hoy";
  if (dia === sumarDias(hoy, 1)) return "mañana";
  if (dia === sumarDias(hoy, -1)) return "ayer";
  return `el ${etiquetaDia(dia)}`;
}

export interface Dinero {
  cobrado: number;
  cobradas: number;
  previsto: number;
  previstas: number;
  porCobrar: number;
  realizadas: number;
  noVino: number;
}

/**
 * Cobrado = citas del rango con `paidAt`. Previsto = activas que aún no han
 * empezado y no están cobradas. Por cobrar = ya empezadas, sin cobrar ni plantón.
 */
export function dineroDe(citas: CitaA[], ahora: Date): Dinero {
  const t = ahora.getTime();
  const d: Dinero = { cobrado: 0, cobradas: 0, previsto: 0, previstas: 0, porCobrar: 0, realizadas: 0, noVino: 0 };
  for (const c of citas) {
    if (!activa(c)) continue;
    if (c.status === "no-show") { d.noVino++; continue; }
    if (c.paidAt) { d.cobrado += c.priceEur; d.cobradas++; }
    else if (Date.parse(c.start) > t) { d.previsto += c.priceEur; d.previstas++; }
    else d.porCobrar += c.priceEur;
    if (c.status === "completed" || c.paidAt) d.realizadas++;
  }
  return d;
}

/**
 * Ocupación: minutos citados entre minutos de jornada, por profesional.
 * `null` si no se conoce la jornada de nadie en el rango.
 */
export function ocupacion(c: Contexto, r: Rango, profesionalId?: string): { pct: number; libres: number; citados: number } | null {
  const equipo = profesionalId ? c.estado.equipo.filter((e) => e.id === profesionalId) : c.estado.equipo;
  let jornada = 0;
  let citados = 0;
  let conocida = false;
  for (const d of dias(r)) {
    const delDia = citasDelDia(c.estado, d).filter((x) => x.status !== "no-show");
    for (const e of equipo) {
      const j = c.fuentes.jornada(e.id, d);
      if (!j) continue;
      conocida = true;
      if (!j.trabaja) continue;
      jornada += j.franjas.reduce((s, f) => s + minutos(f.hasta) - minutos(f.desde), 0);
      citados += delDia.filter((x) => x.employeeId === e.id).reduce((s, x) => s + x.duration, 0);
    }
  }
  if (!conocida) return null;
  return { pct: jornada ? Math.min(100, Math.round((citados / jornada) * 100)) : 0, libres: Math.max(0, jornada - citados), citados };
}

export function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function nombreServicios(c: CitaA, s: EstadoAsistente): string {
  const n = c.serviceIds.map((id) => s.servicios.find((x) => x.id === id)?.name).filter((x): x is string => !!x);
  return n.length ? n.join(" + ") : "servicio sin nombre";
}

export function nombrePro(id: string, s: EstadoAsistente): string {
  const n = s.equipo.find((e) => e.id === id)?.name;
  return n ? n.split(" ")[0] : "sin asignar";
}

const RE_COLOR = /tint|color|mecha|balayage|decolor|matiz|reflej|ba[ñn]o/i;
export function esDeColor(c: CitaA, s: EstadoAsistente): boolean {
  return c.serviceIds.some((id) => {
    const sv = s.servicios.find((x) => x.id === id);
    return !!sv && RE_COLOR.test(`${sv.name} ${sv.category ?? ""}`);
  });
}

/** Visitas pasadas (hechas) de cada clienta: índice cacheado por instantánea. */
const VISITAS = new WeakMap<CitaA[], { t: number; m: Map<string, CitaA[]> }>();
export function visitasPorClienta(s: EstadoAsistente): Map<string, CitaA[]> {
  const hecho = VISITAS.get(s.citas);
  // Válido mientras no cambie el cuarto de hora de «ahora».
  let m = hecho && Math.floor(hecho.t / 900_000) === Math.floor(s.ahora.getTime() / 900_000) ? hecho.m : undefined;
  if (!m) {
    m = new Map();
    const t = s.ahora.getTime();
    for (const c of s.citas) {
      if (!activa(c) || c.status === "no-show" || Date.parse(c.start) > t) continue;
      let l = m.get(c.clientId);
      if (!l) m.set(c.clientId, (l = []));
      l.push(c);
    }
    for (const l of m.values()) l.sort((a, b) => a.start.localeCompare(b.start));
    VISITAS.set(s.citas, { t: s.ahora.getTime(), m });
  }
  return m;
}

export function contarServicios(citas: CitaA[], s: EstadoAsistente): Array<{ id: string; nombre: string; veces: number; euros: number }> {
  const m = new Map<string, { id: string; nombre: string; veces: number; euros: number }>();
  for (const c of citas) {
    if (!activa(c) || c.status === "no-show") continue;
    const reparto = c.serviceIds.length || 1;
    for (const id of c.serviceIds) {
      const sv = s.servicios.find((x) => x.id === id);
      if (!sv) continue;
      const x = m.get(id) ?? { id, nombre: sv.name, veces: 0, euros: 0 };
      x.veces++;
      x.euros += c.priceEur / reparto;
      m.set(id, x);
    }
  }
  return [...m.values()].sort((a, b) => b.veces - a.veces || b.euros - a.euros);
}

/** «hoy a las 10:00», «mañana a las 9:30», «el jueves 2 oct a las 13:50». */
export function cuando(iso: string, c: Contexto): string {
  return `${etiquetaRelativa(diaEnZona(iso, c.estado.timeZone), c.hoy)} a las ${hora(iso, c.estado)}`;
}
