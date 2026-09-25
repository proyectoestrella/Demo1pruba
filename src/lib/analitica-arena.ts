import type { Appointment, Employee, Service } from "./mock/types";
import type { PeriodoId, Rango } from "./periodos";
import { franjasProfesional } from "./horario-equipo";
import { ocupacionDe } from "./calendario-arena";

/**
 * Cálculos puros de las gráficas de Analítica «Arena». Todos miran el mismo
 * rango que las cifras de arriba (el selector de periodo de la store), sin
 * React ni store. Cuentan las citas que ocurren: ni canceladas ni bloqueos.
 */

export interface Barra {
  etiqueta: string;
  valor: number;
  /** Hoy (o esta hora): se pinta en moca fuerte. */
  destacada: boolean;
  /** Texto del aviso al pasar el ratón. */
  detalle: string;
}

const cuenta = (a: Appointment) => a.status !== "cancelled" && a.status !== "blocked";
const dentro = (a: Appointment, r: Rango) => {
  const t = +new Date(a.start);
  return t >= +r.inicio && t < +r.fin;
};
const DCORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function citasDelRango(appts: Appointment[], r: Rango): Appointment[] {
  return appts.filter((a) => cuenta(a) && dentro(a, r));
}

/**
 * Barras de la gráfica principal: por hora si el periodo es un solo día
 * («Hoy»), por día en el resto. Las horas van del primer al último tramo en
 * que abre alguien ese día; si nadie abre, de 9 a 20.
 */
export function barrasDelPeriodo(
  appts: Appointment[],
  periodo: PeriodoId,
  r: Rango,
  equipo: Employee[],
  ahora: Date,
): Barra[] {
  const citas = citasDelRango(appts, r);
  const dias = Math.max(1, Math.round((+r.fin - +r.inicio) / 86_400_000));
  if (periodo === "hoy" || dias === 1) {
    const franjas = equipo.flatMap((e) => franjasProfesional(e, r.inicio.getDay()));
    const desde = franjas.length ? Math.floor(Math.min(...franjas.map((f) => f.start)) / 60) : 9;
    const hasta = franjas.length ? Math.ceil(Math.max(...franjas.map((f) => f.end)) / 60) : 20;
    return Array.from({ length: Math.max(1, hasta - desde) }, (_, i) => {
      const h = desde + i;
      const valor = citas.filter((a) => new Date(a.start).getHours() === h).length;
      return {
        etiqueta: String(h),
        valor,
        destacada: ahora.getHours() === h && +ahora >= +r.inicio && +ahora < +r.fin,
        detalle: `${h}:00 · ${valor} ${valor === 1 ? "cita" : "citas"}`,
      };
    });
  }
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(r.inicio);
    d.setDate(r.inicio.getDate() + i);
    const clave = d.toDateString();
    const valor = citas.filter((a) => new Date(a.start).toDateString() === clave).length;
    return {
      etiqueta: dias <= 7 ? DCORTO[d.getDay()] : String(d.getDate()),
      valor,
      destacada: clave === ahora.toDateString(),
      detalle: `${DCORTO[d.getDay()]} ${d.getDate()} · ${valor} ${valor === 1 ? "cita" : "citas"}`,
    };
  });
}

/** Ocupación media de cada profesional en el rango, ponderada por su jornada. */
export function ocupacionPorProfesional(appts: Appointment[], r: Rango, equipo: Employee[]): { e: Employee; pct: number; citas: number }[] {
  const citas = citasDelRango(appts, r);
  const dias = Math.max(1, Math.round((+r.fin - +r.inicio) / 86_400_000));
  return equipo.map((e) => {
    let jornada = 0;
    let ocupado = 0;
    for (let i = 0; i < dias; i++) {
      const d = new Date(r.inicio);
      d.setDate(r.inicio.getDate() + i);
      const j = franjasProfesional(e, d.getDay()).reduce((t, f) => t + (f.end - f.start), 0);
      if (!j) continue;
      const delDia = citas.filter((a) => new Date(a.start).toDateString() === d.toDateString());
      jornada += j;
      ocupado += (ocupacionDe(delDia, e, d.getDay()) * j) / 100;
    }
    return { e, pct: jornada ? Math.round((ocupado / jornada) * 100) : 0, citas: citas.filter((a) => a.employeeId === e.id).length };
  });
}

/** Servicios del rango por número de veces, con lo que ha dejado cada uno (reparto por precio de carta). */
export function serviciosDelRango(appts: Appointment[], r: Rango, carta: Service[]): { sv: Service; veces: number; euros: number }[] {
  const porId = new Map(carta.map((s) => [s.id, { sv: s, veces: 0, euros: 0 }]));
  for (const a of citasDelRango(appts, r)) {
    if (a.status === "no-show") continue;
    const servicios = a.serviceIds.map((id) => porId.get(id)).filter((x): x is { sv: Service; veces: number; euros: number } => !!x);
    const base = servicios.reduce((t, x) => t + x.sv.priceEur, 0) || 1;
    for (const x of servicios) {
      x.veces += 1;
      x.euros += (a.priceEur * x.sv.priceEur) / base;
    }
  }
  return [...porId.values()].filter((x) => x.veces > 0).sort((x, y) => y.veces - x.veces || y.euros - x.euros);
}

/**
 * Clientas del rango: nuevas (su primera cita de todo el histórico cae
 * dentro) frente a recurrentes (ya habían venido antes).
 */
export function nuevasYRecurrentes(appts: Appointment[], r: Rango): { nuevas: number; recurrentes: number } {
  const primera = new Map<string, number>();
  for (const a of appts) {
    if (!cuenta(a)) continue;
    const t = +new Date(a.start);
    const p = primera.get(a.clientId);
    if (p === undefined || t < p) primera.set(a.clientId, t);
  }
  const clientas = new Set(citasDelRango(appts, r).map((a) => a.clientId));
  let nuevas = 0;
  for (const id of clientas) if ((primera.get(id) ?? 0) >= +r.inicio) nuevas += 1;
  return { nuevas, recurrentes: clientas.size - nuevas };
}
