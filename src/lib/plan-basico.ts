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
