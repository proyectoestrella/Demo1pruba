/**
 * Tour guiado del panel de gestión, con driver.js
 * (https://github.com/kamranahmedse/driver.js, MIT).
 *
 * Los pasos se enganchan a atributos `data-tour="..."` puestos en el layout y en
 * la home del panel. Si un elemento no está en el DOM (por ejemplo la barra
 * lateral en móvil, o el gráfico si estás en otra pantalla) ese paso se salta:
 * driver.js reventaría el tour con un selector que no existe.
 */
import { driver } from "driver.js";

/** Marca en localStorage de que el usuario ya vio el tour. */
const SEEN_KEY = "trimly-tour-visto";

type Step = { selector: string; title: string; description: string };

const STEPS: Step[] = [
  {
    selector: '[data-tour="nav"]',
    title: "Tu panel, por bloques",
    description:
      "Lo de cada día arriba; el salón (equipo, servicios, tu página) y el crecimiento debajo.",
  },
  {
    selector: '[data-tour="kpis"]',
    title: "Los números de hoy",
    description:
      "Citas, huecos libres, ingresos estimados y cuántas solicitudes te esperan. Pulsa una cifra para ir a su pantalla.",
  },
  {
    selector: '[data-tour="pending-requests"]',
    title: "Esto te espera",
    description: "Confirma cada solicitud y queda en tu agenda. El aviso a la clienta lo mandas tú por WhatsApp desde su ficha.",
  },
  {
    selector: '[data-tour="today-list"]',
    title: "Ahora y siguientes",
    description:
      "Pulsa cualquier cita para ver el detalle de la clienta, cambiar su estado o consultar su historial.",
  },
  {
    selector: '[data-tour="assistant"]',
    title: "Pregunta por tus datos",
    description:
      "El asistente responde con los números reales de tu salón: ocupación, huecos flojos, servicio estrella…",
  },
  {
    selector: '[data-tour="new-appointment"]',
    title: "Crear una cita a mano",
    description: "Para las reservas que entran por teléfono o sin cita previa.",
  },
];

export function hasSeenTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // Sin localStorage no auto-arrancamos: mejor pasarse de discreto.
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* modo privado o storage bloqueado: no pasa nada */
  }
}

export function startTour() {
  const steps = STEPS.filter((s) => document.querySelector(s.selector)).map((s) => ({
    element: s.selector,
    popover: { title: s.title, description: s.description },
  }));
  if (steps.length === 0) return;

  const d = driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.65,
    stagePadding: 6,
    stageRadius: 12,
    popoverClass: "trimly-tour",
    nextBtnText: "Siguiente",
    prevBtnText: "Atrás",
    doneBtnText: "Entendido",
    progressText: "{{current}} de {{total}}",
    steps,
    // driver.js crea su aspa con `aria-label="Close"` escrito a fuego y no
    // ofrece ninguna opción para cambiarlo: un lector de pantalla anunciaba
    // "Close" en medio de un tour que dice "Atrás" y "Siguiente". Este gancho
    // corre cada vez que se pinta el globo, así que arregla todos los pasos y
    // no solo el primero.
    onPopoverRender: (popover) => {
      const cerrar = popover.closeButton;
      if (!cerrar) return;
      cerrar.setAttribute("aria-label", "Cerrar");
      cerrar.setAttribute("title", "Cerrar");
    },
    onDestroyed: markTourSeen,
  });
  d.drive();
}
