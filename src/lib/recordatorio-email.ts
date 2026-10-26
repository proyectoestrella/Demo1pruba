/**
 * Recordatorio automático por email el día anterior (plan Básico).
 *
 * Aquí no hay red ni Supabase: solo la selección de qué citas toca recordar
 * y el contenido del correo. El envío y la lectura viven en
 * `api/recordatorios.server.ts`; así esto se prueba con `bun test` sin
 * levantar nada, y el criterio de «a quién se avisa» está en un solo sitio.
 */
import { mensajeRecordatorio, type RecordatorioDeCita } from "./avisos";
import { whatsappUrl } from "./campanas";
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

/**
 * El mismo texto que el salón manda por WhatsApp, en asunto + cuerpo de correo,
 * más la fecha completa en hora de Madrid y, si el salón tiene teléfono, cómo
 * cancelar o cambiar la cita por WhatsApp.
 */
export function emailRecordatorio(
  a: RecordatorioDeCita,
  timeZone = ZONA_HORARIA_SALON,
  whatsappSalon?: string,
): EmailRecordatorio {
  const hora = horaEnZona(a.startISO, timeZone);
  const fechaLarga = new Date(a.startISO).toLocaleDateString("es-ES", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const principal = mensajeRecordatorio(a);
  const cuando = `Cita: ${fechaLarga} a las ${hora} (hora de Madrid).`;
  const telefono = whatsappSalon?.replace(/\D/g, "") ? whatsappSalon.trim() : "";
  const enlace = telefono
    ? whatsappUrl(telefono, `Hola, tengo cita en ${a.salonName} el ${fechaLarga} a las ${hora} y querría cambiarla o cancelarla.`)
    : "";
  const cambiar = telefono
    ? `¿No puedes venir o quieres cambiar la hora? Escríbenos por WhatsApp al ${telefono}: ${enlace}`
    : "¿No puedes venir o quieres cambiar la hora? Avisa al salón cuanto antes.";
  const texto = [principal, cuando, cambiar].join("\n\n");
  const p = (t: string) => `<p style="font-family:sans-serif;font-size:16px;line-height:1.5">${t}</p>`;
  const htmlCambiar = telefono
    ? `¿No puedes venir o quieres cambiar la hora? <a href="${escaparHtml(enlace)}">Escríbenos por WhatsApp</a> (${escaparHtml(telefono)}).`
    : escaparHtml(cambiar);
  return {
    asunto: `Recordatorio: tu cita mañana a las ${hora} en ${a.salonName}`,
    texto,
    html: p(escaparHtml(principal)) + p(escaparHtml(cuando)) + p(htmlCambiar),
  };
}

/**
 * Correo a la clienta cuando el salón cambia la fecha u hora de su cita
 * (26-oct, Tomás: si la profesional «mueve» una cita, que la clienta lo sepa).
 * Incluye el WhatsApp del salón para aceptar o pedir otra hora.
 */
export function emailCitaCambiada(
  d: { clientName: string; salonName: string; antesISO: string; nuevaISO: string; servicio?: string },
  timeZone = ZONA_HORARIA_SALON,
  whatsappSalon?: string,
): { asunto: string; texto: string; html: string } {
  const fecha = (iso: string) =>
    `${new Date(iso).toLocaleDateString("es-ES", { timeZone, weekday: "long", day: "numeric", month: "long" })} a las ${horaEnZona(iso, timeZone)}`;
  const nombre = d.clientName.trim().split(/\s+/)[0] || "";
  const principal = `Hola${nombre ? ` ${nombre}` : ""}, ${d.salonName} ha cambiado tu cita${d.servicio ? ` de ${d.servicio}` : ""}. Antes: ${fecha(d.antesISO)}. Ahora: ${fecha(d.nuevaISO)} (hora de Madrid).`;
  const telefono = whatsappSalon?.replace(/\D/g, "") ? whatsappSalon.trim() : "";
  const enlace = telefono ? whatsappUrl(telefono, `Hola, me habéis cambiado la cita en ${d.salonName} al ${fecha(d.nuevaISO)}.`) : "";
  const pie = telefono
    ? `Si te va bien, no tienes que hacer nada. Si no, escríbenos por WhatsApp al ${telefono}: ${enlace}`
    : "Si te va bien, no tienes que hacer nada. Si no, avisa al salón cuanto antes.";
  const p = (t: string) => `<p style="font-family:sans-serif;font-size:16px;line-height:1.5">${t}</p>`;
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const htmlPie = telefono
    ? `Si te va bien, no tienes que hacer nada. Si no, <a href="${esc(enlace)}">escríbenos por WhatsApp</a> (${esc(telefono)}).`
    : esc(pie);
  return { asunto: `Tu cita en ${d.salonName} ha cambiado: ${fecha(d.nuevaISO)}`, texto: [principal, pie].join("\n\n"), html: p(esc(principal)) + p(htmlPie) };
}

/**
 * ¿Hay que mandar «Tu cita ha cambiado»? (26-oct tarde)
 * - Al deshacer, solo si a la clienta ya se le avisó de la hora que se
 *   deshace (si no, nunca supo del cambio y no hay nada que contarle).
 * - Nunca si la hora nueva es la que ya conoce (la última avisada o, si no
 *   se ha avisado nunca, la que tenía la cita).
 * - Solo citas futuras y no canceladas.
 */
export function debeAvisarCambioDeCita(d: {
  antesISO: string;
  nuevaISO: string;
  avisadaISO?: string | null;
  deshacer?: boolean;
  estado?: string;
  ahora?: Date;
}): boolean {
  if (d.estado === "cancelled" || d.estado === "no-show") return false;
  const nueva = Date.parse(d.nuevaISO);
  if (!Number.isFinite(nueva) || nueva <= (d.ahora ?? new Date()).getTime()) return false;
  if (d.deshacer) return !!d.avisadaISO && Date.parse(d.avisadaISO) !== nueva;
  const conocida = Date.parse(d.avisadaISO || d.antesISO);
  return !Number.isFinite(conocida) || conocida !== nueva;
}
