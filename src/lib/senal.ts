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
import type { Appointment, EstadoSenalGuardado, MetodoSenal, SalonProfile } from "./mock/types";

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
  | "noShowFeeEur"
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
    // Por defecto, la misma que la casilla «Acepto la política de cancelación»
    // de la reserva: con recargo por plantón, su antelación; sin él, 24 h.
    horasCancelacion: Math.max(
      0,
      Number(p.depositCancelHours ?? ((p.noShowFeeEur ?? 0) > 0 ? (p.noShowNoticeHours ?? 2) : 24)) || 0,
    ),
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

/* ------------------------------------------------------------------------ */
/* Ciclo de vida                                                            */
/* ------------------------------------------------------------------------ */


/**
 * Estado efectivo de la señal de una cita. `vencida` no se guarda: es
 * `pedida` con el plazo pasado. `no_aplica` = la cita no lleva señal.
 *
 *   por_pedir ─pedir─▶ pedida ─(pasa el plazo)─▶ vencida
 *                        │  ▲                      │
 *                        │  └───── dar más tiempo ─┘
 *                        ▼
 *                     recibida ─cobrar─▶ aplicada
 *                        │
 *        cancela a tiempo / salón cancela ─▶ devuelta
 *        cancela tarde / no viene          ─▶ retenida
 *   (sin recibir) cancela, no viene o se libera ─▶ anulada
 */
export type EstadoSenal = "no_aplica" | EstadoSenalGuardado | "vencida";

export type CodigoErrorSenal =
  /** La cita no lleva señal (importe 0 con la regla actual). */
  | "SENAL_SIN_IMPORTE"
  /** Esa transición no se puede hacer desde el estado actual. */
  | "SENAL_ESTADO_INVALIDO"
  /** Importe recibido o devuelto no válido (≤ 0 o no numérico). */
  | "SENAL_IMPORTE_INVALIDO"
  /** La cita ya está cancelada, fue un plantón o ya pasó. */
  | "SENAL_CITA_CERRADA";

export type ResultadoSenal =
  | { ok: true; patch: Partial<Appointment> }
  | { ok: false; error: CodigoErrorSenal };

type CitaCiclo = Pick<
  Appointment,
  | "start"
  | "status"
  | "priceEur"
  | "depositStatus"
  | "depositEur"
  | "depositRequestedAt"
  | "depositDueAt"
  | "depositPeriodHours"
  | "depositReceivedAt"
  | "depositReceivedEur"
  | "depositMethod"
  | "depositAppliedAt"
  | "depositAppliedEur"
  | "depositRefundedAt"
  | "depositRefundedEur"
  | "depositRetainedAt"
>;

const HORA = 3_600_000;
const ok = (patch: Partial<Appointment>): ResultadoSenal => ({ ok: true, patch });
const fallo = (error: CodigoErrorSenal): ResultadoSenal => ({ ok: false, error });
const iso = (ms: number) => new Date(ms).toISOString();

/** Estado guardado, o el que se deduce de las fechas en citas anteriores al 25/09/2026. */
function estadoGuardado(c: CitaCiclo): EstadoSenalGuardado | "no_aplica" {
  if (c.depositStatus) return c.depositStatus;
  if (c.depositReceivedAt) return "recibida";
  if (c.depositRequestedAt) return "pedida";
  return (c.depositEur ?? 0) > 0 ? "por_pedir" : "no_aplica";
}

/** Vencimiento efectivo: el guardado o, en citas antiguas, pedida + plazo. Nunca después de la propia cita. */
export function vencimientoSenal(c: CitaCiclo, ventanaPorDefecto: number = 4): string | undefined {
  if (!c.depositRequestedAt) return c.depositDueAt;
  const due = c.depositDueAt ?? iso(Date.parse(c.depositRequestedAt) + (c.depositPeriodHours ?? ventanaPorDefecto) * HORA);
  return iso(Math.min(Date.parse(due), Date.parse(c.start)));
}

export function estadoSenal(c: CitaCiclo, ahora: Date = new Date()): EstadoSenal {
  const e = estadoGuardado(c);
  if (e === "pedida") {
    const due = vencimientoSenal(c);
    if (due && ahora.getTime() >= Date.parse(due)) return "vencida";
  }
  return e;
}

const CITA_ABIERTA = new Set(["pending", "confirmed"]);

/**
 * Lo que debe una reserva nueva hecha por la web. Con la señal automática
 * nace `pedida` (la web ya enseñó el Bizum y el plazo); si no, `por_pedir`
 * y la pide la dueña. El plazo nunca pasa de la hora de la cita.
 */
