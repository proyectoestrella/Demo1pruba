import type { Client } from "./mock/types";

/**
 * Política de plantón (enlace de demo, claves "q"/"w" — ver demo-profile.ts).
 *
 * Adam (The Best Shave & Barber) no quiere cobrar por adelantado las citas
 * normales, pero sí bloquear a quien ya dejó plantado una vez hasta que pague
 * (o él se lo perdone) los `noShowFeeEur` € pactados. Este módulo es el único
 * sitio que sabe comparar un teléfono tecleado en la reserva pública con la
 * ficha de un cliente — así la web y cualquier otra pantalla que lo necesite
 * usan siempre la misma normalización.
 */

/**
 * Reduce un teléfono a sus últimos 9 dígitos (el número español sin
 * prefijo). "+34 600 000 007", "600000007" y "34 600 000 007" deben
 * reconocerse como el mismo cliente aunque se tecleen distinto en el
 * mostrador o en la web — comparar cadenas tal cual falla con cualquier
 * espacio o el prefijo de más.
 */
export function normalizePhone(phone: string | undefined | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.slice(-9);
}

/**
 * Cliente con una penalización pendiente (`penaltyEur > 0`) cuyo teléfono
 * coincide con el tecleado. `undefined` si no hay coincidencia o el teléfono
 * tecleado aún no tiene 9 dígitos — no tiene sentido bloquear mientras la
 * persona sigue escribiendo.
 */
export function findClientWithPenalty(
  clients: Client[],
  phoneInput: string | undefined | null,
): Client | undefined {
  const target = normalizePhone(phoneInput);
  if (target.length < 9) return undefined;
  return clients.find((c) => (c.penaltyEur ?? 0) > 0 && normalizePhone(c.phone) === target);
}

/** ¿Empieza la cita dentro de las próximas `noticeHours`? Cancelar dentro de ese margen cuenta como plantón. */
export function isWithinNoticeWindow(
  startISO: string,
  noticeHours: number,
  now: Date = new Date(),
): boolean {
  const startMs = new Date(startISO).getTime();
  const marginMs = noticeHours * 60 * 60_000;
  return startMs - now.getTime() < marginMs;
}
