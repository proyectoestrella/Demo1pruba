/** Errores estables para la respuesta pública; no exponemos detalles del servidor. */
import type { Appointment } from "./mock/types";
import type { ClienteDeCita } from "./salon-sync";

export const ERROR_HUECO_OCUPADO = "RESERVA_HUECO_OCUPADO";
export const ERROR_BLOQUEO_MANUAL = "RESERVA_BLOQUEO_MANUAL";

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
