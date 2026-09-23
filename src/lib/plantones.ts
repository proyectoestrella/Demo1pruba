/**
 * Plantones: cuántos lleva un cliente y hasta cuándo dura su bloqueo.
 *
 * Adam (The Best Shave & Barber) no quiere una lista negra eterna: quiere
 * saber, al abrir la ficha, si esta persona le ha fallado ya varias veces
 * ("2 plantones en los últimos 3 meses") y que el bloqueo de la reserva
 * pública se levante solo pasado un tiempo prudencial, sin tener que
 * acordarse de entrar a quitarlo. Es la idea del "Trusted Client" de Booksy
 * pero sin tarjeta guardada: aquí nadie cobra nada por su cuenta.
 *
 * Funciones puras, sin store ni React, para poder probarlas con `bun test`.
 */
import type { Appointment, Client } from "./mock/types";

const DAY_MS = 86_400_000;

/** Ventana por defecto del contador de la ficha: los últimos 3 meses. */
export const NO_SHOW_WINDOW_DAYS = 90;

/**
 * A los 30 días el bloqueo se levanta solo. No es un perdón: la deuda sigue
 * anotada en la ficha y el dueño puede cobrarla o marcarla como perdonada
 * cuando quiera. Lo que caduca es el "no puedes volver a reservar".
 */
export const PENALTY_EXPIRY_DAYS = 30;

/** Cuántas veces ha plantado este cliente dentro de la ventana indicada. */
export function countNoShows(
  appts: Appointment[],
  clientId: string,
  windowDays = NO_SHOW_WINDOW_DAYS,
  now: Date = new Date(),
): number {
  const desde = now.getTime() - windowDays * DAY_MS;
  return appts.filter(
    (a) =>
      a.clientId === clientId &&
      a.status === "no-show" &&
      +new Date(a.start) >= desde &&
      +new Date(a.start) <= now.getTime(),
  ).length;
}

/**
 * Frase lista para la ficha, o `null` si no ha plantado nunca en la ventana.
 * Se devuelve el texto entero y no solo el número para que las dos pantallas
 * que lo enseñan (ficha del cliente y detalle de cita) digan exactamente lo
 * mismo.
 */
export function noShowSummary(
  appts: Appointment[],
  clientId: string,
  windowDays = NO_SHOW_WINDOW_DAYS,
  now: Date = new Date(),
): string | null {
  const n = countNoShows(appts, clientId, windowDays, now);
  if (n === 0) return null;
  const meses = Math.round(windowDays / 30);
  return `${n} ${n === 1 ? "plantón" : "plantones"} en los últimos ${meses} meses`;
}

/** Cuándo caduca el bloqueo de este cliente, o `null` si no caduca (sin fecha o mantenido a mano). */
export function penaltyExpiresAt(client: Client | undefined): Date | null {
  if (!client || (client.penaltyEur ?? 0) <= 0) return null;
  if (client.penaltyKeep) return null;
  if (!client.penaltyAt) return null;
  const aplicado = new Date(client.penaltyAt);
  if (Number.isNaN(aplicado.getTime())) return null;
  return new Date(aplicado.getTime() + PENALTY_EXPIRY_DAYS * DAY_MS);
}

/**
 * ¿Sigue bloqueado este cliente para volver a reservar?
 *
 * Debe dinero + (el dueño lo mantiene, o no han pasado aún los 30 días, o la
 * ficha es antigua y no tiene fecha de aplicación). Un cliente que no debe
 * nada nunca está bloqueado.
 */
export function isPenaltyActive(client: Client | undefined, now: Date = new Date()): boolean {
  if (!client || (client.penaltyEur ?? 0) <= 0) return false;
  const caduca = penaltyExpiresAt(client);
  if (!caduca) return true;
  return now.getTime() < caduca.getTime();
}

/** Días que quedan para que el bloqueo se levante solo. `null` si no caduca o ya caducó. */
export function daysUntilPenaltyExpiry(
  client: Client | undefined,
  now: Date = new Date(),
): number | null {
  const caduca = penaltyExpiresAt(client);
  if (!caduca) return null;
  const restan = Math.ceil((caduca.getTime() - now.getTime()) / DAY_MS);
  return restan > 0 ? restan : null;
}

/**
 * Frase del motivo de una penalización activa, lista para pantalla. Nunca
 * usa "plantón" ni "no-show" (vocabulario prohibido en el material de venta):
 * siempre "no se presentó" o "llegó tarde".
 */
export function penaltyReasonLabel(client: Client | undefined): string {
  if (!client) return "no se presentó";
  if (client.penaltyReason === "late") {
    const min = client.penaltyLateMinutes;
    return min ? `llegó tarde (${min} min)` : "llegó tarde";
  }
  return "no se presentó";
}

/** Clientes con un recargo pendiente de cobrar o perdonar ahora mismo. */
export function clientsWithPendingPenalty(clients: Client[]): Client[] {
  return clients.filter((c) => (c.penaltyEur ?? 0) > 0);
}
