import type { DiaEspecial, Employee, FranjaEspecial } from "./mock/types";
import { parseFranjasEspeciales, type Range } from "./opening-hours";

/** Franjas exactas de una profesional para un día de Date.getDay(). */
export function franjasProfesional(employee: Employee, weekday: number) {
  const exactas = employee.scheduleRanges?.[weekday];
  if (exactas) return exactas;
  const legacy = employee.schedule[weekday];
  return legacy ? [{ start: legacy.start * 60, end: legacy.end * 60 }] : [];
}

/** Comprueba también que la cita termina antes del descanso o del cierre. */
export function trabajaEn(employee: Employee, weekday: number, startMin: number, durationMin = 0): boolean {
  return franjasProfesional(employee, weekday).some(
    (r) => startMin >= r.start && startMin + durationMin <= r.end,
  );
}

/** Intersección de franjas, siempre medida en minutos desde medianoche. */
function interseccion(a: Range[], b: Range[]): Range[] {
  return a.flatMap((izquierda) => b.flatMap((derecha) => {
    const start = Math.max(izquierda.start, derecha.start);
    const end = Math.min(izquierda.end, derecha.end);
    return end > start ? [{ start, end }] : [];
  }));
}

function franjasEspeciales(franjas: FranjaEspecial[] | undefined): Range[] {
  return (franjas ?? []).flatMap((f) => parseFranjasEspeciales(`${f.inicio}–${f.fin}`));
}

/** La fecha de agenda no depende de la zona del navegador: es AAAA-MM-DD local del salón. */
export function weekdayDeFecha(fecha: string): number {
  return new Date(`${fecha}T12:00:00`).getDay();
}

/** La excepción concreta para una fecha, si la hay. La última edición de esa fecha manda. */
export function diaEspecialDe(dias: DiaEspecial[] | undefined, fecha: string): DiaEspecial | undefined {
  return [...(dias ?? [])].reverse().find((d) => d.fecha === fecha);
}

/**
 * Horario efectivo en una fecha. Un cierre gana a todo; `soloProfesionales`
 * sustituye la semana de las profesionales indicadas (también en un día que
 * el salón cierra); `franjas` limita la jornada semanal restante.
 */
export function franjasProfesionalEnFecha(
  employee: Employee,
  fecha: string,
  diasEspeciales?: DiaEspecial[],
): Range[] {
  const especial = diaEspecialDe(diasEspeciales, fecha);
  if (especial?.cerrado) return [];
  if (especial?.soloProfesionales) {
    const propias = especial.soloProfesionales[employee.id];
    if (!propias) return [];
    const disponibles = franjasEspeciales(propias);
    return especial.franjas?.length ? interseccion(disponibles, franjasEspeciales(especial.franjas)) : disponibles;
  }
  const semanales = franjasProfesional(employee, weekdayDeFecha(fecha));
  return especial?.franjas?.length ? interseccion(semanales, franjasEspeciales(especial.franjas)) : semanales;
}

export function trabajaEnFecha(
  employee: Employee,
  fecha: string,
  startMin: number,
  durationMin = 0,
  diasEspeciales?: DiaEspecial[],
): boolean {
  return franjasProfesionalEnFecha(employee, fecha, diasEspeciales).some(
    (r) => startMin >= r.start && startMin + durationMin <= r.end,
  );
}

export function horasDePasoDeMediaHora(desde: number, hasta: number): number[] {
  const primero = Math.ceil(desde / 30) * 30;
  const out: number[] = [];
  for (let minuto = primero; minuto < hasta; minuto += 30) out.push(minuto);
  return out;
}

/** Horas de inicio en las que cabe la duración para al menos una profesional. */
export function huecosDeProfesionales(employees: Employee[], weekday: number, durationMin: number): number[] {
  const rangos = employees.flatMap((e) => franjasProfesional(e, weekday));
  if (!rangos.length) return [];
  return horasDePasoDeMediaHora(Math.min(...rangos.map((r) => r.start)), Math.max(...rangos.map((r) => r.end)))
    .filter((minuto) => employees.some((e) => trabajaEn(e, weekday, minuto, durationMin)));
}

/** Igual que la semanal, pero aplicando primero las excepciones de esa fecha. */
export function huecosDeProfesionalesEnFecha(
  employees: Employee[],
  fecha: string,
  durationMin: number,
  diasEspeciales?: DiaEspecial[],
): number[] {
  const rangos = employees.flatMap((e) => franjasProfesionalEnFecha(e, fecha, diasEspeciales));
  if (!rangos.length) return [];
  return horasDePasoDeMediaHora(Math.min(...rangos.map((r) => r.start)), Math.max(...rangos.map((r) => r.end)))
    .filter((minuto) => employees.some((e) => trabajaEnFecha(e, fecha, minuto, durationMin, diasEspeciales)));
}
