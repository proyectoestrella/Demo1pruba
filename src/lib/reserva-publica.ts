/**
 * Lo que la reserva pública de un salón REAL necesita para ser fiable, sin
 * nada de red ni de React: errores estables, la firma de un intento, el
 * solape de intervalos y el horario por profesional. Lo usan el servidor
 * (`syncAppointment`) y la pantalla de reserva, así que no puede haber dos
 * criterios distintos de «este hueco está libre».
 */
import type { Appointment, SalonProfile } from "./mock/types";
import type { ClienteDeCita } from "./salon-sync";
import { inferBusinessType } from "./business-type";
import { trabajaEn } from "./horario-equipo";
import { employeesForType } from "./mock/salon";

/** Errores estables para la respuesta pública; no exponemos detalles del servidor. */
export const ERROR_HUECO_OCUPADO = "RESERVA_HUECO_OCUPADO";
export const ERROR_BLOQUEO_MANUAL = "RESERVA_BLOQUEO_MANUAL";
export const ERROR_FUERA_HORARIO = "RESERVA_FUERA_HORARIO";

/** Zona horaria en la que el salón lee su agenda; la del servidor no cuenta. */
export const ZONA_HORARIA_SALON = "Europe/Madrid";

/** Firma de la solicitud; los ids locales temporales no cuentan como cambios. */
export function firmaReservaPublica(
  slug: string,
  cita: Omit<Appointment, "id">,
  cliente: ClienteDeCita,
): string {
  return JSON.stringify([slug, { ...cita, clientId: null }, cliente]);
}

export function mensajeErrorReserva(error: unknown): string {
  const mensaje = error instanceof Error ? error.message : String(error);
  if (mensaje.includes(ERROR_HUECO_OCUPADO)) return "Esa hora ya no está disponible, elige otra.";
  if (mensaje.includes(ERROR_FUERA_HORARIO))
    return "Esa hora queda fuera del horario de la profesional, elige otra.";
  if (mensaje.includes(ERROR_BLOQUEO_MANUAL))
    return "No podemos confirmar tu reserva online; llama al salón.";
  return "No hemos podido enviar tu solicitud. Tus datos siguen aquí; inténtalo de nuevo.";
}

/** Los intervalos son semiabiertos: dos citas contiguas no se solapan. */
export function haySolape(
  inicio: string,
  duracionMin: number,
  citas: Array<{ start_at: string; duration_min: number; status: string }>,
): boolean {
  const desde = Date.parse(inicio);
  const hasta = desde + duracionMin * 60_000;
  return citas.some((cita) => {
    if (cita.status === "cancelled" || cita.status === "no-show") return false;
    const otroInicio = Date.parse(cita.start_at);
    return otroInicio < hasta && otroInicio + cita.duration_min * 60_000 > desde;
  });
}

/**
 * Día de la semana (como `Date.getDay()`) y minuto del día de un instante,
 * vistos desde la zona horaria del salón. El servidor corre en UTC y el
 * navegador de la clienta en la suya: la agenda se lee siempre en la del salón.
 */
export function momentoLocal(
  iso: string,
  timeZone = ZONA_HORARIA_SALON,
): { weekday: number; minuto: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    weekday: dias.indexOf(valor("weekday")),
    minuto: Number(valor("hour")) * 60 + Number(valor("minute")),
  };
}

/**
 * ¿Trabaja esa profesional en ese hueco según el perfil del salón (horario
 * del local y `teamHours` por persona)? Es la misma regla con la que la web
 * pública pinta las horas, aplicada en el servidor para que un enlace viejo o
 * una petición fabricada no cuelen una cita a las tres de la mañana.
 *
 * Un `employeeId` desconocido no trabaja nunca.
 */
export function profesionalTrabaja(
  perfil: Pick<SalonProfile, "name" | "tagline" | "team" | "teamHours" | "openingHours" | "teamIds">,
  employeeId: string,
  inicioISO: string,
  duracionMin: number,
  timeZone = ZONA_HORARIA_SALON,
): boolean {
  const equipo = employeesForType(
    inferBusinessType(perfil.tagline, perfil.name),
    perfil.team,
    perfil.teamHours,
    perfil.openingHours,
    perfil.teamIds,
  );
  const profesional = equipo.find((e) => e.id === employeeId);
  if (!profesional) return false;
  const { weekday, minuto } = momentoLocal(inicioISO, timeZone);
  return trabajaEn(profesional, weekday, minuto, duracionMin);
}
