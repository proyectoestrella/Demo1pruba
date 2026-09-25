import type { Appointment, SalonProfile, Service } from "./mock/types";
import { cuandoEnPalabras, horaEnPalabras } from "./avisos";

/**
 * SUSTITUTO TEMPORAL de `src/lib/senal.ts` de la rama de BACKEND (contrato en
 * su docs/contrato-senal.md). Mismas firmas y mismos nombres, para que la UI
 * del lote 9j se escriba ya contra la interfaz definitiva.
 *
 * CONECTAR al fusionar: borrar este fichero, importar de `@/lib/senal` y
 * cambiar las acciones de abajo (`accionesSenal`) por las de la store de
 * BACKEND (`pedirSenal`, `recibirSenal`, `deshacerSenalRecibida`,
 * `darMasTiempoSenal`, `cancelAppointment(id, { porSalon: true })`).
 *
 * Principio: siShow nunca recibe ni mueve dinero. «Recibida» la marca la
 * dueña cuando ve el Bizum en su banco.
 */

export type EstadoSenal = "no_aplica" | "por_pedir" | "pedida" | "vencida" | "recibida" | "aplicada" | "devuelta" | "retenida" | "anulada";
export type MetodoSenal = NonNullable<Appointment["depositMethod"]>;
export type CodigoErrorSenal = "SENAL_SIN_IMPORTE" | "SENAL_ESTADO_INVALIDO" | "SENAL_IMPORTE_INVALIDO" | "SENAL_CITA_CERRADA";

export interface ReglaSenal {
  activa: boolean;
  modo: "fijo" | "porcentaje";
  importeEur: number;
  porcentaje: number;
  aplicaA: "todas" | "nuevas" | "duracion" | "servicios";
  minMinutos: number;
  serviceIds: string[];
  plazoHoras: 1 | 2 | 3 | 4;
  bizum: string;
  automatica: boolean;
  liberacionAutomatica: boolean;
  horasCancelacion: number;
  plantilla: string;
}

export const PLANTILLA_SENAL_POR_DEFECTO =
  "Hola {nombre}, para reservar tu cita en {salon} {cuando} te pedimos una señal de {importe} € por Bizum al {bizum}, {plazo}. Si no vienes o cancelas tarde, la señal no se devuelve. ¡Gracias!";

const MARCADORES_SENAL = ["{nombre}", "{salon}", "{importe}", "{bizum}", "{cuando}", "{plazo}"] as const;
export { MARCADORES_SENAL };

/** La regla con todos los valores por defecto resueltos. Usarla siempre en vez de los campos sueltos. */
export function reglaSenal(p: Partial<SalonProfile>): ReglaSenal {
  const plazo = p.depositDeadlineHours ?? 4;
  return {
    activa: !!p.depositEnabled && !!p.depositBizumPhone?.trim(),
    modo: p.depositMode ?? "fijo",
    importeEur: p.depositAmountEur && p.depositAmountEur > 0 ? p.depositAmountEur : 10,
    porcentaje: Math.min(100, Math.max(1, p.depositPercent ?? 20)),
    aplicaA: p.depositAppliesTo ?? "todas",
    minMinutos: p.depositMinMinutes ?? 60,
    serviceIds: p.depositServiceIds ?? [],
    // 12 y 24 se aceptan por compatibilidad y se tratan como 4.
    plazoHoras: (plazo >= 1 && plazo <= 4 ? plazo : 4) as 1 | 2 | 3 | 4,
    bizum: p.depositBizumPhone?.trim() ?? "",
    automatica: !!p.depositAuto,
    liberacionAutomatica: !!p.depositAutoRelease,
    horasCancelacion: p.depositCancelHours ?? ((p.noShowFeeEur ?? 0) > 0 ? (p.noShowNoticeHours ?? 24) : 24),
    plantilla: p.depositTemplate ?? "",
  };
}

/** ¿Esta reserva lleva señal con la regla? `esNueva` solo importa con «nuevas». */
export function llevaSenal(regla: ReglaSenal, reserva: { duration: number; serviceIds: string[] }, esNueva = true): boolean {
  if (!regla.activa) return false;
  if (regla.aplicaA === "todas") return true;
  if (regla.aplicaA === "nuevas") return esNueva;
  if (regla.aplicaA === "duracion") return reserva.duration >= regla.minMinutos;
  return reserva.serviceIds.some((id) => regla.serviceIds.includes(id));
}

export function servicioLlevaSenal(regla: ReglaSenal, s: Pick<Service, "id" | "durationMin">): boolean {
  return llevaSenal(regla, { duration: s.durationMin, serviceIds: [s.id] });
}

/** Importe de la señal de una reserva: fijo, o el porcentaje de su precio redondeado al euro. */
export function importeSenal(regla: ReglaSenal, precioEur: number): number {
  return regla.modo === "porcentaje" ? Math.max(1, Math.round((precioEur * regla.porcentaje) / 100)) : regla.importeEur;
}

