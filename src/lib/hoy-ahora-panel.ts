/**
 * Hoy, lote 16: el bloque «Ahora» (la cita en curso y la siguiente) y la
 * agenda del día en una línea de tiempo compacta. Puro, con test.
 */
import type { Appointment, Employee } from "./mock/types";
import { franjasProfesional } from "./horario-equipo";

const minDe = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

export interface AhoraDelDia {
  enCurso: Appointment[];
  siguiente: Appointment | null;
  /** Minutos hasta la siguiente (redondeado), si la hay. */
  minutosHastaSiguiente: number | null;
}

/** Citas de hoy (sin bloqueos) en curso y la siguiente que empieza. */
export function ahoraDelDia(hoy: Appointment[], ahora: Date): AhoraDelDia {
  const t = ahora.getTime();
  const citas = hoy.filter((a) => a.status !== "blocked" && a.status !== "cancelled" && a.status !== "no-show");
  const enCurso = citas.filter((a) => Date.parse(a.start) <= t && Date.parse(a.start) + a.duration * 60_000 > t);
  const siguiente = citas.filter((a) => Date.parse(a.start) > t).sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
  return { enCurso, siguiente, minutosHastaSiguiente: siguiente ? Math.round((Date.parse(siguiente.start) - t) / 60_000) : null };
}

export interface FilaLinea {
  e: Employee;
  tramos: { cita: Appointment; ini: number; fin: number }[];
}

/**
 * Línea de tiempo del día: desde la primera hora en que abre alguien (o la
 * primera cita) hasta la última, una fila por profesional.
 */
export function lineaDelDia(hoy: Appointment[], equipo: Employee[], ahora: Date): { ini: number; fin: number; filas: FilaLinea[] } {
  const wd = ahora.getDay();
  const bordes: number[] = [];
  for (const e of equipo) for (const f of franjasProfesional(e, wd)) bordes.push(f.start, f.end);
  const citas = hoy.filter((a) => a.status !== "cancelled");
  for (const a of citas) bordes.push(minDe(a.start), minDe(a.start) + a.duration);
  const ini = bordes.length ? Math.floor(Math.min(...bordes) / 60) * 60 : 9 * 60;
  const fin = bordes.length ? Math.ceil(Math.max(...bordes) / 60) * 60 : 20 * 60;
  const filas = equipo.map((e) => ({
    e,
    tramos: citas
      .filter((a) => a.employeeId === e.id)
      .map((a) => ({ cita: a, ini: minDe(a.start), fin: minDe(a.start) + a.duration }))
      .sort((x, y) => x.ini - y.ini),
  }));
  return { ini, fin: Math.max(fin, ini + 60), filas };
}

/** «en 5 min», «en 1 h 20», «ahora». */
export function enCuanto(min: number | null): string {
  if (min === null) return "";
  if (min <= 0) return "ahora";
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `en ${h} h ${m}` : `en ${h} h`;
}
