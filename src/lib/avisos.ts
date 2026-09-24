/**
 * Los mensajes que el salón manda DESDE SU PROPIO WhatsApp.
 *
 * Aquí no se envía nada: se prepara el texto y se abre `wa.me` con el mensaje
 * ya escrito, igual que hace `campanas.ts`. Lo manda una persona pulsando
 * "Enviar" en su móvil, y por eso no hay nada en la interfaz que prometa
 * envíos automáticos, recordatorios ni confirmaciones que no existen.
 *
 * Dos casos, los dos salidos de visitas reales:
 *   - la fianza por Bizum de María (PeluChic) a clientas nuevas;
 *   - el aviso al siguiente de la lista de espera cuando se libera un hueco.
 */
import { whatsappUrl } from "./campanas";

/** Fecha y hora de una cita como se dicen por WhatsApp: "el jueves a las 17:00". */
export function cuandoEnPalabras(startISO: string): string {
  const d = new Date(startISO);
  const dia = d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  const hora = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `el ${dia} a las ${hora}`;
}

/** Solo la hora, para el aviso de la lista de espera ("a las 17:00"). */
export function horaEnPalabras(startISO: string): string {
  return new Date(startISO).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export interface PeticionDeFianza {
  clientName: string;
  startISO: string;
  salonName: string;
  /** Número al que se pide el Bizum, tal y como lo escribió el salón en Ajustes. */
  bizumPhone: string;
  importeEur: number;
  /** Hora límite que el salón acaba de fijar al pedir el Bizum. */
  deadlineISO: string;
}

export function plazoDeFianzaEnPalabras(deadlineISO: string, requestedAtISO: string): string {
  const due = new Date(deadlineISO);
  const requested = new Date(requestedAtISO);
  const sameDay = due.toDateString() === requested.toDateString();
  const nextDay = new Date(requested);
  nextDay.setDate(nextDay.getDate() + 1);
  const day = sameDay ? "hoy" : due.toDateString() === nextDay.toDateString()
    ? "mañana" : due.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return `tienes hasta ${day} a las ${horaEnPalabras(deadlineISO)} para hacer el Bizum`;
}

/**
 * El mensaje que pide la señal. Lleva el importe y el número dentro del
 * propio texto a propósito: la clienta tiene que poder copiarlo sin salir del
 * chat, y el salón tiene que poder leerlo antes de enviarlo.
 */
export function mensajeDeFianza(p: PeticionDeFianza, requestedAtISO = new Date().toISOString()): string {
  return (
    `Hola ${p.clientName}, soy ${p.salonName}. ` +
    `Para confirmar tu cita ${cuandoEnPalabras(p.startISO)}, déjanos ${p.importeEur} € de señal por Bizum al ${p.bizumPhone}; ${plazoDeFianzaEnPalabras(p.deadlineISO, requestedAtISO)}. ` +
    `En cuanto lo recibamos te la confirmamos. ¡Gracias!`
  );
}

/** Enlace de WhatsApp listo para abrir con la petición de fianza dentro. */
export function enlaceDeFianza(telefono: string, p: PeticionDeFianza, requestedAtISO?: string): string {
  return whatsappUrl(telefono, mensajeDeFianza(p, requestedAtISO));
}

export interface AvisoDeHueco {
  clientName: string;
  salonName: string;
  /** Hora concreta del hueco que se ha quedado libre. */
  startISO: string;
  /** Nombre del servicio que pedía, si se conoce. */
  servicio?: string;
}

/**
 * Aviso al siguiente de la lista de espera. Lleva la hora concreta, no un
 * "se ha liberado algo": quien lo recibe tiene que poder decir sí o no sin
 * otra llamada de por medio.
 */
export function mensajeDeHueco(a: AvisoDeHueco): string {
  const d = new Date(a.startISO);
  const dia = d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  const servicio = a.servicio ? ` para ${a.servicio.toLowerCase()}` : "";
  return (
    `Hola ${a.clientName}, soy ${a.salonName}. ` +
    `Se nos ha quedado un hueco libre${servicio} el ${dia} a las ${horaEnPalabras(a.startISO)}. ` +
    `¿Te viene bien? Contéstame y te lo guardo.`
  );
}

/** Enlace de WhatsApp listo para abrir con el aviso de hueco dentro. */
export function enlaceDeHueco(telefono: string, a: AvisoDeHueco): string {
  return whatsappUrl(telefono, mensajeDeHueco(a));
}