const cerrada = (a: Pick<Appointment, "status" | "start">, ahora: Date) =>
  a.status === "cancelled" || a.status === "no-show" || +new Date(a.start) < +ahora;

/** Estado de la señal de una cita. «vencida» se calcula: pedida y pasado el plazo sin recibir. */
export function estadoSenal(a: Appointment, regla: ReglaSenal, ahora = new Date(), esNueva = true): EstadoSenal {
  const guardado = a.depositStatus ?? (a.depositReceivedAt ? "recibida" : a.depositRequestedAt ? "pedida" : undefined);
  if (guardado === "pedida") {
    const vence = a.depositDueAt ? +new Date(a.depositDueAt) : Infinity;
    return +ahora >= vence && !cerrada(a, ahora) ? "vencida" : "pedida";
  }
  if (guardado) return guardado;
  return llevaSenal(regla, a, esNueva) && !cerrada(a, ahora) ? "por_pedir" : "no_aplica";
}

/** Vencimiento: el plazo desde ahora, nunca después del inicio de la cita. */
export function venceSenal(a: Pick<Appointment, "start">, horas: number, ahora = new Date()): string {
  return new Date(Math.min(+ahora + horas * 3_600_000, +new Date(a.start))).toISOString();
}

/**
 * Paso previo obligatorio a «Pedir señal»: calcula importe y vencimiento sin
 * cambiar nada. Solo si la dueña confirma que envió el WhatsApp se marca
 * «pedida» (`accionesSenal().pedirSenal`).
 */
export function prepararPeticionSenal(
  a: Appointment,
  regla: ReglaSenal,
  importeDeLaCita?: number,
  ahora = new Date(),
): { ok: true; importeEur: number; venceISO: string } | { ok: false; error: CodigoErrorSenal } {
  if (cerrada(a, ahora)) return { ok: false, error: "SENAL_CITA_CERRADA" };
  const e = estadoSenal(a, regla, ahora);
  if (!["no_aplica", "por_pedir", "pedida", "vencida"].includes(e)) return { ok: false, error: "SENAL_ESTADO_INVALIDO" };
  const importe = importeDeLaCita ?? a.depositEur ?? (regla.activa ? importeSenal(regla, a.priceEur) : 0);
  if (!importe || importe <= 0) return { ok: false, error: "SENAL_SIN_IMPORTE" };
  return { ok: true, importeEur: importe, venceISO: venceSenal(a, regla.plazoHoras, ahora) };
}

export function mensajeErrorSenal(c: CodigoErrorSenal): string {
  return {
    SENAL_SIN_IMPORTE: "Esta cita no lleva señal con tu regla y no hay importe. Configúrala en Ajustes › Señal.",
    SENAL_ESTADO_INVALIDO: "Eso no se puede hacer con la señal en su estado actual.",
    SENAL_IMPORTE_INVALIDO: "El importe tiene que ser mayor que 0.",
    SENAL_CITA_CERRADA: "La cita ya pasó, está cancelada o no vino: su señal ya no se puede tocar.",
  }[c];
}

export function marcadoresQueFaltan(plantilla: string): string[] {
  if (!plantilla.trim()) return [];
  return ["{importe}", "{bizum}"].filter((m) => !plantilla.includes(m));
}