export function senalDeReservaNueva(
  regla: ReglaSenal,
  r: ReservaParaSenal,
  startISO: string,
  ahora: Date = new Date(),
): Partial<Appointment> {
  const importe = importeSenal(regla, r);
  if (importe <= 0) return {};
  if (!regla.automatica) return { depositStatus: "por_pedir", depositEur: importe };
  return {
    depositStatus: "pedida",
    depositEur: importe,
    depositRequestedAt: ahora.toISOString(),
    depositPeriodHours: regla.ventanaHoras,
    depositDueAt: iso(Math.min(ahora.getTime() + regla.ventanaHoras * HORA, Date.parse(startISO))),
  };
}

/**
 * La dueña CONFIRMA que ha enviado el WhatsApp de la señal. Solo entonces
 * la señal pasa a `pedida`: abrir WhatsApp no basta (se podía cerrar sin
 * enviar y quedaba «pedida» igual). Vale para pedirla por primera vez o para
 * volver a pedirla tras vencer (plazo nuevo).
 */
export function pedirSenal(c: CitaCiclo, regla: ReglaSenal, importeEur: number, ahora: Date = new Date()): ResultadoSenal {
  if (!CITA_ABIERTA.has(c.status) || Date.parse(c.start) <= ahora.getTime()) return fallo("SENAL_CITA_CERRADA");
  const e = estadoSenal(c, ahora);
  if (!["no_aplica", "por_pedir", "pedida", "vencida"].includes(e)) return fallo("SENAL_ESTADO_INVALIDO");
  const importe = c.depositEur && c.depositEur > 0 ? c.depositEur : Math.round(importeEur);
  if (!(importe > 0)) return fallo("SENAL_SIN_IMPORTE");
  // Reenviar mientras sigue en plazo no lo alarga: «dar más tiempo» es otra acción.
  if (e === "pedida") return ok({ depositStatus: "pedida", depositEur: importe });
  return ok({
    depositStatus: "pedida",
    depositEur: importe,
    depositRequestedAt: ahora.toISOString(),
    depositPeriodHours: regla.ventanaHoras,
    depositDueAt: iso(Math.min(ahora.getTime() + regla.ventanaHoras * HORA, Date.parse(c.start))),
  });
}

/** Otro plazo igual desde ahora (o desde el vencimiento, si aún no ha llegado), sin pasar de la cita. */
export function darMasTiempo(c: CitaCiclo, regla: ReglaSenal, ahora: Date = new Date()): ResultadoSenal {
  if (!CITA_ABIERTA.has(c.status) || Date.parse(c.start) <= ahora.getTime()) return fallo("SENAL_CITA_CERRADA");
  const e = estadoSenal(c, ahora);
  if (e !== "pedida" && e !== "vencida") return fallo("SENAL_ESTADO_INVALIDO");
  const horas = c.depositPeriodHours ?? regla.ventanaHoras;
  const desde = Math.max(Date.parse(vencimientoSenal(c, regla.ventanaHoras)!), ahora.getTime());
  return ok({ depositStatus: "pedida", depositDueAt: iso(Math.min(desde + horas * HORA, Date.parse(c.start))) });
}

/**
 * La dueña ha visto el dinero. Vale aunque el plazo haya vencido (llegó
 * tarde, pero llegó) y aunque no se hubiera pedido (la dejó en mano). El
 * importe por defecto es el debido; puede ser otro si trajo más o menos.
 */
export function recibirSenal(
  c: CitaCiclo,
  datos: { metodo: MetodoSenal; importeEur?: number },
  ahora: Date = new Date(),
): ResultadoSenal {
  const e = estadoSenal(c, ahora);
  if (!["no_aplica", "por_pedir", "pedida", "vencida"].includes(e)) return fallo("SENAL_ESTADO_INVALIDO");
  const importe = datos.importeEur ?? c.depositEur ?? 0;
  if (!Number.isFinite(importe) || importe <= 0) return fallo("SENAL_IMPORTE_INVALIDO");
  return ok({
    depositStatus: "recibida",
    depositReceivedAt: ahora.toISOString(),
    depositReceivedEur: Math.round(importe * 100) / 100,
    depositMethod: datos.metodo,
    ...(c.depositEur ? {} : { depositEur: Math.round(importe * 100) / 100 }),
  });
}

