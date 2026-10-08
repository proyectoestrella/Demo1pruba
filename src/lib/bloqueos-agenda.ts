import type { Appointment, BloqueoAgenda, Employee } from "./mock/types";
import { fechaEnZona, horaEnZona, isoDelSalon } from "./zona-horaria";

/** Dos intervalos semiabiertos se cruzan (los contiguos no). */
export function intervalosSeSolapan(inicio: string, fin: string, otroInicio: string, otroFin: string): boolean {
  return Date.parse(inicio) < Date.parse(otroFin) && Date.parse(otroInicio) < Date.parse(fin);
}

/** ¿Un bloqueo aplica a ese instante? Los semanales repiten su hora local. */
export function bloqueoAplicaEnHueco(
  bloqueo: BloqueoAgenda,
  employeeId: string,
  inicioISO: string,
  durationMin: number,
  timeZone: string,
): boolean {
  if (bloqueo.profesionalId !== "salon" && bloqueo.profesionalId !== employeeId) return false;
  const finISO = new Date(Date.parse(inicioISO) + durationMin * 60_000).toISOString();
  if (!bloqueo.recurrente) return intervalosSeSolapan(inicioISO, finISO, bloqueo.inicio, bloqueo.fin);
  const fecha = fechaEnZona(inicioISO, timeZone);
  const dia = new Date(`${fecha}T12:00:00`).getDay();
  if (dia !== bloqueo.recurrente.diaSemana) return false;
  const inicioRepetido = isoDelSalon(fecha, horaEnZona(bloqueo.inicio, timeZone), timeZone);
  const finRepetido = isoDelSalon(fecha, horaEnZona(bloqueo.fin, timeZone), timeZone);
  return intervalosSeSolapan(inicioISO, finISO, inicioRepetido, finRepetido);
}

export function hayBloqueoEnHueco(
  bloqueos: BloqueoAgenda[] | undefined,
  employeeId: string,
  inicioISO: string,
  durationMin: number,
  timeZone: string,
): boolean {
  return (bloqueos ?? []).some((b) => bloqueoAplicaEnHueco(b, employeeId, inicioISO, durationMin, timeZone));
}

/** Proyección visual de bloqueos: las citas falsas nunca salen de la app. */
export function bloqueosComoCitas(
  bloqueos: BloqueoAgenda[] | undefined,
  desde: string,
  hasta: string,
  timeZone: string,
  equipo: Employee[] = [],
): Appointment[] {
  const resultado: Appointment[] = [];
  const inicioDia = new Date(`${desde}T12:00:00`);
  const finDia = new Date(`${hasta}T12:00:00`);
  for (const bloqueo of bloqueos ?? []) {
    const fechas: string[] = [];
    if (bloqueo.recurrente) {
      for (let d = new Date(inicioDia); d <= finDia; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === bloqueo.recurrente.diaSemana) fechas.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }
    } else {
      const fecha = fechaEnZona(bloqueo.inicio, timeZone);
      if (fecha >= desde && fecha <= hasta) fechas.push(fecha);
    }
    for (const fecha of fechas) {
      const inicio = bloqueo.recurrente ? isoDelSalon(fecha, horaEnZona(bloqueo.inicio, timeZone), timeZone) : bloqueo.inicio;
      const fin = bloqueo.recurrente ? isoDelSalon(fecha, horaEnZona(bloqueo.fin, timeZone), timeZone) : bloqueo.fin;
      const duration = Math.max(1, Math.round((Date.parse(fin) - Date.parse(inicio)) / 60_000));
      const profesionales = bloqueo.profesionalId === "salon" ? equipo.map((e) => e.id) : [bloqueo.profesionalId];
      for (const profesionalId of profesionales) resultado.push({
        id: `bloqueo:${bloqueo.id}:${fecha}:${profesionalId}`,
        clientId: "",
        clientName: "",
        serviceIds: [],
        employeeId: profesionalId,
        start: inicio,
        duration,
        priceEur: 0,
        status: "blocked",
        note: bloqueo.motivo || "Tiempo bloqueado",
      });
    }
  }
  return resultado;
}
