import type { SalonProfile } from "./mock/types";

/**
 * SUSTITUTO TEMPORAL de `src/lib/preguntas-reserva.ts` de la rama de BACKEND
 * (contrato en su docs/contrato-preguntas.md). Mismos tipos y nombres.
 *
 * CONECTAR al fusionar: borrar este fichero e importar de
 * `@/lib/preguntas-reserva`. La reserva pública (book.tsx) de BACKEND es la
 * que pinta estas preguntas; en esta rama book.tsx no se toca.
 */

export type TipoPreguntaReserva = "texto" | "si_no" | "opcion" | "numero";

export interface PreguntaReserva {
  /** Estable: es la clave de la respuesta guardada. No cambia al editar el texto. */
  id: string;
  texto: string;
  tipo: TipoPreguntaReserva;
  opciones?: string[];
  obligatoria: boolean;
  /** Desactivar en vez de borrar conserva el texto para leer respuestas antiguas. */
  activa: boolean;
  /** Ids de la carta; vacío o ausente = todos. */
  servicios?: string[];
  /** Con «si_no»: se pide si responde «Sí». */
  detalle?: { id: string; texto: string; obligatorio: boolean };
}

export const MAX_PREGUNTAS = 12;

/** Las tres de siempre, con sus textos e ids de siempre. */
export function preguntasPorDefecto(): PreguntaReserva[] {
  return [
    { id: "hairLength", texto: "¿Qué largo de pelo tienes?", tipo: "opcion", opciones: ["Corto", "Medio", "Largo", "Muy largo"], obligatoria: false, activa: true },
    { id: "hasColor", texto: "¿Llevas color o tinte ahora?", tipo: "si_no", obligatoria: false, activa: true, detalle: { id: "colorDetail", texto: "¿Qué color o tinte llevas?", obligatorio: false } },
    {
      id: "recentChemical",
      texto: "¿Te has hecho algún tratamiento químico en el último mes (tinte, mechas, alisado, permanente)?",
      tipo: "si_no",
      obligatoria: false,
      activa: true,
      detalle: { id: "chemicalDetail", texto: "¿Cuál y cuándo?", obligatorio: false },
    },
  ];
}

/**
 * La lista efectiva del salón. Con lista guardada, manda la lista (aunque
 * esté vacía). Sin ella, las de siempre según los interruptores antiguos.
 */
export function preguntasDelSalon(p: Partial<SalonProfile>, preguntasActivadasPorTipo = true): PreguntaReserva[] {
  if (p.preguntasReserva) return p.preguntasReserva;
  const activadas = p.bookingQuestionsEnabled ?? preguntasActivadasPorTipo;
  return preguntasPorDefecto().map((q) => ({ ...q, activa: activadas, obligatoria: !!p.bookingQuestionsRequired }));
}

/** Las que se enseñan en una reserva: activas y que aplican a algún servicio elegido, en orden. */
export function preguntasAplicables(lista: PreguntaReserva[], serviceIds: string[]): PreguntaReserva[] {
  return lista.filter((q) => q.activa && (!q.servicios?.length || q.servicios.some((id) => serviceIds.includes(id))));
}

/** Id nuevo que no choca con los existentes ni con los de sus detalles. */
export function idPreguntaNueva(lista: PreguntaReserva[]): string {
  const usados = new Set(lista.flatMap((q) => [q.id, q.detalle?.id].filter(Boolean) as string[]));
  let n = 1;
  while (usados.has(`pregunta${n}`) || usados.has(`pregunta${n}Detalle`)) n++;
  return `pregunta${n}`;
}

/**
 * Comprobación blanda: ¿el texto pregunta por datos de salud? Son categoría
 * especial (RGPD art. 9) y siShow no los guarda. No bloquea: avisa.
 */
export function preguntaPorSalud(texto: string): boolean {
  return /alergi|embaraz|medic|enferm|salud|diabet|tratamiento m[eé]dico/i.test(texto);
}