/** «Desmarcar»: se equivocó al marcarla recibida. Vuelve a `pedida` (o `por_pedir` si nunca se pidió). */
export function deshacerRecibida(c: CitaCiclo, ahora: Date = new Date()): ResultadoSenal {
  if (estadoSenal(c, ahora) !== "recibida") return fallo("SENAL_ESTADO_INVALIDO");
  return ok({
    depositStatus: c.depositRequestedAt ? "pedida" : "por_pedir",
    depositReceivedAt: undefined,
    depositReceivedEur: undefined,
    depositMethod: undefined,
  });
}

/**
 * Al cobrar la cita, la señal recibida se descuenta. Devuelve además cuánto
 * queda por cobrar. Si la señal fue mayor que el servicio (cambió a otro más
 * barato), lo que sobra queda «a devolver».
 */
export function aplicarSenal(
  c: CitaCiclo,
  ahora: Date = new Date(),
): { ok: true; patch: Partial<Appointment>; aCobrarEur: number } {
  const precio = c.priceEur;
  if (estadoSenal(c, ahora) !== "recibida") return { ok: true, patch: {}, aCobrarEur: precio };
  const recibido = c.depositReceivedEur ?? c.depositEur ?? 0;
  // Lo que ya estaba «a devolver» por un reajuste no se descuenta: se devuelve.
  const yaADevolver = c.depositRefundedAt ? 0 : (c.depositRefundedEur ?? 0);
  const disponible = Math.max(0, recibido - yaADevolver);
  const aplicado = Math.min(disponible, precio);
  const aDevolver = Math.round((yaADevolver + disponible - aplicado) * 100) / 100;
  return {
    ok: true,
    aCobrarEur: Math.round((precio - aplicado) * 100) / 100,
    patch: {
      depositStatus: "aplicada",
      depositAppliedAt: ahora.toISOString(),
      depositAppliedEur: aplicado,
      ...(aDevolver > 0 ? { depositRefundedEur: aDevolver } : {}),
    },
  };
}

/** Se desmarca el cobro: la señal vuelve a estar recibida, sin aplicar. */
export function desaplicarSenal(c: CitaCiclo): ResultadoSenal {
  if (c.depositStatus !== "aplicada") return ok({});
  return ok({ depositStatus: "recibida", depositAppliedAt: undefined, depositAppliedEur: undefined });
}

/**
 * La cita se cancela. Quién cancela importa:
 *  - la clienta, con más de `horasCancelacion` de antelación → se le devuelve;
 *  - la clienta, más tarde → el salón se la queda (retenida);
 *  - el salón (rechaza la solicitud, libera el hueco) → se devuelve siempre.
 * Sin dinero recibido no hay nada que devolver ni retener: `anulada`.
 */
export function resolverCancelacion(
  c: CitaCiclo,
  regla: ReglaSenal,
  porQuien: "clienta" | "salon",
  ahora: Date = new Date(),
): ResultadoSenal {
  const e = estadoSenal(c, ahora);
  if (e === "por_pedir" || e === "pedida" || e === "vencida") return ok({ depositStatus: "anulada" });
  if (e !== "recibida") return ok({});
  const recibido = c.depositReceivedEur ?? c.depositEur ?? 0;
  const aTiempo = Date.parse(c.start) - ahora.getTime() >= regla.horasCancelacion * HORA;
  if (porQuien === "salon" || aTiempo) {
    return ok({ depositStatus: "devuelta", depositRefundedEur: recibido });
  }
  return ok({ depositStatus: "retenida", depositRetainedAt: ahora.toISOString() });
}

/** No vino: con la señal recibida, el salón se la queda; sin ella, no hay nada. Llegar tarde NO es esto. */
export function resolverPlanton(c: CitaCiclo, ahora: Date = new Date()): ResultadoSenal {
  const e = estadoSenal(c, ahora);
  if (e === "recibida") return ok({ depositStatus: "retenida", depositRetainedAt: ahora.toISOString() });
  if (e === "por_pedir" || e === "pedida" || e === "vencida") return ok({ depositStatus: "anulada" });
  return ok({});
}

/** La dueña confirma que ya ha hecho la devolución (Bizum de vuelta o en mano). */
export function confirmarDevolucion(c: CitaCiclo, ahora: Date = new Date()): ResultadoSenal {
  const aDevolver = c.depositRefundedEur ?? 0;
  if (aDevolver <= 0 || c.depositRefundedAt) return fallo("SENAL_ESTADO_INVALIDO");
  return ok({ depositRefundedAt: ahora.toISOString() });
}

