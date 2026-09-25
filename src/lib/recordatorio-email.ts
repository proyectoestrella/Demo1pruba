/**
 * Recordatorio automático por email el día anterior (plan Reservas).
 *
 * Aquí no hay red ni Supabase: solo la selección de qué citas toca recordar
 * y el contenido del correo. El envío y la lectura viven en
 * `api/recordatorios.server.ts`; así esto se prueba con `bun test` sin
 * levantar nada, y el criterio de «a quién se avisa» está en un solo sitio.
 */
import { mensajeRecordatorio, type RecordatorioDeCita } from "./avisos";
import { ZONA_HORARIA_SALON, fechaEnZona, horaEnZona } from "./zona-horaria";

export { fechaEnZona } from "./zona-horaria";

/** Lo mínimo de una cita que hace falta para decidir si se recuerda. */
export interface CitaRecordable {
  id: string;
  start_at: string;
  status: string;
  reminder_sent_at: string | null;
  /** Correo de la clienta, si lo dejó al reservar. */
  email: string | null;
}

/** La fecha de mañana en la zona del salón, contando desde `ahora`. */
export function fechaDeManana(ahora: Date, timeZone = ZONA_HORARIA_SALON): string {
  // Sumar 24 h y leer la fecha en zona: el cambio de hora no altera qué día es.
  return fechaEnZona(new Date(ahora.getTime() + 24 * 60 * 60_000), timeZone);
}

/**
 * Qué citas reciben recordatorio: las confirmadas por el salón para mañana,
 * con correo de la clienta y sin recordatorio ya enviado (por email o por
 * WhatsApp a mano: `reminder_sent_at` es la misma marca para los dos).
 *
 * Una solicitud todavía pendiente NO se recuerda: recordar una hora que el
 * salón aún no ha aceptado sería confirmarla por la puerta de atrás.
 */
export function citasParaRecordarManana<T extends CitaRecordable>(
  citas: T[],
  ahora: Date,
  timeZone = ZONA_HORARIA_SALON,
): T[] {
  const manana = fechaDeManana(ahora, timeZone);
  return citas.filter(
    (c) =>
      c.status === "confirmed" &&
      !c.reminder_sent_at &&
      !!c.email?.trim() &&
      fechaEnZona(c.start_at, timeZone) === manana,
  );
}

export interface EmailRecordatorio {
  asunto: string;
  texto: string;
  html: string;
}

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** El mismo texto que el salón manda por WhatsApp, en asunto + cuerpo de correo. */
export function emailRecordatorio(a: RecordatorioDeCita, timeZone = ZONA_HORARIA_SALON): EmailRecordatorio {
  const hora = horaEnZona(a.startISO, timeZone);
  const texto = mensajeRecordatorio(a);
  return {
    asunto: `Recordatorio: tu cita mañana a las ${hora} en ${a.salonName}`,
    texto,
    html: `<p style="font-family:sans-serif;font-size:16px;line-height:1.5">${escaparHtml(texto)}</p>`,
  };
}
