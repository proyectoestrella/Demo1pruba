/**
 * «Cómo usar el asistente»: lo que se le puede preguntar, por temas, con
 * ejemplos del catálogo. EXCLUYE a propósito las familias de plan y las dudas
 * técnicas (§12 y §13 de la especificación): esas no se anuncian.
 *
 * También nombra los apartados de la guía de uso de siShow, para que una
 * remisión diga «§8 Mi página de reservas» y no solo «§8».
 */
import { INTENCIONES } from "./intenciones";

export const APARTADOS_GUIA: Record<string, string> = {
  "0": "Antes de empezar",
  "1": "Hoy",
  "2": "Calendario",
  "3": "Nueva cita",
  "4": "Clientas y ficha",
  "5": "Asistente",
  "6": "Equipo",
  "7": "Servicios y precios",
  "8": "Mi página de reservas",
  "9": "Ajustes",
  "10": "Caja del día",
  "11": "Analítica",
  "12": "Marketing",
};

/** «§6 y §8» → «§6 Equipo y §8 Mi página de reservas». Un número que no existe se deja tal cual. */
export function apartadoGuia(ref: string | undefined | null): string | null {
  if (!ref) return null;
  const nums = [...ref.matchAll(/§\s*(\d+)/g)].map((m) => m[1]);
  if (!nums.length) return null;
  const partes = nums.map((n) => (APARTADOS_GUIA[n] ? `§${n} ${APARTADOS_GUIA[n]}` : `§${n}`));
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

const TEMAS: Array<{ id: string; titulo: string; categorias: string[] }> = [
  { id: "hoy", titulo: "Hoy", categorias: ["hoy"] },
  { id: "agenda", titulo: "Agenda y huecos", categorias: ["agenda"] },
  { id: "clientas", titulo: "Tus clientas", categorias: ["clientas"] },
  { id: "equipo", titulo: "El equipo", categorias: ["equipo"] },
  { id: "servicios", titulo: "Servicios y precios", categorias: ["servicios"] },
  { id: "dinero", titulo: "Dinero", categorias: ["dinero"] },
  { id: "senal", titulo: "Señal", categorias: ["senal"] },
  { id: "marketing", titulo: "Marketing", categorias: ["marketing"] },
  { id: "configuracion", titulo: "Tu salón", categorias: ["configuracion"] },
];

export interface TemaGuia {
  id: string;
  titulo: string;
  /** Preguntas de ejemplo, listas para un botón. */
  ejemplos: string[];
}

/** Un ejemplo por familia, hasta `porTema`. Sin plan ni técnicas. */
export function guiaAsistente(porTema = 6): TemaGuia[] {
  return TEMAS.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    ejemplos: INTENCIONES.filter((i) => i.grupo === "negocio" && t.categorias.includes(i.categoria))
      .slice(0, porTema)
      .map((i) => `¿${i.pregunta.replace(/^¿|\?$/g, "")}?`),
  })).filter((t) => t.ejemplos.length > 0);
}

export const CONSEJOS_GUIA = [
  "Escribe como hablas: «cuántas mañana», «color de Elena», «cuánto llevo este mes».",
  "Con el nombre de la clienta o de la profesional acierto más.",
  "Puedes seguir la conversación: después de «citas hoy», escribe «¿y mañana?».",
  "No soy una inteligencia artificial: respondo con los datos de tu salón y nunca me invento nada.",
];
