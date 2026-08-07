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
      "Agenda, negocio y crecimiento. Cada bloque agrupa las pantallas que sueles usar juntas.",
  },
  {
    selector: '[data-tour="kpis"]',
    title: "Los números de hoy",
    description:
      "Citas, ingresos, ocupación, clientes nuevos y cancelaciones. El porcentaje compara con el periodo anterior y la minigráfica muestra la tendencia.",
  },
  {
    selector: '[data-tour="revenue-chart"]',
    title: "Ingresos de los últimos 30 días",
    description: "Pasa el ratón por la curva para ver la facturación de cada día.",
  },
  {
    selector: '[data-tour="today-list"]',
    title: "Las citas de hoy",
    description:
      "Pulsa cualquier cita para ver el detalle del cliente, cambiar su estado o consultar su historial.",
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
    onDestroyed: markTourSeen,
  });
  d.drive();
}
