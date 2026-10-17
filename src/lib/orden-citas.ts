import type { Appointment } from "./mock/types";

type CitaConHorario = Pick<Appointment, "start" | "duration">;

/**
 * Una cita que ya ha empezado sigue siendo próxima mientras no haya acabado.
 * Esto evita mandar al historial a quien está ahora mismo en el sillón.
 */
export function esCitaProxima(cita: CitaConHorario, ahora: Date): boolean {
  const inicio = new Date(cita.start).getTime();
  const fin = inicio + cita.duration * 60_000;
  return inicio >= ahora.getTime() || fin > ahora.getTime();
}

/**
 * Próximas primero, de la más cercana a la más lejana; después, el historial
 * de la más reciente a la más antigua. En empates exactos conserva el orden
 * de origen para que la lista no salte entre pintados.
 */
export function ordenarCitasProximasPrimero<T extends CitaConHorario>(citas: T[], ahora: Date): T[] {
  return citas
    .map((cita, indice) => ({ cita, indice, proxima: esCitaProxima(cita, ahora), inicio: new Date(cita.start).getTime() }))
    .sort((a, b) => {
      if (a.proxima !== b.proxima) return a.proxima ? -1 : 1;
      const diferencia = a.proxima ? a.inicio - b.inicio : b.inicio - a.inicio;
      return diferencia || a.indice - b.indice;
    })
    .map(({ cita }) => cita);
}
