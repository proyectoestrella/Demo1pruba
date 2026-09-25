/**
 * Preguntas del formulario de reserva, personalizables por salón.
 *
 * Tomás, 25/09/2026: «que las preguntas que se hacen al formulario las pueda
 * personalizar». Antes eran tres preguntas fijas pintadas en la reserva. Ahora
 * son una lista ordenada en el perfil (`preguntasReserva`); las tres de
 * siempre son sus entradas por defecto, con los mismos ids, así que un salón
 * que no toque nada ve y guarda exactamente lo mismo que antes.
 *
 * Funciones puras. Ver docs/contrato-preguntas.md.
 */
import type { BookingAnswers, PreguntaReserva, SalonProfile } from "./mock/types";
import type { BusinessType } from "./business-type";

/** Límites de las respuestas: una reserva no es un sitio para un texto largo. */
export const MAX_RESPUESTA = 200;
export const MAX_DETALLE = 120;
export const MAX_PREGUNTAS = 12;

/** ¿Se preguntaba por defecto en este tipo de negocio? (regla de siempre). */
function activasPorDefecto(perfil: { bookingQuestionsEnabled?: boolean }, tipo: BusinessType): boolean {
  return perfil.bookingQuestionsEnabled ?? (tipo === "peluqueria" || tipo === "unisex");
}

/** Las tres preguntas de siempre, con sus ids y textos de siempre. */
export function preguntasPorDefecto(
  perfil: { bookingQuestionsEnabled?: boolean; bookingQuestionsRequired?: boolean },
  tipo: BusinessType,
): PreguntaReserva[] {
  const activa = activasPorDefecto(perfil, tipo);
  const obligatoria = !!perfil.bookingQuestionsRequired;
  return [
    { id: "hairLength", texto: "¿Qué largo de pelo tienes?", tipo: "opcion", opciones: ["Corto", "Medio", "Largo", "Muy largo"], obligatoria, activa },
    { id: "hasColor", texto: "¿Llevas color o tinte ahora?", tipo: "si_no", obligatoria, activa, detalle: { id: "colorDetail", texto: "¿Cuál es tu color o tinte?", obligatorio: obligatoria } },
    { id: "recentChemical", texto: "¿Te has hecho algún tratamiento químico en el último mes (tinte, mechas, alisado, permanente)?", tipo: "si_no", obligatoria, activa, detalle: { id: "chemicalDetail", texto: "¿Qué tratamiento químico?", obligatorio: obligatoria } },
  ];
}

/** La lista del salón: la suya si la tiene (aunque esté vacía), y si no, la de siempre. */
export function preguntasDelSalon(
  perfil: Pick<SalonProfile, "preguntasReserva" | "bookingQuestionsEnabled" | "bookingQuestionsRequired">,
  tipo: BusinessType,
): PreguntaReserva[] {
  if (Array.isArray(perfil.preguntasReserva)) return perfil.preguntasReserva.slice(0, MAX_PREGUNTAS);
  return preguntasPorDefecto(perfil, tipo);
}

/** Las que se enseñan para esta reserva: activas y que aplican a alguno de sus servicios. En orden. */
export function preguntasAplicables(preguntas: PreguntaReserva[], serviceIds: string[]): PreguntaReserva[] {
  return preguntas.filter(
    (p) => p.activa && (!p.servicios?.length || p.servicios.some((id) => serviceIds.includes(id))),
  );
}

/** Valor válido para esa pregunta, o `undefined`. */
function valorValido(p: PreguntaReserva, valor: string | undefined): string | undefined {
  const v = (valor ?? "").trim();
  if (!v) return undefined;
  switch (p.tipo) {
    case "si_no":
      return v === "Sí" || v === "No" ? v : undefined;
    case "opcion":
      return p.opciones?.includes(v) ? v : undefined;
    case "numero": {
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? String(n) : undefined;
    }
    case "texto":
      return v.slice(0, MAX_RESPUESTA);
  }
}

/**
 * Deja solo las respuestas a estas preguntas, válidas por su tipo, y el
 * detalle solo si la respuesta es «Sí». `undefined` si no queda ninguna.
 */
export function limpiarRespuestas(preguntas: PreguntaReserva[], respuestas: BookingAnswers | undefined): BookingAnswers | undefined {
  if (!respuestas) return undefined;
  const out: BookingAnswers = {};
  for (const p of preguntas) {
    const v = valorValido(p, respuestas[p.id]);
    if (v === undefined) continue;
    out[p.id] = v;
    if (p.detalle && v === "Sí") {
      const d = (respuestas[p.detalle.id] ?? "").trim().slice(0, MAX_DETALLE);
      if (d) out[p.detalle.id] = d;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** Ids de las preguntas obligatorias sin respuesta válida (incluye el detalle obligatorio de un «Sí»). */
export function obligatoriasSinResponder(preguntas: PreguntaReserva[], respuestas: BookingAnswers | undefined): string[] {
  const limpias = limpiarRespuestas(preguntas, respuestas) ?? {};
  const faltan: string[] = [];
  for (const p of preguntas) {
    if (p.obligatoria && !limpias[p.id]) faltan.push(p.id);
    if (p.detalle?.obligatorio && limpias[p.id] === "Sí" && !limpias[p.detalle.id]) faltan.push(p.detalle.id);
  }
  return faltan;
}

export interface RespuestaLegible {
  id: string;
  pregunta: string;
  respuesta: string;
}

/** Texto legible de una clave sin pregunta (pregunta retirada del formulario después de reservar). */
function preguntaRetirada(id: string): string {
  return `Pregunta retirada (${id})`;
}

/**
 * Las respuestas de una cita con el texto de su pregunta, en el orden del
 * formulario del salón. Las respuestas a preguntas que el salón ya retiró se
 * enseñan igual al final, para no perder lo que dijo la clienta.
 */
export function respuestasLegibles(
  perfil: Pick<SalonProfile, "preguntasReserva" | "bookingQuestionsEnabled" | "bookingQuestionsRequired">,
  tipo: BusinessType,
  respuestas: BookingAnswers | undefined,
): RespuestaLegible[] {
  if (!respuestas) return [];
  // Todas las del salón, activas o no: una pregunta desactivada hoy pudo
  // responderse ayer. Y las de siempre, por si el salón pasó a lista propia.
  const conocidas = [...preguntasDelSalon(perfil, tipo), ...preguntasPorDefecto({}, tipo)];
  const vistas = new Set<string>();
  const out: RespuestaLegible[] = [];
  for (const p of conocidas) {
    if (vistas.has(p.id)) continue;
    vistas.add(p.id);
    if (p.detalle) vistas.add(p.detalle.id);
    const v = (respuestas[p.id] ?? "").trim();
    if (!v) continue;
    const detalle = p.detalle ? (respuestas[p.detalle.id] ?? "").trim() : "";
    out.push({ id: p.id, pregunta: p.texto, respuesta: detalle ? `${v} · ${detalle}` : v });
  }
  for (const [id, valor] of Object.entries(respuestas)) {
    if (vistas.has(id) || !valor?.trim()) continue;
    out.push({ id, pregunta: preguntaRetirada(id), respuesta: valor.trim() });
  }
  return out;
}

/** Id nuevo y estable para una pregunta que crea el salón. */
export function idPreguntaNueva(existentes: PreguntaReserva[], ahora: number = Date.now()): string {
  const usados = new Set(existentes.flatMap((p) => [p.id, p.detalle?.id].filter(Boolean) as string[]));
  let id = `p${ahora.toString(36)}`;
  for (let n = 2; usados.has(id); n++) id = `p${ahora.toString(36)}${n}`;
  return id;
}