export function rellenarPlantillaSenal(
  plantilla: string,
  d: { nombre: string; salon: string; importeEur: number; bizum: string; startISO: string; venceISO: string },
): string {
  const vence = new Date(d.venceISO);
  const hoy = new Date();
  const mismoDia = vence.toDateString() === hoy.toDateString();
  const plazo = `antes de las ${horaEnPalabras(d.venceISO)}${mismoDia ? " de hoy" : ` del ${vence.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`}`;
  const v: Record<string, string> = {
    "{nombre}": d.nombre,
    "{salon}": d.salon,
    "{importe}": String(d.importeEur),
    "{bizum}": d.bizum,
    "{cuando}": cuandoEnPalabras(d.startISO),
    "{plazo}": plazo,
  };
  return (plantilla.trim() || PLANTILLA_SENAL_POR_DEFECTO).replace(/\{[a-z]+\}/g, (m) => v[m] ?? m).replace(/\s+/g, " ").trim();
}

/** El único mensaje de la web pública sobre la señal. `null` si esa reserva no la lleva. */
export function textoSenalPublico(
  regla: ReglaSenal,
  reserva: { duration: number; serviceIds: string[]; priceEur: number },
  nombreSalon: string,
  eur: (n: number) => string,
): string | null {
  if (!llevaSenal(regla, reserva, true)) return null;
  const importe = eur(importeSenal(regla, reserva.priceEur));
  const quien = regla.aplicaA === "nuevas" ? "Si es tu primera visita, " : "";
  const como = regla.automatica
    ? `al reservar te enseñamos el Bizum de ${nombreSalon} para una señal de ${importe}`
    : `${nombreSalon} te pedirá por WhatsApp una señal de ${importe} por Bizum`;
  return `${quien}${quien ? como : como.charAt(0).toUpperCase() + como.slice(1)}. Se descuenta al pagar y se devuelve si cancelas con más de ${regla.horasCancelacion} h de antelación.`;
}

/** Respuesta a «¿Hace falta pagar por adelantado?» y texto de la tarjeta de cancelación de la web. */
export function respuestaFaqSenal(regla: ReglaSenal, eur: (n: number) => string): string {
  if (!regla.activa) return "No. Pagas en el salón, después del servicio.";
  const cuanto = regla.modo === "porcentaje" ? `el ${regla.porcentaje} % del servicio` : eur(regla.importeEur);
  const quien = {
    todas: "Sí, una señal de",
    nuevas: "Solo si es tu primera visita: una señal de",
    duracion: `Solo en los servicios de ${regla.minMinutos} minutos o más: una señal de`,
    servicios: "Solo en algunos servicios, marcados «con señal»: una señal de",
  }[regla.aplicaA];
  const cuando = regla.automatica ? "al reservar" : "cuando el salón te confirma la cita";
  return `${quien} ${cuanto} por Bizum ${cuando}. Se descuenta del precio y se devuelve si cancelas con más de ${regla.horasCancelacion} h de antelación.`;
}

export function resumenCancelacionSenal(regla: ReglaSenal, eur: (n: number) => string): string {
  if (!regla.activa) return "Sin señal: cancelar no tiene coste.";
  const cuanto = regla.modo === "porcentaje" ? `el ${regla.porcentaje} % del servicio` : eur(regla.importeEur);
  return `Señal de ${cuanto}. Se devuelve si la clienta cancela con más de ${regla.horasCancelacion} h; si no viene o cancela más tarde, el salón se la queda.`;
}

/**
 * Acciones de la señal. CONECTAR: hoy escriben en la cita con
 * `updateAppointment` y `cancelAppointment` de esta rama; al fusionar, se
 * sustituyen por las acciones de la store de BACKEND con los mismos nombres,
 * que además suben a Supabase y validan el estado.
 */
export function accionesSenal(store: {
  appointments: Appointment[];
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  cancelAppointment: (id: string) => void;
}) {
  const cita = (id: string) => store.appointments.find((a) => a.id === id);
  return {
    pedirSenal(id: string, importeEur: number, venceISO: string, plazoHoras: number): CodigoErrorSenal | null {
      if (!cita(id)) return "SENAL_ESTADO_INVALIDO";
      store.updateAppointment(id, {
        depositStatus: "pedida",
        depositEur: importeEur,
        depositRequestedAt: new Date().toISOString(),
        depositDueAt: venceISO,
        depositPeriodHours: plazoHoras as Appointment["depositPeriodHours"],
      });
      return null;
    },
    recibirSenal(id: string, o: { metodo: MetodoSenal; importeEur?: number }): CodigoErrorSenal | null {
      const a = cita(id);
      if (!a) return "SENAL_ESTADO_INVALIDO";
      const importe = o.importeEur ?? a.depositEur;
      if (!importe || importe <= 0) return "SENAL_IMPORTE_INVALIDO";
      store.updateAppointment(id, { depositStatus: "recibida", depositReceivedAt: new Date().toISOString(), depositReceivedEur: importe, depositMethod: o.metodo });
      return null;
    },
    deshacerSenalRecibida(id: string): CodigoErrorSenal | null {
      const a = cita(id);
      if (!a || (a.depositStatus ?? (a.depositReceivedAt ? "recibida" : "")) !== "recibida") return "SENAL_ESTADO_INVALIDO";
      store.updateAppointment(id, { depositStatus: a.depositRequestedAt ? "pedida" : "por_pedir", depositReceivedAt: undefined, depositReceivedEur: undefined, depositMethod: undefined });
      return null;
    },
    darMasTiempoSenal(id: string, plazoHoras: number): CodigoErrorSenal | null {
      const a = cita(id);
      if (!a) return "SENAL_ESTADO_INVALIDO";
      store.updateAppointment(id, { depositStatus: "pedida", depositDueAt: venceSenal(a, a.depositPeriodHours && a.depositPeriodHours <= 4 ? a.depositPeriodHours : plazoHoras) });
      return null;
    },
    /** Liberar el hueco: la cita se cancela por el salón y la señal no recibida se anula. */
    liberarHueco(id: string): CodigoErrorSenal | null {
      if (!cita(id)) return "SENAL_ESTADO_INVALIDO";
      store.updateAppointment(id, { depositStatus: "anulada" });
      store.cancelAppointment(id);
      return null;
    },
  };
}
