import type { Employee } from "./mock/types";

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
