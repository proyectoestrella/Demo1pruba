import { msDe } from "./instante-cita";
import type { Appointment, BookingAnswers, Client, Employee, Service } from "./mock/types";
import { depositState } from "./deposit-deadline";
import { nombreServicioLibre } from "./appointment-services";

const DIA = 86_400_000;
/** Avisar solo si hay un hábito demostrado de color de menos de ocho semanas. */
export const SEMANAS_SIN_COLOR = 8;

export interface DatosFicha {
  citas: Appointment[];
  clientes: Client[];
  servicios: Service[];
  equipo: Employee[];
  ahora: Date;
}

export interface VisitaFicha {
  id: string;
  fecha: string;
  servicios: string[];
  profesional: string;
  duracion: number;
  importe: number;
  colorFormula?: string;
  technicalNotes?: string;
  bookingAnswers?: BookingAnswers;
  origen: "sishow" | "tpv123";
}

function habitual<T>(valores: T[]): T | undefined {
  const cuentas = new Map<T, number>();
  for (const valor of valores) cuentas.set(valor, (cuentas.get(valor) ?? 0) + 1);
  return [...cuentas].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function fichaDeClienta(clientId: string, datos: DatosFicha) {
  const ahora = datos.ahora.getTime();
  const cliente = datos.clientes.find((c) => c.id === clientId);
  const propias = datos.citas.filter((c) => c.clientId === clientId);
  const completas = propias
    .filter((c) => c.status === "completed" && new Date(c.start).getTime() < ahora)
    .sort((a, b) => msDe(b) - msDe(a));
  const nombresServicio = new Map(datos.servicios.map((s) => [s.id, s.name]));
  const nombresEquipo = new Map(datos.equipo.map((e) => [e.id, e.name]));
  const visitas: VisitaFicha[] = completas.map((c) => ({
    id: c.id,
    fecha: c.start,
    servicios: c.serviceIds.map((id) => nombresServicio.get(id) ?? nombreServicioLibre(id) ?? id),
    profesional: nombresEquipo.get(c.employeeId) ?? (c.employeeId === "sin-indicar" ? "Profesional sin indicar" : c.employeeId),
    duracion: c.duration,
    importe: c.priceEur,
    colorFormula: c.colorFormula,
    technicalNotes: c.technicalNotes,
    bookingAnswers: c.bookingAnswers,
    origen: c.origen ?? "sishow",
  }));
  const proxima = propias
    .filter((c) => (c.status === "pending" || c.status === "confirmed") && msDe(c) >= ahora)
    .sort((a, b) => msDe(a) - msDe(b))[0];
  const fechas = completas.map((c) => msDe(c));
  const frecuenciaMediaDias = fechas.length >= 2
    ? Math.round((fechas[0] - fechas[fechas.length - 1]) / DIA / (fechas.length - 1))
    : undefined;
  const ultimoColor = visitas.find((v) => v.colorFormula?.trim());
  const servicioHabitualId = habitual(completas.flatMap((c) => c.serviceIds));
  const profesionalHabitualId = habitual(completas.map((c) => c.employeeId));
  const resumen = {
    numeroVisitas: visitas.length,
    primeraVisita: visitas.at(-1)?.fecha,
    ultimaVisita: visitas[0]?.fecha,
    frecuenciaMediaDias,
    gastoTotal: visitas.reduce((s, v) => s + v.importe, 0),
    gastoUltimos12Meses: visitas.filter((v) => +new Date(v.fecha) >= new Date(datos.ahora.getFullYear() - 1, datos.ahora.getMonth(), datos.ahora.getDate()).getTime())
      .reduce((s, v) => s + v.importe, 0),
    servicioHabitual: servicioHabitualId ? nombresServicio.get(servicioHabitualId) ?? nombreServicioLibre(servicioHabitualId) ?? servicioHabitualId : undefined,
    profesionalHabitual: profesionalHabitualId ? nombresEquipo.get(profesionalHabitualId) ?? profesionalHabitualId : undefined,
    proximaCita: proxima?.start,
    ultimoColor: ultimoColor ? { formula: ultimoColor.colorFormula!, fecha: ultimoColor.fecha } : undefined,
  };
  const avisos: string[] = [];
  if (cliente?.notes?.trim()) avisos.push(`Observaciones: ${cliente.notes.trim()}`);
  if (cliente?.manualBlock) avisos.push("Reserva por internet bloqueada a mano");
  if (proxima) {
    const senal = depositState(proxima, datos.ahora);
    if (senal === "expired") avisos.push("Señal vencida de la próxima cita");
    if (senal === "requested") avisos.push("Señal pendiente de la próxima cita");
  }
  const colores = visitas.filter((v) => v.colorFormula?.trim());
  if (colores.length >= 3) {
    const veniaAntes = colores.slice(0, -1).every((v, i) =>
      (+new Date(v.fecha) - +new Date(colores[i + 1].fecha)) / DIA < SEMANAS_SIN_COLOR * 7);
    if (veniaAntes && (ahora - +new Date(colores[0].fecha)) / DIA > SEMANAS_SIN_COLOR * 7) {
      avisos.push(`Hace más de ${SEMANAS_SIN_COLOR} semanas que no se hace el color`);
    }
  }
  return { visitas, resumen, avisos };
}
