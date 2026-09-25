import type { Appointment, Employee } from "./mock/types";
import { esCobrable } from "./caja";
import { franjasProfesional } from "./horario-equipo";
import { ocupacionDe } from "./calendario-arena";

/**
 * Dinero y agenda del día con las etiquetas honestas (lote 9d):
 * - COBRADO: lo que ya se ha cobrado (citas con `paidAt`). Es histórico.
 * - PREVISTO: lo que falta por cobrar de citas confirmadas que todavía no han
 *   empezado. Es futuro.
 * Un periodo pasado solo tiene cobrado (y citas realizadas o que no vinieron);
 * uno futuro, solo previsto; el que contiene «ahora», los dos.
 */

export type Tiempo = "pasado" | "futuro" | "en-curso";

export interface DineroDelRango {
  tiempo: Tiempo;
  cobrado: number;
  cobradas: number;
  previsto: number;
  previstas: number;
  /** Lo que queda por cobrar del periodo: citas no canceladas ni «no vino» sin cobro marcado. */
  porCobrar: number;
  /** Citas ya ocurridas: vinieron y no vinieron. */
  realizadas: number;
  noVino: number;
  /** Citas que vinieron sin cobro marcado: sin ellas «cobrado» se queda corto. */
  sinCobroMarcado: number;
}

export function tiempoDe(r: { inicio: Date; fin: Date }, ahora: Date): Tiempo {
  if (+r.fin <= +ahora) return "pasado";
  if (+r.inicio >= +ahora) return "futuro";
  return "en-curso";
}

export function dineroDelRango(appts: Appointment[], r: { inicio: Date; fin: Date }, ahora: Date): DineroDelRango {
  const dentro = appts.filter((a) => {
    const t = +new Date(a.start);
    return t >= +r.inicio && t < +r.fin;
  });
  const cobradasL = dentro.filter((a) => esCobrable(a) && !!a.paidAt);
  const previstasL = dentro.filter((a) => a.status === "confirmed" && !a.paidAt && +new Date(a.start) >= +ahora);
  const pasadas = dentro.filter((a) => +new Date(a.start) < +ahora);
  return {
    tiempo: tiempoDe(r, ahora),
    cobrado: cobradasL.reduce((s, a) => s + a.priceEur, 0),
    cobradas: cobradasL.length,
    previsto: previstasL.reduce((s, a) => s + a.priceEur, 0),
    previstas: previstasL.length,
    porCobrar: dentro.filter((a) => esCobrable(a) && !a.paidAt).reduce((s, a) => s + a.priceEur, 0),
    realizadas: pasadas.filter((a) => a.status === "completed" || a.status === "no-show" || a.status === "late").length,
    noVino: pasadas.filter((a) => a.status === "no-show").length,
    sinCobroMarcado: pasadas.filter((a) => a.status === "completed" && !a.paidAt).length,
  };
}

const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

/**
 * Resumen de la agenda de hoy para las tarjetas de Hoy: citas por
 * profesional, ocupación ponderada por jornada y los huecos libres que
 * quedan (de 30 min o más) con su hora de inicio.
 */
export function agendaDeHoy(citasHoy: Appointment[], equipo: Employee[], ahora: Date, minMin = 30) {
  const dia = ahora.getDay();
  const cuenta = (a: Appointment) => a.status !== "cancelled" && a.status !== "blocked";
  const porPro = equipo
    .map((e) => ({ e, citas: citasHoy.filter((a) => a.employeeId === e.id && cuenta(a)).length }))
    .filter((x) => x.citas > 0 || franjasProfesional(x.e, dia).length > 0);
  let jornada = 0;
  let ocupado = 0;
  for (const e of equipo) {
    const j = franjasProfesional(e, dia).reduce((s, f) => s + (f.end - f.start), 0);
    jornada += j;
    ocupado += (ocupacionDe(citasHoy.filter(cuenta), e, dia) * j) / 100;
  }
  // Desde el siguiente múltiplo de 5: «Sara 18:45», no «Sara 18:43».
  const minutosAhora = Math.ceil((ahora.getHours() * 60 + ahora.getMinutes()) / 5) * 5;
  const huecos: { e: Employee; ini: number; fin: number }[] = [];
  for (const e of equipo) {
    for (const f of franjasProfesional(e, dia)) {
      const ocupadas = citasHoy
        .filter((a) => a.employeeId === e.id && cuenta(a))
        .map((a) => {
          const d = new Date(a.start);
          const ini = d.getHours() * 60 + d.getMinutes();
          return { ini, fin: ini + a.duration };
        })
        .sort((x, y) => x.ini - y.ini);
      let cursor = Math.max(f.start, minutosAhora);
      for (const o of ocupadas) {
        if (o.fin <= cursor) continue;
        if (o.ini - cursor >= minMin) huecos.push({ e, ini: cursor, fin: o.ini });
        cursor = Math.max(cursor, o.fin);
      }
      if (f.end - cursor >= minMin) huecos.push({ e, ini: cursor, fin: f.end });
    }
  }
  huecos.sort((a, b) => a.ini - b.ini);
  const minutosLibres = huecos.reduce((s, h) => s + (h.fin - h.ini), 0);
  // «Sara 13:30 · Noelia 16:00 y 18:45»: por profesional, en orden de su primer hueco.
  const orden: Employee[] = [];
  for (const h of huecos) if (!orden.includes(h.e)) orden.push(h.e);
  const detalleHuecos = orden
    .map((e) => {
      const horas = huecos.filter((h) => h.e === e).map((h) => hhmm(h.ini));
      const lista = horas.length > 1 ? `${horas.slice(0, -1).join(", ")} y ${horas[horas.length - 1]}` : horas[0];
      return `${e.name} ${lista}`;
    })
    .join(" · ");
  return {
    total: citasHoy.filter(cuenta).length,
    porPro,
    ocupacionPct: jornada ? Math.round((ocupado / jornada) * 100) : 0,
    huecos,
    minutosLibres,
    detalleHuecos,
  };
}
