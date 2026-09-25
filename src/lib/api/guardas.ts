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
  else if (estado === "completed" || estado === "no-show" || estado === "late") out.add("cita.marcar-asistencia");
  else if (estado) out.add("cita.editar");
  if (k.some((c) => c === "paidAt" || c === "paymentMethod")) out.add("cita.cobrar");
  if (k.some((c) => c === "start" || c === "employeeId" || c === "duration")) out.add("cita.mover");
  if (k.some((c) => c.startsWith("deposit"))) out.add("senal.gestionar");
  if (k.some((c) => c === "reminderSentAt")) out.add("cita.recordar");
  const resto = k.filter((c) => !["status", "paidAt", "paymentMethod", "start", "employeeId", "duration", "reminderSentAt"].includes(c) && !c.startsWith("deposit"));
  if (resto.length) out.add("cita.editar");
  return [...out];
}

const CLAVES_WEB = new Set(["name", "tagline", "about", "address", "phone", "instagram", "photoCount", "galleryPhotos", "rating", "reviewCount", "specialties", "heroImage", "faq"]);
const CLAVES_EQUIPO = new Set(["team", "teamIds", "teamHours"]);
const CLAVES_CARTA = new Set(["menu"]);

/** Acciones de un parche del perfil, según las claves que toca. */
export function accionesDeParchePerfil(claves: string[]): AccionId[] {
  const out = new Set<AccionId>();
  for (const c of claves) {
    if (CLAVES_WEB.has(c)) out.add("web.editar");
    else if (CLAVES_EQUIPO.has(c)) out.add("equipo.editar");
    else if (CLAVES_CARTA.has(c)) out.add("servicio.editar");
    else if (c === "plan") out.add("plan.gestionar");
    else out.add("salon.editar");
  }
  return [...out];
}

/**
 * Exige todas las acciones sobre todas las profesionales afectadas. Lanza
 * `PermisoDenegado` con la primera que falte.
 */
export function exigirAcciones(acceso: Acceso, acciones: AccionId[], profesionales: Array<string | null | undefined> = []): void {
  const sobre = [...new Set(profesionales.filter((x): x is string => !!x))];
  for (const a of acciones) {
    const ok = sobre.length ? sobre.every((e) => tienePermiso(acceso, a, e)) : tienePermiso(acceso, a);
    if (!ok) throw new PermisoDenegado(a);
  }
}
