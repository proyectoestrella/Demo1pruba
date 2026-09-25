/**
 * La señal (fianza) de un salón: UNA sola regla por salón, definida en su
 * perfil, y su ciclo de vida por cita.
 *
 * Hasta el 25/09/2026 convivían dos «señales» incoherentes: un «depósito del
 * 20 %» genérico en cualquier servicio de más de 90 min (solo texto) y la
 * fianza por Bizum de PeluChic. Ahora hay una: la que el salón configure. Sin
 * configurar, no hay señal y la web no dice nada de depósitos.
 *
 * siShow NUNCA recibe ni mueve dinero (contrato v4.1, cláusula Quinta): la
 * clienta hace el Bizum al salón y la dueña confirma que ha llegado. Aquí solo
 * se decide cuánto, a quién, hasta cuándo y en qué estado está.
 *
 * Funciones puras: sin store, sin red, sin React. Ver `contrato-senal.md`.
 */
import type { Appointment, SalonProfile } from "./mock/types";

/** Horas que tiene la clienta para hacer el Bizum. María pidió de 1 a 4. */
export const VENTANAS_SENAL = [1, 2, 3, 4] as const;
export type VentanaSenal = (typeof VENTANAS_SENAL)[number];

export type ModoImporteSenal = "fijo" | "porcentaje";
/** A qué reservas se les pide señal. */
export type AplicaSenal = "todas" | "nuevas" | "duracion" | "servicios";

/** La regla de señal del salón, con todos los valores por defecto resueltos. */
export interface ReglaSenal {
  activa: boolean;
  modo: ModoImporteSenal;
  /** Euros si `modo` es fijo. */
  importeFijoEur: number;
  /** 1-100 si `modo` es porcentaje. */
  porcentaje: number;
  aplicaA: AplicaSenal;
  /** Con `aplicaA = "duracion"`: minutos a partir de los cuales se pide. */
  minutosMinimos: number;
  /** Con `aplicaA = "servicios"`: ids de la carta que la llevan. */
  servicios: string[];
  ventanaHoras: VentanaSenal;
  bizumTelefono: string;
  /** Si es true, la reserva por la web ya nace con la señal pedida (la web enseña el Bizum). */
  automatica: boolean;
  /** Si es true, una señal vencida libera el hueco sola. Por defecto, avisa y decide la dueña. */
  liberacionAutomatica: boolean;
  /** Horas antes de la cita hasta las que cancelar devuelve la señal. */
  horasCancelacion: number;
  /** Plantilla editable del WhatsApp. Vacía = la de siempre. Ver `mensajeSenal`. */
  plantilla: string;
}

type PerfilSenal = Pick<
  SalonProfile,
  | "depositEnabled"
  | "depositAmountEur"
  | "depositBizumPhone"
  | "depositDeadlineHours"
  | "depositMode"
  | "depositPercent"
  | "depositAppliesTo"
  | "depositMinMinutes"
  | "depositServiceIds"
  | "depositAuto"
  | "depositAutoRelease"
  | "depositCancelHours"
  | "depositTemplate"
  | "noShowNoticeHours"
>;

function ventana(h: number | undefined): VentanaSenal {
  return VENTANAS_SENAL.includes(h as VentanaSenal) ? (h as VentanaSenal) : 4;
}

/** Lee la regla del perfil. Un perfil antiguo (solo `depositEnabled` + importe) sigue igual: fija y a todas. */
export function reglaSenal(perfil: Partial<PerfilSenal> | null | undefined): ReglaSenal {
  const p = perfil ?? {};
  const porcentaje = Math.min(100, Math.max(1, Math.round(Number(p.depositPercent) || 20)));
  return {
    activa: p.depositEnabled === true,
    modo: p.depositMode === "porcentaje" ? "porcentaje" : "fijo",
    importeFijoEur: Math.max(0, Number(p.depositAmountEur) || 10),
    porcentaje,
    aplicaA: (["todas", "nuevas", "duracion", "servicios"] as const).includes(p.depositAppliesTo as AplicaSenal)
      ? (p.depositAppliesTo as AplicaSenal)
      : "todas",
    minutosMinimos: Math.max(0, Number(p.depositMinMinutes) || 60),
    servicios: Array.isArray(p.depositServiceIds) ? p.depositServiceIds.filter(Boolean) : [],
    ventanaHoras: ventana(p.depositDeadlineHours),
    bizumTelefono: (p.depositBizumPhone ?? "").trim(),
    automatica: p.depositAuto === true,
    liberacionAutomatica: p.depositAutoRelease === true,
    horasCancelacion: Math.max(0, Number(p.depositCancelHours ?? p.noShowNoticeHours ?? 24) || 0),
    plantilla: (p.depositTemplate ?? "").trim(),
  };
}

