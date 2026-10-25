import type { Appointment, Client, Employee } from "./mock/types";
import { franjasProfesional, trabajaEn } from "./horario-equipo";
import { toDateKey } from "./reparto";
import { fechaEnZona } from "./zona-horaria";

export type DecisionGuardadoCita = {
  aviso: string | null;
  etiqueta: "Guardar cita" | "Guardar igualmente";
};

/** El guardado especial se permite, pero deja claro por qué requiere atención. */
export function decisionGuardadoCita({
  ocupada,
  trabaja,
  profesional = "Esta profesional",
}: {
  ocupada: boolean;
  trabaja: boolean;
  profesional?: string;
}): DecisionGuardadoCita {
  if (ocupada) {
    return {
      aviso: `${profesional} ya tiene una cita a esa hora. Puedes guardarla igualmente.`,
      etiqueta: "Guardar igualmente",
    };
  }
  if (!trabaja) {
    return {
      aviso: `${profesional} no trabaja a esa hora. Puedes guardarla igualmente.`,
      etiqueta: "Guardar igualmente",
    };
  }
  return { aviso: null, etiqueta: "Guardar cita" };
}

/**
 * Cálculos puros de la capa «Nueva cita» (identidad «Arena»): qué horas se
 * ofrecen, cuáles están ocupadas, quién está libre, qué días se enseñan y
 * qué clientas vienen a menudo. Sin React ni store.
 */

/** Horas de paso (cada `paso` minutos) dentro de las franjas de una profesional. */
export function horasDeProfesional(e: Employee, weekday: number, paso = 30): number[] {
  const out: number[] = [];
  for (const f of franjasProfesional(e, weekday)) {
    const primera = Math.ceil(f.start / paso) * paso;
    for (let m = primera; m + paso <= f.end; m += paso) out.push(m);
  }
  return out;
}

/** Citas del día que ocupan agenda: todo menos canceladas y plantones. */
export function citasQueOcupan(appts: Appointment[], dia: Date): Appointment[] {
  const clave = toDateKey(dia);
  return appts.filter(
    (a) => a.status !== "cancelled" && a.status !== "no-show" && toDateKey(new Date(a.start)) === clave,
  );
}

/** ¿Esa hora, con esa duración, pisa alguna cita de la profesional? */
export function horaOcupada(citasDelDia: Appointment[], employeeId: string, minuto: number, duracion: number): boolean {
  const fin = minuto + Math.max(1, duracion);
  return citasDelDia.some((a) => {
    if (a.employeeId !== employeeId) return false;
    const d = new Date(a.start);
    const ini = d.getHours() * 60 + d.getMinutes();
    return ini < fin && minuto < ini + a.duration;
  });
}

/**
 * «Cualquiera libre»: la primera profesional (por orden del equipo) que
 * trabaja a esa hora y no tiene nada encima. `null` si no hay ninguna.
 */
export function primeraLibre(
  equipo: Employee[],
  citasDelDia: Appointment[],
  weekday: number,
  minuto: number,
  duracion: number,
): Employee | null {
  return (
    equipo.find((e) => trabajaEn(e, weekday, minuto, duracion) && !horaOcupada(citasDelDia, e.id, minuto, duracion)) ??
    null
  );
}

/**
 * Siete días para elegir: desde hoy, salvo que la fecha elegida caiga más
 * allá de la semana (una cita pedida desde el calendario para dentro de un
 * mes); entonces la tira arranca en esa fecha.
 */
export function diasParaElegir(hoy: Date, elegida: Date, n = 7): Date[] {
  const base = new Date(hoy);
  base.setHours(0, 0, 0, 0);
  const sel = new Date(elegida);
  sel.setHours(0, 0, 0, 0);
  const dias = Math.round((+sel - +base) / 86_400_000);
  const inicio = dias < 0 || dias >= n ? sel : base;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
}

/** Clientas que más han venido en los últimos `dias` días, con su última visita. */
export function clientasFrecuentes(
  appts: Appointment[],
  clients: Client[],
  ahora: Date,
  n = 7,
  dias = 120,
): { client: Client; visitas: number; ultima: string }[] {
  const desde = +ahora - dias * 86_400_000;
  const cuenta = new Map<string, { visitas: number; ultima: string }>();
  for (const a of appts) {
    if (a.status !== "completed") continue;
    const t = +new Date(a.start);
    if (t > +ahora || t < desde) continue;
    const c = cuenta.get(a.clientId) ?? { visitas: 0, ultima: a.start };
    c.visitas += 1;
    if (t > +new Date(c.ultima)) c.ultima = a.start;
    cuenta.set(a.clientId, c);
  }
  const porId = new Map(clients.map((c) => [c.id, c]));
  return [...cuenta.entries()]
    .filter(([id]) => porId.has(id))
    .sort((x, y) => y[1].visitas - x[1].visitas || +new Date(y[1].ultima) - +new Date(x[1].ultima))
    .slice(0, n)
    .map(([id, v]) => ({ client: porId.get(id)!, ...v }));
}

/** «85 min» → «1 h 25»; menos de una hora, en minutos. */
export function duracionLegible(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

/**
 * Otras citas vivas de la misma clienta ese día (22-oct: «si una clienta coge
 * dos citas el mismo día, que salga el aviso»). Ordenadas por hora.
 */
export function otrasCitasDelDia(
  appts: readonly Appointment[],
  clientId: string | undefined,
  fecha: string,
  timeZone: string,
  excluirId?: string,
): Appointment[] {
  if (!clientId) return [];
  return appts
    .filter(
      (a) =>
        a.clientId === clientId &&
        a.id !== excluirId &&
        a.status !== "cancelled" &&
        a.status !== "no-show" &&
        fechaEnZona(a.start, timeZone) === fecha,
    )
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
