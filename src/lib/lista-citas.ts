import { hora } from "./copy";
import { esCitaProxima } from "./orden-citas";

type CitaConHorario = { start: string | number | Date; duration: number };

const FMT_DIA = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function claveDia(fecha: Date) {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

/**
 * Las tres piezas que forman el bloque horario de una fila de citas. La hora
 * queda aislada de la fecha y la duración para poder leer la agenda de arriba
 * abajo sin confundirla con el listado de clientas.
 */
export function horaDestacadaCita(cita: CitaConHorario, ahora = new Date()) {
  const fecha = new Date(cita.start);
  if (!Number.isFinite(fecha.getTime()))
    return { hora: "—", dia: "Fecha no disponible", duracion: `${cita.duration} min` };

  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  const dia =
    claveDia(fecha) === claveDia(ahora)
      ? "Hoy"
      : claveDia(fecha) === claveDia(manana)
        ? "Mañana"
        : claveDia(fecha) === claveDia(ayer)
          ? "Ayer"
          : FMT_DIA.format(fecha).replace(",", "");

  return { hora: hora(fecha), dia, duracion: `${cita.duration} min` };
}

/** Conserva el orden recibido, pero separa las próximas del historial. */
export function agruparCitasPorProximidad<T extends CitaConHorario>(
  citas: T[],
  ahora = new Date(),
) {
  const proximas: T[] = [];
  const anteriores: T[] = [];
  for (const cita of citas) {
    (esCitaProxima(cita, ahora) ? proximas : anteriores).push(cita);
  }
  return { proximas, anteriores };
}
