/**
 * Qué acciones de la store dejan un cambio deshacible, de qué tipo es y cómo
 * se cuenta (lote 9). Puro: no importa la store. La instalación (envolver las
 * acciones) está al final de `store.ts`.
 */
import type { Appointment, Client, Service } from "./mock/types";
import type { EntidadCambio, TipoCambio } from "./cambios";

/** Tipo de un cambio de cita, por lo que cambió. */
export function tipoCambioCita(antes: Partial<Appointment>, despues: Partial<Appointment>): TipoCambio {
  if (antes.status !== despues.status) {
    const s = despues.status;
    if (s === "cancelled") return antes.status === "pending" ? "cita.rechazar" : "cita.cancelar";
    if (s === "confirmed" && antes.status === "pending") return "cita.confirmar";
    if (s === "completed" || s === "no-show" || s === "late") return "cita.marcar-asistencia";
  }
  if (antes.paidAt !== despues.paidAt || antes.paymentMethod !== despues.paymentMethod) return "cita.cobrar";
  if (antes.depositStatus !== despues.depositStatus || antes.depositDueAt !== despues.depositDueAt) {
    const d = despues.depositStatus;
    if (d === "pedida") return antes.depositStatus === "pedida" ? "senal.prorrogar" : "senal.pedir";
    if (d === "recibida") return "senal.recibir";
    if (d === "aplicada") return "senal.aplicar";
    if (d === "devuelta") return "senal.devolver";
    if (d === "retenida") return "senal.retener";
    if (antes.depositDueAt !== despues.depositDueAt) return "senal.prorrogar";
  }
  if (antes.start !== despues.start || antes.employeeId !== despues.employeeId || antes.duration !== despues.duration) return "cita.mover";
  return "cita.editar";
}

const VERBO: Partial<Record<TipoCambio, string>> = {
  "cita.cancelar": "Cancelada la cita de",
  "cita.rechazar": "Rechazada la solicitud de",
  "cita.confirmar": "Confirmada la cita de",
  "cita.cobrar": "Cobro de la cita de",
  "cita.mover": "Movida la cita de",
  "cita.editar": "Cambiada la cita de",
  "senal.pedir": "Pedida la señal de",
  "senal.prorrogar": "Más tiempo para la señal de",
  "senal.recibir": "Recibida la señal de",
  "senal.aplicar": "Descontada la señal de",
  "senal.devolver": "Devuelta la señal de",
  "senal.retener": "Retenida la señal de",
};

function cuandoCorto(iso: string | undefined, timeZone: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("es-ES", { timeZone, weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      .format(new Date(iso))
      .replace(",", "");
  } catch {
    return "";
  }
}

const pila = (n: string | undefined) => (n ?? "").trim().split(/\s+/)[0] || "la clienta";

/** «Cancelada la cita de Lucía (mar 30 10:00)». */
export function resumenCita(tipo: TipoCambio, antes: Partial<Appointment>, despues: Partial<Appointment>, timeZone: string): string {
  const nombre = pila(despues.clientName ?? antes.clientName);
  const cuando = cuandoCorto(antes.start ?? despues.start, timeZone);
  if (tipo === "cita.marcar-asistencia") {
    const que = despues.status === "no-show" ? "no vino" : despues.status === "late" ? "llegó tarde" : "vino";
    return `Marcado que ${nombre} ${que} (${cuando})`;
  }
  if (tipo === "cita.cobrar") return `${despues.paidAt ? "Cobrada" : "Quitado el cobro de"} la cita de ${nombre} (${cuando})`;
  if (tipo === "cita.mover") return `Movida la cita de ${nombre}: ${cuando} → ${cuandoCorto(despues.start, timeZone)}`;
  return `${VERBO[tipo] ?? "Cambiada la cita de"} ${nombre}${cuando ? ` (${cuando})` : ""}`;
}

export function tipoCambioClienta(accion: string, args: unknown[], antes: Partial<Client>, despues: Partial<Client>): TipoCambio {
  if (accion === "setManualBlock") return "clienta.bloquear";
  if (accion === "clearPenalty") return args[1] === "cobrado" ? "recargo.cobrar" : "recargo.perdonar";
  if ((despues.penaltyEur ?? 0) > 0 && (antes.penaltyEur ?? 0) === 0) return "recargo.aplicar";
  if ((despues.penaltyEur ?? 0) === 0 && (antes.penaltyEur ?? 0) > 0) return "recargo.perdonar";
  return "recargo.aplicar";
}

export function resumenClienta(tipo: TipoCambio, c: Partial<Client>): string {
  const nombre = c.name ?? "la clienta";
  if (tipo === "clienta.bloquear") return `${c.manualBlock ? "Bloqueada" : "Desbloqueada"} la reserva por internet de ${nombre}`;
  if (tipo === "recargo.cobrar") return `Cobrado el recargo de ${nombre}`;
  if (tipo === "recargo.perdonar") return `Perdonado el recargo de ${nombre}`;
  return `Recargo a ${nombre}${c.penaltyEur ? ` (${c.penaltyEur} €)` : ""}`;
}

export function resumenServicio(tipo: TipoCambio, antes: Service | null, despues: Service | null): string {
  const n = (despues ?? antes)?.name ?? "un servicio";
  return tipo === "servicio.borrar" ? `Borrado el servicio «${n}»` : `Cambiado el servicio «${n}»`;
}

/** Acciones de la store que se envuelven y sobre qué entidad actúan (su primer argumento es el id). */
export const ACCIONES_REGISTRADAS: Array<{ accion: string; entidad: EntidadCambio }> = [
  { accion: "updateAppointment", entidad: "cita" },
  { accion: "cancelAppointment", entidad: "cita" },
  { accion: "markPaid", entidad: "cita" },
  { accion: "markDepositRequested", entidad: "cita" },
  { accion: "pedirSenal", entidad: "cita" },
  { accion: "recibirSenal", entidad: "cita" },
  { accion: "deshacerSenalRecibida", entidad: "cita" },
  { accion: "darMasTiempoSenal", entidad: "cita" },
  { accion: "confirmarDevolucionSenal", entidad: "cita" },
  { accion: "extendDepositDeadline", entidad: "cita" },
  { accion: "markDepositReceived", entidad: "cita" },
  { accion: "setManualBlock", entidad: "clienta" },
  { accion: "applyPenalty", entidad: "clienta" },
  { accion: "clearPenalty", entidad: "clienta" },
  { accion: "setDeuda", entidad: "clienta" },
  { accion: "updateService", entidad: "servicio" },
  { accion: "deleteService", entidad: "servicio" },
];

/** Acciones automáticas: lo que hagan por dentro NO se registra como hecho por una persona. */
export const ACCIONES_SIN_REGISTRO = ["liberarSenalesVencidas", "hydrateFromServer", "applyBusinessType", "applyDemo", "vaciarDatosDeEjemplo"];
