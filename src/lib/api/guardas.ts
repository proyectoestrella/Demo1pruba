/**
 * Qué acciones implica un cambio, para que el servidor exija los permisos
 * correctos (lote 8). Puro: se prueba sin Supabase.
 *
 * La regla del alcance «propio»: una estilista solo toca citas de SU
 * profesional. Si un cambio mueve una cita de una profesional a otra, hace
 * falta el permiso sobre las DOS.
 */
import type { AccionId } from "../permisos";
import { PermisoDenegado, tienePermiso, type Acceso } from "./autorizacion";

/** Acciones de un parche de cita, según los campos que cambia. */
export function accionesDeParcheCita(patch: Record<string, unknown>): AccionId[] {
  const out = new Set<AccionId>();
  const k = Object.keys(patch);
  const estado = typeof patch.status === "string" ? patch.status : null;
  if (estado === "cancelled") out.add("cita.cancelar");
  else if (estado === "confirmed") out.add("cita.confirmar-solicitud");
  else if (estado === "in-progress" || estado === "completed" || estado === "no-show" || estado === "late")
    out.add("cita.marcar-asistencia");
  else if (estado) out.add("cita.editar");
  if (k.some((c) => c === "paidAt" || c === "paymentMethod")) out.add("cita.cobrar");
  if (k.some((c) => c === "start" || c === "employeeId" || c === "duration")) out.add("cita.mover");
  if (k.some((c) => c.startsWith("deposit"))) out.add("senal.gestionar");
  if (k.some((c) => c === "reminderSentAt")) out.add("cita.recordar");
  const resto = k.filter(
    (c) =>
      ![
        "status",
        "paidAt",
        "paymentMethod",
        "start",
        "employeeId",
        "duration",
        "reminderSentAt",
      ].includes(c) && !c.startsWith("deposit"),
  );
  if (resto.length) out.add("cita.editar");
  return [...out];
}

const CLAVES_WEB = new Set([
  "name",
  "tagline",
  "about",
  "address",
  "nifResponsable",
  "phone",
  "instagram",
  "photoCount",
  "galleryPhotos",
  "rating",
  "reviewCount",
  "specialties",
  "heroImage",
  "faq",
  // Todo lo que edita `/app/web`. Conservarlo junto evita que «editar la
  // web» se convierta en una pantalla a medias para una estilista autorizada.
  "logoUrl",
  "openingHours",
  "menu",
  "priorityHours",
  "whatsapp",
  "enlaces",
  "boletin",
  "galeriaPropia",
  "descripcionesServicios",
]);
const CLAVES_EQUIPO = new Set([
  "team",
  "teamIds",
  "teamHours",
  "serviciosPorProfesional",
  "avataresEquipo",
]);
const CLAVES_CARTA = new Set(["menu"]);
// «Reservas por internet» de Ajustes. Se separa de `salon.editar` para que
// una estilista a quien se le haya dado esta tarea no gane el resto del
// control del salón por una llamada directa a la API.
const CLAVES_RESERVAS = new Set([
  "bookingQuestionsEnabled",
  "bookingQuestionsRequired",
  "preguntasReserva",
  "ocultarPrecioReserva",
  "smartSpread",
  "lastSlotBufferMin",
  "correoPrivacidad",
]);

/** Copia de un perfil únicamente los campos que pertenecen a Mi página. */
export function soloCamposWeb(perfil: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(perfil).filter(([clave]) => CLAVES_WEB.has(clave)));
}

/** Acciones de un parche del perfil, según las claves que toca. */
export function accionesDeParchePerfil(claves: string[]): AccionId[] {
  const out = new Set<AccionId>();
  for (const c of claves) {
    if (CLAVES_WEB.has(c)) out.add("web.editar");
    else if (CLAVES_RESERVAS.has(c)) out.add("reservas.editar");
    else if (CLAVES_EQUIPO.has(c)) out.add("equipo.editar");
    else if (CLAVES_CARTA.has(c)) out.add("servicio.editar");
    else if (c === "avataresClientas") out.add("clienta.editar");
    else if (c === "plan") out.add("plan.gestionar");
    else out.add("salon.editar");
  }
  return [...out];
}

/**
 * Exige todas las acciones sobre todas las profesionales afectadas. Lanza
 * `PermisoDenegado` con la primera que falte.
 */
export function exigirAcciones(
  acceso: Acceso,
  acciones: AccionId[],
  profesionales: Array<string | null | undefined> = [],
): void {
  const sobre = [...new Set(profesionales.map((x) => x ?? null))];
  for (const a of acciones) {
    const ok = sobre.length
      ? sobre.every((e) => tienePermiso(acceso, a, e))
      : tienePermiso(acceso, a);
    if (!ok) throw new PermisoDenegado(a);
  }
}
