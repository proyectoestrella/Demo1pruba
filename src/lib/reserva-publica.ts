/**
 * Lo que la reserva pública de un salón REAL necesita para ser fiable, sin
 * nada de red ni de React: errores estables, la firma de un intento, el
 * solape de intervalos y el horario por profesional. Lo usan el servidor
 * (`syncAppointment`) y la pantalla de reserva, así que no puede haber dos
 * criterios distintos de «este hueco está libre».
 */
import { lavadoDe } from "./appointment-services";
import type { Appointment, SalonProfile, Service } from "./mock/types";
import type { ClienteDeCita } from "./salon-sync";
import { inferBusinessType } from "./business-type";
import { trabajaEnFecha } from "./horario-equipo";
import { employeesForType } from "./mock/salon";
import { servicesForType } from "./mock/salon";
import { sumServices } from "./appointment-services";
import { duracionDeAgenda } from "./duracion-flexible";
import { ZONA_HORARIA_SALON, fechaEnZona, momentoLocal, zonaDelSalon } from "./zona-horaria";
import { cabeCitaEnAgenda } from "./solape";

export { ZONA_HORARIA_SALON, momentoLocal } from "./zona-horaria";

/** Errores estables para la respuesta pública; no exponemos detalles del servidor. */
export const ERROR_HUECO_OCUPADO = "RESERVA_HUECO_OCUPADO";
export const ERROR_BLOQUEO_MANUAL = "RESERVA_BLOQUEO_MANUAL";
export const ERROR_FUERA_HORARIO = "RESERVA_FUERA_HORARIO";
export const ERROR_PRIVACIDAD_NO_CONFIRMADA = "RESERVA_PRIVACIDAD_NO_CONFIRMADA";
export const ERROR_RESPUESTAS_RESERVA = "RESERVA_RESPUESTAS_INVALIDAS";
export const ERROR_SERVICIO_PROFESIONAL = "RESERVA_SERVICIO_PROFESIONAL";
export const ERROR_BLOQUEO_AGENDA = "RESERVA_BLOQUEO_AGENDA";
export const ERROR_DATOS_RESERVA = "RESERVA_DATOS_INVALIDOS";
export const ERROR_RESERVA_PASADA = "RESERVA_PASADA";
export const ERROR_NOMBRE_INVALIDO = "NOMBRE_INVALIDO";
export const ERROR_TELEFONO_INVALIDO = "TELEFONO_INVALIDO";
export const ERROR_RESERVA_LEJANA = "RESERVA_LEJANA";
export const ERROR_DEMASIADAS_RESERVAS = "RESERVA_DEMASIADAS";
export const ERROR_ESPERA_LLENA = "ESPERA_LLENA";
export const ERROR_ESPERA_SERVICIO = "ESPERA_SERVICIO_NO_DISPONIBLE";
/** El plan del salón no incluye lista de espera: la web no debe recoger datos que nadie verá. */
export const ERROR_ESPERA_SIN_PLAN = "ESPERA_SIN_PLAN";

/** Tope de entradas en la lista de espera de un salón: la web pública no puede llenarla sin límite. */
export const MAX_LISTA_ESPERA_POR_SALON = 150;

/** Topes de la reserva pública (M4, auditoría 18-oct-2026). */
export const HORIZONTE_RESERVA_DIAS = 365;
export const MAX_RESERVAS_POR_TELEFONO_Y_DIA = 5;
export const MAX_RESERVAS_PUBLICAS_POR_SALON_Y_HORA = 60;

/** La casilla acredita que se mostró la información; no expresa una base legal de consentimiento. */
export function haLeidoAvisoPrivacidad(valor: unknown): valor is true {
  return valor === true;
}

/** La lista explica todos los motivos que desactivan Confirmar en el paso de datos. */
export function motivosDatosReserva(datos: {
  nombre: string;
  telefonoValido: boolean;
  sinProfesional: boolean;
  privacidadLeida: boolean;
  faltaPolitica: boolean;
  bloqueada: boolean;
  faltanRespuestas: boolean;
  sending: boolean;
  resolviendo: boolean;
}): string[] {
  const faltas: string[] = [];
  if (datos.nombre.trim().length < 2) faltas.push("nombre (mínimo 2 caracteres)");
  if (!datos.telefonoValido) faltas.push("teléfono válido");
  if (datos.sinProfesional) faltas.push("profesional disponible para los servicios");
  if (!datos.privacidadLeida) faltas.push("aceptar el aviso de privacidad");
  if (datos.faltaPolitica) faltas.push("aceptar la política de recargo");
  if (datos.bloqueada) faltas.push("contactar con el salón para reservar");
  if (datos.faltanRespuestas) faltas.push("completar las preguntas de la reserva");
  if (datos.sending) faltas.push("terminar el envío");
  if (datos.resolviendo) faltas.push("comprobar el salón");
  return faltas;
}

