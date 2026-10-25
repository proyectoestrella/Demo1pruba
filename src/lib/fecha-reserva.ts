import { franjasProfesionalEnFecha } from "./horario-equipo";
import type { Appointment, BloqueoAgenda, DiaEspecial, Employee } from "./mock/types";
import { findNextAvailableSlot } from "./reparto";
import type { ContextoSolape } from "./solape";

function fechaLocal(clave: string): Date {
  return new Date(`${clave}T12:00:00`);
}

/** Suma días de calendario sin pasar por UTC (importante durante los cambios de hora). */
export function sumarDiasDeReserva(clave: string, dias: number): string {
  const fecha = fechaLocal(clave);
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Un día está abierto si al menos una profesional tiene jornada efectiva. */
export function salonAbreEnFecha(
  employees: Employee[],
  fecha: string,
  diasEspeciales?: DiaEspecial[],
): boolean {
  return employees.some(
    (employee) => franjasProfesionalEnFecha(employee, fecha, diasEspeciales).length > 0,
  );
}

function buscarDiaAbierto(
  fecha: string,
  direccion: 1 | -1,
  employees: Employee[],
  diasEspeciales: DiaEspecial[] | undefined,
  minimo: string | undefined,
  maxDays: number,
): string | undefined {
  for (let distancia = 1; distancia <= maxDays; distancia++) {
    const candidata = sumarDiasDeReserva(fecha, direccion * distancia);
    if (minimo && candidata < minimo) return undefined;
    if (salonAbreEnFecha(employees, candidata, diasEspeciales)) return candidata;
  }
  return undefined;
}

/** Siguiente día en que abre el salón; salta cierres semanales y especiales. */
export function siguienteDiaAbierto(
  fecha: string,
  employees: Employee[],
  diasEspeciales?: DiaEspecial[],
  maxDays = 60,
): string | undefined {
  return buscarDiaAbierto(fecha, 1, employees, diasEspeciales, undefined, maxDays);
}

/** Día abierto anterior, sin cruzar nunca la fecha mínima (normalmente hoy). */
export function anteriorDiaAbierto(
  fecha: string,
  fechaMinima: string,
  employees: Employee[],
  diasEspeciales?: DiaEspecial[],
  maxDays = 60,
): string | undefined {
  return buscarDiaAbierto(fecha, -1, employees, diasEspeciales, fechaMinima, maxDays);
}

/** Primer día abierto desde una fecha, incluyéndola. */
export function primerDiaAbierto(
  desde: string,
  employees: Employee[],
  diasEspeciales?: DiaEspecial[],
  maxDays = 60,
): string | undefined {
  if (salonAbreEnFecha(employees, desde, diasEspeciales)) return desde;
  return siguienteDiaAbierto(desde, employees, diasEspeciales, maxDays);
}

/** Las profesionales libres a una hora excepto la preferida que no puede atenderla. */
export function alternativasAUnaHora<T extends { id: string }>(
  profesionalPreferida: string,
  libres: readonly T[],
): T[] {
  return libres.filter((employee) => employee.id !== profesionalPreferida);
}

/**
 * Próximo día (no el que se está viendo) con al menos un hueco real de la
 * profesional. La búsqueda está limitada a 60 días para no recorrer una
 * agenda sin fin si está de baja o ya no presta esos servicios.
 */
export function proximoDiaConProfesional({
  desde,
  employee,
  employees,
  appointments,
  durationMin,
  now,
  timeZone,
  lastSlotBufferMin = 0,
  diasEspeciales,
  bloqueosAgenda,
  serviceIds = [],
  serviciosPorProfesional,
  contextoSolape,
  maxDays = 60,
}: {
  desde: string;
  employee: Employee;
  employees: Employee[];
  appointments: Appointment[];
  durationMin: number;
  now: Date;
  timeZone: string;
  lastSlotBufferMin?: number;
  diasEspeciales?: DiaEspecial[];
  bloqueosAgenda?: BloqueoAgenda[];
  serviceIds?: string[];
  serviciosPorProfesional?: Record<string, string[]>;
  contextoSolape?: ContextoSolape;
  maxDays?: number;
}): string | undefined {
  const primeraFecha = sumarDiasDeReserva(desde, 1);
  return findNextAvailableSlot(employees, appointments, durationMin, employee.id, {
    fromDate: fechaLocal(primeraFecha),
    now,
    maxDays,
    timeZone,
    lastSlotBufferMin,
    diasEspeciales,
    bloqueosAgenda,
    serviceIds,
    serviciosPorProfesional,
    contextoSolape,
  })?.dateKey;
}