/**
 * ¿Hay que liberar el hueco? Solo si la señal ha vencido, la cita sigue
 * abierta y el salón activó la liberación automática. Sin ella, `vencida`
 * es un aviso y decide la dueña (como hasta ahora).
 */
export function revisarVencimiento(
  c: CitaCiclo,
  regla: ReglaSenal,
  ahora: Date = new Date(),
): { vencida: boolean; liberar: boolean } {
  const vencida = CITA_ABIERTA.has(c.status) && estadoSenal(c, ahora) === "vencida";
  return { vencida, liberar: vencida && regla.liberacionAutomatica };
}

/**
 * La cita se reabre (el «Deshacer» de rechazar o cancelar): la señal vuelve a
 * donde estaba según lo que de verdad pasó con el dinero. Una devolución ya
 * hecha (`depositRefundedAt`) no se deshace sola.
 */
export function reabrirSenal(c: CitaCiclo): ResultadoSenal {
  if (c.depositStatus !== "anulada" && c.depositStatus !== "devuelta" && c.depositStatus !== "retenida") return ok({});
  if (c.depositRefundedAt) return ok({});
  const base = { depositRetainedAt: undefined, depositRefundedEur: undefined };
  if (c.depositReceivedAt) return ok({ ...base, depositStatus: "recibida" });
  if (c.depositRequestedAt) return ok({ ...base, depositStatus: "pedida" });
  return ok({ ...base, depositStatus: (c.depositEur ?? 0) > 0 ? "por_pedir" : undefined });
}

/* ------------------------------------------------------------------------ */
/* Reajustes: cambia el servicio o la hora                                  */
/* ------------------------------------------------------------------------ */

/**
 * Cambia lo que se debe (otro servicio, otro precio). María: «si tenéis que
 * devolverle parte». Sin dinero recibido solo cambia el importe (o se anula
 * si el nuevo servicio no lleva señal). Con la señal recibida:
 *  - el nuevo servicio no lleva señal → se devuelve entera (`devuelta`);
 *  - debe menos → la diferencia queda «a devolver» (sigue `recibida`);
 *  - debe más → la diferencia queda pendiente (ver `diferenciaSenal`).
 */
export function reajustarSenal(c: CitaCiclo, nuevoDebidoEur: number, ahora: Date = new Date()): ResultadoSenal {
  const nuevo = Math.max(0, Math.round(nuevoDebidoEur));
  const e = estadoSenal(c, ahora);
  if (e === "no_aplica") return nuevo > 0 ? ok({ depositStatus: "por_pedir", depositEur: nuevo }) : ok({});
  if (e === "por_pedir" || e === "pedida" || e === "vencida") {
    return nuevo > 0 ? ok({ depositEur: nuevo }) : ok({ depositStatus: "anulada", depositEur: 0 });
  }
  if (e !== "recibida") return ok({});
  const recibido = c.depositReceivedEur ?? c.depositEur ?? 0;
  if (nuevo === 0) return ok({ depositStatus: "devuelta", depositEur: 0, depositRefundedEur: recibido });
  const sobra = Math.round((recibido - nuevo) * 100) / 100;
  return ok({ depositEur: nuevo, depositRefundedEur: sobra > 0 ? sobra : undefined });
}

/** La cita cambia de hora: el plazo de la señal pedida nunca pasa de la nueva hora. */
export function moverSenal(c: CitaCiclo, nuevoStartISO: string, ahora: Date = new Date()): ResultadoSenal {
  const e = estadoSenal({ ...c, start: nuevoStartISO }, ahora);
  if (e !== "pedida" && e !== "vencida") return ok({});
  const due = vencimientoSenal({ ...c, start: nuevoStartISO });
  return due && due !== c.depositDueAt ? ok({ depositDueAt: due }) : ok({});
}

/** Lo que falta por recibir y lo que hay que devolver, para enseñarlo a la dueña. */
export function diferenciaSenal(c: CitaCiclo, ahora: Date = new Date()): { pendienteEur: number; aDevolverEur: number } {
  const e = estadoSenal(c, ahora);
  const recibido = c.depositReceivedEur ?? 0;
  const pendienteEur = e === "recibida" ? Math.max(0, Math.round(((c.depositEur ?? 0) - recibido) * 100) / 100) : 0;
  const aDevolverEur = c.depositRefundedAt ? 0 : Math.max(0, c.depositRefundedEur ?? 0);
  return { pendienteEur, aDevolverEur };
}