/** Una reserva pública solo puede crear una cita futura con un instante válido. */
export function inicioReservaPublicaEsFuturo(inicioISO: string, ahora = new Date()): boolean {
  const inicio = Date.parse(inicioISO);
  return Number.isFinite(inicio) && inicio > ahora.getTime();
}

/**
 * La única duración, precio y carta válidos para una reserva pública. El
 * navegador manda ids, no importes de confianza: se vuelve a leer la carta
 * del perfil que vive en el servidor. Con duración flexible devuelve el
 * extremo alto, el mismo que se guarda y bloquea en la agenda.
 */
export function datosReservaPublicaDesdeCarta(
  perfil: Pick<SalonProfile, "name" | "tagline" | "menu" | "duracionFlexible"> & Partial<Pick<SalonProfile, "lavado" | "descripcionesServicios">>,
  serviceIds: string[],
): { durationMin: number; priceEur: number } | null {
  if (serviceIds.length === 0) return null;
  const carta = servicesForType(inferBusinessType(perfil.tagline, perfil.name), perfil.menu);
  const porId = new Map(carta.map((servicio) => [servicio.id, servicio]));
  const elegidos = serviceIds.map((id) => porId.get(id));
  if (elegidos.some((servicio) => !servicio || servicio.active === false)) return null;
  const servicios = elegidos as Service[];
  const { durationMin, priceEur } = sumServices(servicios, lavadoDe(perfil, carta));
  if (durationMin <= 0 || !Number.isFinite(priceEur)) return null;
  return { durationMin: duracionDeAgenda(durationMin, !!perfil.duracionFlexible), priceEur };
}

/** Identifica el esquema que impediría guardar el acuse; las reservas deben fallar cerradas. */
export function faltaColumnaAcusePrivacidad(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("privacy_notice_acknowledged_at"),
  );
}

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
  if (mensaje.includes(ERROR_PRIVACIDAD_NO_CONFIRMADA))
    return "Confirma que has leído la información sobre el tratamiento de tus datos.";
  if (mensaje.includes(ERROR_RESPUESTAS_RESERVA))
    return "Revisa y completa las preguntas de la reserva.";
  if (mensaje.includes(ERROR_SERVICIO_PROFESIONAL))
    return "Esa profesional no realiza todos los servicios elegidos. Elige otra.";
  if (mensaje.includes(ERROR_BLOQUEO_AGENDA))
    return "Ese hueco no está disponible. Elige otra hora.";
  if (mensaje.includes(ERROR_DATOS_RESERVA))
    return "Los servicios o su duración han cambiado. Revisa la reserva y vuelve a elegir una hora.";
  if (mensaje.includes(ERROR_NOMBRE_INVALIDO))
    return "Escribe un nombre de al menos 2 caracteres.";
  if (mensaje.includes(ERROR_TELEFONO_INVALIDO))
    return "Ese teléfono no parece válido. Revísalo y vuelve a enviar.";
  if (mensaje.includes(ERROR_RESERVA_PASADA))
    return "Esa hora ya ha pasado. Elige otra hora disponible.";
  if (mensaje.includes(ERROR_RESERVA_LEJANA))
    return "Solo se puede reservar hasta con un año de antelación. Elige una fecha más cercana.";
  if (mensaje.includes(ERROR_DEMASIADAS_RESERVAS))
    return "Hay demasiadas solicitudes seguidas. Espera un rato o llama al salón.";
  return "No hemos podido enviar tu solicitud. Tus datos siguen aquí; inténtalo de nuevo.";
}

/** Los intervalos son semiabiertos: dos citas contiguas no se solapan. */
export function haySolape(
  inicio: string,
  duracionMin: number,
  citas: Array<{ start_at: string; duration_min: number; status: string }>,
): boolean {
  return !cabeCitaEnAgenda(
    citas.map((cita, indice) => ({
      id: String(indice),
      employeeId: "profesional",
      start: cita.start_at,
      duration: cita.duration_min,
      status: cita.status,
    })),
    { employeeId: "profesional", start: inicio, duration: duracionMin, status: "pending" },
  );
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
  perfil: Pick<SalonProfile, "name" | "tagline" | "team" | "teamHours" | "openingHours" | "teamIds" | "timeZone" | "diasEspeciales" | "serviciosPorProfesional">,
  employeeId: string,
  inicioISO: string,
  duracionMin: number,
  timeZone = zonaDelSalon(perfil),
): boolean {
  const equipo = employeesForType(
    inferBusinessType(perfil.tagline, perfil.name),
    perfil.team,
    perfil.teamHours,
    perfil.openingHours,
    perfil.teamIds,
    undefined,
    perfil.serviciosPorProfesional,
  );
  const profesional = equipo.find((e) => e.id === employeeId);
  if (!profesional) return false;
  const { minuto } = momentoLocal(inicioISO, timeZone);
  return trabajaEnFecha(profesional, fechaEnZona(inicioISO, timeZone), minuto, duracionMin, perfil.diasEspeciales);
}
