import { cuandoEnPalabras, horaEnPalabras, mensajeRecordatorio, type RecordatorioDeCita } from "./avisos";

/**
 * Textos de WhatsApp que la dueña puede escribir a su manera (lote 9h). Si
 * no ha escrito nada, se usa el texto de siempre (el de `avisos.ts`, que no
 * se toca). Marcadores entre llaves que se cambian por lo de cada cita.
 */

export const MARCADORES = [
  { clave: "{nombre}", que: "nombre de pila de la clienta" },
  { clave: "{salon}", que: "nombre del salón" },
  { clave: "{cuando}", que: "día y hora, por ejemplo «mañana a las 10:30»" },
  { clave: "{servicio}", que: "servicio de la cita" },
  { clave: "{profesional}", que: "quién la atiende" },
  { clave: "{direccion}", que: "dirección del salón" },
] as const;

export const RECORDATORIO_POR_DEFECTO =
  "Hola {nombre}, te recordamos tu cita en {salon} {cuando} para {servicio}. Te esperamos en {direccion}. ¡Hasta pronto!";
export const CONFIRMACION_POR_DEFECTO =
  "Hola {nombre}, tu cita en {salon} queda confirmada {cuando} para {servicio} con {profesional}. Si necesitas cambiarla, escríbenos por aquí. ¡Te esperamos!";

export interface DatosMensaje {
  nombre: string;
  salon: string;
  startISO: string;
  servicio: string;
  profesional?: string;
  direccion: string;
}

/** Cambia cada marcador por su dato; los que no conoce se dejan tal cual. */
export function rellenar(plantilla: string, d: DatosMensaje): string {
  const valores: Record<string, string> = {
    "{nombre}": d.nombre,
    "{salon}": d.salon,
    "{cuando}": cuandoEnPalabras(d.startISO),
    "{servicio}": d.servicio,
    "{profesional}": d.profesional ?? "nuestro equipo",
    "{direccion}": d.direccion,
  };
  return plantilla.replace(/\{[a-z]+\}/g, (m) => valores[m] ?? m).replace(/\s+/g, " ").trim();
}

/**
 * Recordatorio: el texto de la dueña si lo hay (y, si la señal sigue
 * pendiente, la misma frase de la señal que el texto de siempre); si no, el
 * de `avisos.ts` sin cambios.
 */
export function mensajeRecordatorioDe(plantilla: string | undefined, r: RecordatorioDeCita & { profesional?: string }): string {
  if (!plantilla?.trim()) return mensajeRecordatorio(r);
  const base = rellenar(plantilla, { nombre: r.clientName, salon: r.salonName, startISO: r.startISO, servicio: r.servicio, profesional: r.profesional, direccion: r.direccion });
  const s = r.senalPendiente;
  if (!s) return base;
  const plazo = s.deadlineISO
    ? ` antes del ${new Date(s.deadlineISO).toLocaleDateString("es-ES", { day: "numeric", month: "long" })} a las ${horaEnPalabras(s.deadlineISO)}`
    : "";
  return `${base} Si aún no lo has hecho, puedes enviarnos la señal de ${s.importeEur} € por Bizum al ${s.bizumPhone}${plazo}.`;
}

export function mensajeConfirmacionDe(plantilla: string | undefined, d: DatosMensaje): string {
  return rellenar(plantilla?.trim() ? plantilla : CONFIRMACION_POR_DEFECTO, d);
}