/** Lo que hace falta de una reserva para saber si lleva señal y cuánta. */
export interface ReservaParaSenal {
  serviceIds: string[];
  durationMin: number;
  priceEur: number;
  /** `true` = clienta nueva; `false` = ya conocida; `undefined` = no se sabe (web pública). */
  esNueva?: boolean;
}

/**
 * ¿Lleva señal esta reserva? Con `aplicaA = "nuevas"` y sin saber si es nueva
 * (la web pública no ve las fichas), responde que sí: es la web quien avisa
 * «si es tu primera visita» y la dueña quien decide al pedirla.
 */
export function aplicaSenal(regla: ReglaSenal, r: ReservaParaSenal): boolean {
  if (!regla.activa) return false;
  switch (regla.aplicaA) {
    case "todas":
      return true;
    case "nuevas":
      return r.esNueva !== false;
    case "duracion":
      return r.durationMin >= regla.minutosMinimos;
    case "servicios":
      return r.serviceIds.some((id) => regla.servicios.includes(id));
  }
}

/** Importe de la señal en euros (redondeado al euro). 0 = no lleva. */
export function importeSenal(regla: ReglaSenal, r: ReservaParaSenal): number {
  if (!aplicaSenal(regla, r)) return 0;
  const bruto = regla.modo === "porcentaje" ? (r.priceEur * regla.porcentaje) / 100 : regla.importeFijoEur;
  // Nunca más que el propio servicio.
  return Math.max(0, Math.min(Math.round(bruto), Math.round(r.priceEur)));
}

/** ¿Algún servicio de la carta llevaría señal por sí solo? Para la etiqueta «con señal» de la carta. */
export function servicioLlevaSenal(regla: ReglaSenal, s: { id: string; durationMin: number; priceEur: number }): boolean {
  if (!regla.activa) return false;
  if (regla.aplicaA === "duracion") return s.durationMin >= regla.minutosMinimos;
  if (regla.aplicaA === "servicios") return regla.servicios.includes(s.id);
  return false; // «todas» y «nuevas» no dependen del servicio: no se etiqueta cada uno.
}

/**
 * El ÚNICO mensaje sobre la señal que ve la clienta en la web (reserva,
 * resumen y confirmación). `null` si esta reserva no lleva señal.
 */
export function textoSenalPublico(
  regla: ReglaSenal,
  r: ReservaParaSenal,
  salonName: string,
  eur: (n: number) => string,
): string | null {
  const importe = importeSenal(regla, r);
  if (importe <= 0) return null;
  const primera = regla.aplicaA === "nuevas" && r.esNueva === undefined ? "Si es tu primera visita, " : "";
  const quien = primera ? "te pediremos" : `${salonName} te pedirá`;
  const plazo = `${regla.ventanaHoras} ${regla.ventanaHoras === 1 ? "hora" : "horas"}`;
  if (regla.automatica && regla.bizumTelefono) {
    return `${primera}${primera ? "" : "Para confirmar la cita, "}haz un Bizum de ${eur(importe)} al ${regla.bizumTelefono} en las próximas ${plazo}. Se descuenta del precio; si cancelas con más de ${regla.horasCancelacion} h, te la devolvemos.`;
  }
  return `${primera}${quien} por WhatsApp una señal de ${eur(importe)} por Bizum para confirmar la cita (tendrás ${plazo}). Se descuenta del precio; si cancelas con más de ${regla.horasCancelacion} h, te la devolvemos.`;
}

/** Datos de una cita que la señal necesita (subconjunto de Appointment). */
export type CitaSenal = Pick<Appointment, "serviceIds" | "duration" | "priceEur">;

/** Respuesta de la FAQ «¿Hace falta pagar por adelantado?» según la regla del salón. */
export function respuestaFaqSenal(regla: ReglaSenal, eur: (n: number) => string): string {
  if (!regla.activa) return "No. Se paga en el salón al terminar.";
  const cuanto = regla.modo === "porcentaje" ? `una señal del ${regla.porcentaje} % del servicio` : `una señal de ${eur(regla.importeFijoEur)}`;
  const aQuien =
    regla.aplicaA === "nuevas" ? "Solo en la primera visita: " :
    regla.aplicaA === "duracion" ? `Solo en los servicios de ${regla.minutosMinimos} minutos o más: ` :
    regla.aplicaA === "servicios" ? "Solo en algunos servicios (lo verás al reservar): " : "";
  const pedimos = aQuien ? "pedimos" : "Pedimos";
  return `${aQuien}${pedimos} ${cuanto} por Bizum, con ${regla.ventanaHoras} ${regla.ventanaHoras === 1 ? "hora" : "horas"} para hacerlo. Se descuenta del precio; si cancelas con más de ${regla.horasCancelacion} h de antelación, te la devolvemos.`;
}
