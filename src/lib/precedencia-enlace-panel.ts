/**
 * Qué manda al abrir el panel: la URL o lo que hubiera guardado en el navegador.
 *
 * Orden explícito, de más a menos fuerte:
 *   1. `?d=` (demo codificada): se aplica siempre encima de lo guardado.
 *   2. `?s=<slug>`: si es otro salón que el guardado, se descarta lo guardado
 *      (una demo anterior no puede colarse en el panel de este salón).
 *   3. Sin parámetros: se respeta lo guardado.
 */
export type AccionEnlacePanel = "aplicar-demo" | "reiniciar-al-salon" | "mantener";

export function accionPorEnlace(entrada: { s?: unknown; d?: unknown; slugGuardado?: string | null }): AccionEnlacePanel {
  if (typeof entrada.d === "string" && entrada.d) return "aplicar-demo";
  const s = typeof entrada.s === "string" ? entrada.s.trim() : "";
  if (s && s !== (entrada.slugGuardado ?? "")) return "reiniciar-al-salon";
  return "mantener";
}
