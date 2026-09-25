import type { BookingAnswers } from "./mock/types";
import type { BusinessType } from "./business-type";
import { MAX_RESPUESTA, obligatoriasSinResponder, preguntasPorDefecto, respuestasLegibles } from "./preguntas-reserva";

const MARKER = "[siShow:reserva:v1:";

export function bookingQuestionsEnabled(
  profile: { bookingQuestionsEnabled?: boolean },
  type: BusinessType,
): boolean {
  return profile.bookingQuestionsEnabled ?? (type === "peluqueria" || type === "unisex");
}

/**
 * Normaliza respuestas de cualquier pregunta: solo cadenas, recortadas, sin
 * vacías y con longitud acotada. La validación por tipo de pregunta (opción,
 * sí/no, número) la hace `limpiarRespuestas` en lib/preguntas-reserva.ts, que
 * conoce el formulario del salón; esto es lo que se guarda y se relee.
 */
export function cleanBookingAnswers(value: BookingAnswers | undefined): BookingAnswers | undefined {
  if (!value) return undefined;
  const result: BookingAnswers = {};
  for (const [id, v] of Object.entries(value).slice(0, 40)) {
    if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,60}$/.test(id)) continue;
    const t = v.trim().slice(0, MAX_RESPUESTA);
    if (t) result[id] = t;
  }
  return Object.keys(result).length ? result : undefined;
}

/** Compatibilidad: ¿están respondidas las tres preguntas de siempre? Ver `obligatoriasSinResponder`. */
export function bookingAnswersComplete(answers: BookingAnswers | undefined): boolean {
  const preguntas = preguntasPorDefecto({ bookingQuestionsEnabled: true, bookingQuestionsRequired: true }, "peluqueria");
  return obligatoriasSinResponder(preguntas, answers).length === 0;
}

/** TODO: crear una columna JSON propia. Hasta entonces viaja en `note`, ya disponible en producción. */
export function serializeBookingNote(note: string | undefined, answers: BookingAnswers | undefined): string | undefined {
  const cleaned = cleanBookingAnswers(answers);
  if (!cleaned) return note;
  return `${note?.trim() ?? ""}\n${MARKER}${encodeURIComponent(JSON.stringify(cleaned))}]`.trim();
}

export function parseBookingNote(note: string | null | undefined): { note?: string; answers?: BookingAnswers } {
  if (!note) return {};
  const marker = note.lastIndexOf(`\n${MARKER}`);
  const start = marker >= 0 ? marker + 1 : note.startsWith(MARKER) ? 0 : -1;
  if (start < 0 || !note.endsWith("]")) return { note };
  try {
    const raw = JSON.parse(decodeURIComponent(note.slice(start + MARKER.length, -1))) as BookingAnswers;
    // Todas las claves: también las de preguntas propias del salón.
    const answers = cleanBookingAnswers(raw);
    return { note: note.slice(0, marker >= 0 ? marker : 0).trim() || undefined, answers };
  } catch {
    return { note };
  }
}

/** Compatibilidad: líneas «Pregunta: respuesta» con el formulario de siempre. Mejor `respuestasLegibles` con el perfil. */
export function bookingAnswerLines(
  answers: BookingAnswers | undefined,
  perfil: Parameters<typeof respuestasLegibles>[0] = {},
  tipo: BusinessType = "peluqueria",
): string[] {
  return respuestasLegibles(perfil, tipo, cleanBookingAnswers(answers)).map((r) => `${r.pregunta} ${r.respuesta}`);
}
