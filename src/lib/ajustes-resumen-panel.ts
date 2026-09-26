/**
 * Ajustes, lote 16: las secciones con su id, palabras para el buscador y el
 * resumen del VALOR ACTUAL que se ve en su cabecera sin abrirla. Puro, con test.
 */
import type { SalonProfile } from "./mock/types";
import { preferenciasDe, VISTAS_CALENDARIO } from "./preferencias-calendario";
import { reglaSenal } from "./senal";
import { recargoActivo } from "./recargo-activo";

export type IdSeccionAjustes = "agenda" | "reservas" | "mensajes" | "plantones" | "calendarios" | "historial" | "accesos" | "asistente" | "colores";

export const SECCIONES_AJUSTES: { id: IdSeccionAjustes; titulo: string; palabras: string }[] = [
  { id: "agenda", titulo: "Tu agenda", palabras: "duración calendario vista semana día horas visibles primer día lunes móvil iphone google suscripción" },
  { id: "reservas", titulo: "Reservas por internet", palabras: "preguntas reservar reparto agenda franjas web cierre últimos minutos" },
  { id: "mensajes", titulo: "Mensajes de WhatsApp", palabras: "whatsapp confirmación recordatorio plantilla texto mensaje" },
  { id: "plantones", titulo: "Plantones y señal", palabras: "plantón no vino penalización recargo señal bizum fianza depósito cancelación" },
  { id: "calendarios", titulo: "Calendarios", palabras: "google apple iphone externo sincronizar ocupado" },
  { id: "historial", titulo: "Historial de cambios", palabras: "historial deshacer quién cambió auditoría" },
  { id: "accesos", titulo: "Accesos", palabras: "accesos roles usuarios equipo invitar permisos contraseña" },
  { id: "asistente", titulo: "Cómo usar el asistente", palabras: "asistente preguntas ejemplos ayuda" },
  { id: "colores", titulo: "Colores", palabras: "colores servicio profesional calendario paleta" },
];

const normal = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** ¿Encaja la sección con lo buscado? Todas las palabras tienen que aparecer. */
export function seccionCoincide(id: IdSeccionAjustes, texto: string): boolean {
  const s = SECCIONES_AJUSTES.find((x) => x.id === id);
  if (!s) return false;
  const hay = normal(`${s.titulo} ${s.palabras}`);
  return normal(texto).split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

/** El valor actual de cada sección, en una línea. */
export function valorActual(id: IdSeccionAjustes, p: SalonProfile): string {
  switch (id) {
    case "agenda": {
      const c = preferenciasDe(p.calendario);
      const vista = VISTAS_CALENDARIO.find((v) => v.id === c.vista)?.label ?? "Semana";
      return `${vista} · ${c.desde}:00–${c.hasta}:00${p.duracionFlexible ? " · duración al aceptar" : ""}`;
    }
    case "reservas": {
      const pregs = p.preguntasReserva?.length;
      const preguntas = pregs ? `${pregs} ${pregs === 1 ? "pregunta" : "preguntas"}` : p.bookingQuestionsEnabled === false ? "Sin preguntas" : "Preguntas de siempre";
      return `${preguntas} · reparto ${p.smartSpread ? "activado" : "desactivado"}`;
    }
    case "mensajes": {
      const propias = [p.plantillas?.confirmacion, p.plantillas?.recordatorio].filter((t) => t?.trim()).length;
      return propias ? `${propias} ${propias === 1 ? "mensaje propio" : "mensajes propios"}` : "Mensajes de siempre";
    }
    case "plantones": {
      const r = reglaSenal(p);
      const plantones = recargoActivo(p) ? `Plantón ${p.noShowFeeEur} €` : "Sin penalización";
      const senal = r.activa ? (r.modo === "porcentaje" ? `señal ${r.porcentaje} %` : `señal ${r.importeFijoEur} €`) : "sin señal";
      return `${plantones} · ${senal}`;
    }
    case "colores": {
      const n = Object.keys(p.coloresServicio ?? {}).length + Object.keys(p.coloresProfesional ?? {}).length;
      return n ? `${n} ${n === 1 ? "color elegido" : "colores elegidos"}` : "Colores automáticos";
    }
    default:
      return "";
  }
}