/* ------------------------------------------------------------------------ */
/* Texto del WhatsApp                                                       */
/* ------------------------------------------------------------------------ */

/**
 * Marcadores de la plantilla. El salón escribe su texto con ellos y siShow
 * los rellena; un marcador desconocido se deja tal cual para que se vea.
 */
export const MARCADORES_SENAL = ["{nombre}", "{salon}", "{importe}", "{bizum}", "{cuando}", "{plazo}"] as const;

/** La de siempre: exactamente el texto que se enviaba antes de la plantilla. */
export const PLANTILLA_SENAL_POR_DEFECTO =
  "Hola {nombre}, soy {salon}. Para confirmar tu cita {cuando}, déjanos {importe} de señal por Bizum al {bizum}; {plazo}. En cuanto lo recibamos te la confirmamos. ¡Gracias!";

export interface DatosMensajeSenal {
  nombre: string;
  salon: string;
  /** Ya formateado: «20 €». */
  importe: string;
  bizum: string;
  /** «el martes, 29 de septiembre a las 17:00». */
  cuando: string;
  /** «tienes hasta hoy a las 12:00 para hacer el Bizum». */
  plazo: string;
}

/** Rellena la plantilla del salón (o la de siempre si está vacía). */
export function rellenarPlantillaSenal(plantilla: string | undefined, d: DatosMensajeSenal): string {
  const texto = plantilla?.trim() ? plantilla.trim() : PLANTILLA_SENAL_POR_DEFECTO;
  const valores: Record<string, string> = {
    "{nombre}": d.nombre, "{salon}": d.salon, "{importe}": d.importe,
    "{bizum}": d.bizum, "{cuando}": d.cuando, "{plazo}": d.plazo,
  };
  return texto.replace(/\{(nombre|salon|importe|bizum|cuando|plazo)\}/g, (m) => valores[m] ?? m);
}

/** Marcadores imprescindibles que faltan en una plantilla (para avisar en Ajustes). */
export function marcadoresQueFaltan(plantilla: string): string[] {
  return ["{importe}", "{bizum}"].filter((m) => !plantilla.includes(m));
}

/**
 * Frase corta de cancelación y señal para la tarjeta de la portada. Dice lo
 * mismo que la reserva y la FAQ: una sola regla, un solo mensaje.
 */
export function resumenCancelacionSenal(regla: ReglaSenal, eur: (n: number) => string): string {
  const h = regla.horasCancelacion;
  const hasta = h % 24 === 0 && h > 0 ? `Hasta ${h / 24 === 1 ? "24 horas" : `${h / 24} días`} antes` : `Hasta ${h} h antes`;
  if (!regla.activa) return `${hasta}, sin coste y sin dar explicaciones.`;
  const cuanto = regla.modo === "porcentaje" ? `una señal del ${regla.porcentaje} %` : `una señal de ${eur(regla.importeFijoEur)}`;
  return `${hasta}, sin coste. Para confirmar la cita se pide ${cuanto} por Bizum que se descuenta del servicio.`;
}

/** Frase para la dueña por cada código de error (los códigos son el contrato; esto, el texto por defecto). */
export function mensajeErrorSenal(error: CodigoErrorSenal): string {
  switch (error) {
    case "SENAL_SIN_IMPORTE": return "Esta cita no lleva señal con la regla del salón.";
    case "SENAL_ESTADO_INVALIDO": return "La señal de esta cita ya no está en un estado que permita eso.";
    case "SENAL_IMPORTE_INVALIDO": return "El importe tiene que ser mayor que cero.";
    case "SENAL_CITA_CERRADA": return "La cita ya ha pasado o está cancelada: no se puede pedir señal.";
  }
}

/**
 * Prepara el WhatsApp de la señal SIN cambiar nada: comprueba que se puede
 * pedir y calcula el plazo que dirá el mensaje (el mismo que quedará al
 * confirmar el envío, ya topado con la hora de la cita).
 */
export function prepararPeticionSenal(
  c: CitaCiclo,
  regla: ReglaSenal,
  importeEur: number,
  ahora: Date = new Date(),
): { ok: true; importeEur: number; venceISO: string } | { ok: false; error: CodigoErrorSenal } {
  const r = pedirSenal(c, regla, importeEur, ahora);
  if (!r.ok) return r;
  const vence = r.patch.depositDueAt ?? vencimientoSenal(c, regla.ventanaHoras);
  return { ok: true, importeEur: r.patch.depositEur ?? importeEur, venceISO: vence ?? ahora.toISOString() };
}
