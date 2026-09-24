import type { BookingAnswers } from "./mock/types";
import type { BusinessType } from "./business-type";

const MARKER = "[siShow:reserva:v1:";
const FIELDS: Array<keyof BookingAnswers> = [
  "hairLength", "hasColor", "colorDetail", "recentChemical", "chemicalDetail",
];

export function bookingQuestionsEnabled(
  profile: { bookingQuestionsEnabled?: boolean },
  type: BusinessType,
): boolean {
  return profile.bookingQuestionsEnabled ?? (type === "peluqueria" || type === "unisex");
}

export function cleanBookingAnswers(value: BookingAnswers | undefined): BookingAnswers | undefined {
  if (!value) return undefined;
  const result: BookingAnswers = {};
  if (["Corto", "Medio", "Largo", "Muy largo"].includes(value.hairLength ?? "")) result.hairLength = value.hairLength;
  if (value.hasColor === "No" || value.hasColor === "Sí") result.hasColor = value.hasColor;
  if (value.recentChemical === "No" || value.recentChemical === "Sí") result.recentChemical = value.recentChemical;
  if (result.hasColor === "Sí" && value.colorDetail?.trim()) result.colorDetail = value.colorDetail.trim().slice(0, 120);
  if (result.recentChemical === "Sí" && value.chemicalDetail?.trim()) result.chemicalDetail = value.chemicalDetail.trim().slice(0, 120);
  return Object.keys(result).length ? result : undefined;
}

export function bookingAnswersComplete(answers: BookingAnswers | undefined): boolean {
  const a = cleanBookingAnswers(answers);
  return !!a?.hairLength && !!a.hasColor && !!a.recentChemical &&
    (a.hasColor !== "Sí" || !!a.colorDetail) &&
    (a.recentChemical !== "Sí" || !!a.chemicalDetail);
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
    const answers = cleanBookingAnswers(Object.fromEntries(FIELDS.map((key) => [key, raw[key]])) as BookingAnswers);
    return { note: note.slice(0, marker >= 0 ? marker : 0).trim() || undefined, answers };
  } catch {
    return { note };
  }
}

export function bookingAnswerLines(answers: BookingAnswers | undefined): string[] {
  const a = cleanBookingAnswers(answers);
  if (!a) return [];
  return [
    a.hairLength && `Largo de pelo: ${a.hairLength}`,
    a.hasColor && `Color o tinte: ${a.hasColor}${a.colorDetail ? ` · ${a.colorDetail}` : ""}`,
    a.recentChemical && `Tratamiento químico en el último mes: ${a.recentChemical}${a.chemicalDetail ? ` · ${a.chemicalDetail}` : ""}`,
  ].filter((line): line is string => !!line);
}
