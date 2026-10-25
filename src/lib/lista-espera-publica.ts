import { planDe } from "./plan";
import { rutaIncluidaEnPlan } from "./plan-basico";

/** Mensajes para la clienta cuando no se ha podido apuntar a la lista de espera. */
export function mensajeErrorEspera(reason?: string): string {
  switch (reason) {
    case "RESERVA_PRIVACIDAD_NO_CONFIRMADA": return "Confirma que has leído la información sobre el tratamiento de tus datos.";
    case "TELEFONO_INVALIDO": return "Ese teléfono no parece válido. Revísalo y vuelve a enviar.";
    case "NOMBRE_INVALIDO": return "Escribe un nombre de al menos 2 caracteres.";
    case "RESERVA_DEMASIADAS": return "Hay demasiadas solicitudes seguidas. Espera un rato o llama al salón.";
    case "ESPERA_LLENA": return "La lista de espera está completa ahora mismo. Llama al salón.";
    case "ESPERA_SIN_PLAN": return "Este salón no tiene lista de espera en la web. Llama al salón.";
    case "ESPERA_SERVICIO_NO_DISPONIBLE": return "Ese servicio ya no está disponible. Vuelve a elegirlo.";
    default: return "No hemos podido apuntarte. Tus datos siguen aquí; inténtalo de nuevo o llama al salón.";
  }
}

/**
 * ¿Ofrece la web de este salón apuntarse a la lista de espera? Solo si su plan
 * incluye la pantalla «Lista de espera»: en el Básico la gerente no la ve, y
 * una clienta apuntada ahí no la atendería nadie (25-oct, PeluChic).
 */
export function webOfreceListaEspera(perfil: { plan?: string | null; slug?: string | null }): boolean {
  return rutaIncluidaEnPlan("/app/waitlist", planDe(perfil, false), perfil.slug);
}
