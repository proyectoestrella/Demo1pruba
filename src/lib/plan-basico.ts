import { planDe, type PlanSishow } from "./plan";

/** Pantallas que no forman parte del Anexo I del plan Básico. */
export const RUTAS_SOLO_COMPLETO = [
  "/app/caja",
  "/app/marketing",
  "/app/insights",
  "/app/waitlist",
  "/app/demos",
] as const;

export function rutaSoloCompleto(path: string): boolean {
  return RUTAS_SOLO_COMPLETO.some((ruta) => path === ruta || path.startsWith(`${ruta}/`));
}

/** La procedencia se guarda solo cuando el salón confirmó que venía de TPV 123. */
export function usaTpv123(perfil: { clientImportOrigin?: string | null }): boolean {
  return perfil.clientImportOrigin === "tpv123";
}

/** ¿Tiene este plan la pantalla? El Básico no ve ninguna de `RUTAS_SOLO_COMPLETO`. */
export function rutaIncluidaEnPlan(path: string, plan: PlanSishow): boolean {
  return plan !== "reservas" || !rutaSoloCompleto(path);
}

/**
 * El plan con el que se pinta el panel. Única fuente para menú, asistente,
 * tarjetas y rutas:
 *  - salón real (ya cargado): el plan guardado; sin él, Básico (`planDe`).
 *  - aún se está resolviendo si el slug es un salón real, o falló: Básico,
 *    lo más restrictivo, para que nada aparezca y luego desaparezca.
 *  - demo de ventas (sin slug, o slug confirmado como demo): su plan o todo.
 */
export function planDelPanel(estado: {
  salonProfile: { plan?: string | null };
  realSalonSlug: string | null;
  publicBookingResolution?: { slug: string; status: string } | null;
}): PlanSishow {
  if (estado.realSalonSlug) return planDe(estado.salonProfile, false);
  const r = estado.publicBookingResolution;
  if (r && r.status !== "demo") return planDe(estado.salonProfile, false);
  return planDe(estado.salonProfile, true);
}
