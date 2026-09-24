import type { Appointment } from "./mock/types";

/** Colores anotados en visitas anteriores, más reciente primero. */
export function historialColores(citas: Appointment[], clientId: string, antesDe?: string) {
  const limite = antesDe ? new Date(antesDe).getTime() : Infinity;
  return citas
    .filter((cita) => cita.clientId === clientId && !!cita.colorFormula?.trim() &&
      cita.status !== "cancelled" && new Date(cita.start).getTime() < limite)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
}

export function ultimoColor(citas: Appointment[], clientId: string, antesDe?: string) {
  return historialColores(citas, clientId, antesDe)[0];
}
