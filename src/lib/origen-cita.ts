import type { Appointment } from "./mock/types";

const MARCA = "[siShow:origen:v1:tpv123]";

/** TODO: usar una columna de procedencia cuando exista una migración de datos. */
export function serializarOrigen(note: string | undefined, origen: Appointment["origen"]): string | undefined {
  return origen === "tpv123" ? `${note?.trim() ?? ""}\n${MARCA}`.trim() : note;
}

export function leerOrigen(note: string | null | undefined): { note?: string; origen?: Appointment["origen"] } {
  if (!note) return {};
  if (!note.endsWith(MARCA)) return { note };
  const previo = note.slice(0, -MARCA.length);
  if (previo && !previo.endsWith("\n")) return { note };
  return { note: previo.trim() || undefined, origen: "tpv123" };
}
