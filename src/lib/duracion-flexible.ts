/** El perfil de un salón real manda; en demo conserva el interruptor del enlace. */
export function duracionFlexibleActiva(
  perfil: { duracionFlexible?: boolean },
  demo: { duracionFlexible?: boolean } | null | undefined,
  esReal: boolean,
): boolean {
  return esReal ? !!perfil.duracionFlexible : (demo ? !!demo.duracionFlexible : !!perfil.duracionFlexible);
}

/** Extremo alto que se guarda y bloquea en agenda cuando la duración es flexible. */
export function duracionDeAgenda(catalogMin: number, flexible: boolean): number {
  if (!flexible) return catalogMin;
  return Math.max(catalogMin, Math.round((catalogMin * 1.5) / 15) * 15);
}

/** Convierte una duración elegida en minutos utilizables o devuelve `null`. */
export function duracionElegida(valor: string | number | null | undefined): number | null {
  const n = Number(valor);
  const minutos = Math.round(n);
  return valor !== "" && valor != null && Number.isFinite(n) && minutos > 0 ? minutos : null;
}

/**
 * Ejecuta un cambio de duración únicamente si el valor elegido es utilizable.
 * Devuelve si se llegó a aplicar, para que esta guardia se pueda probar sin
 * montar el selector de la cita.
 */
export function cambiarDuracionElegida(
  valor: string | number | null | undefined,
  actualizar: (minutos: number) => void,
): boolean {
  const minutos = duracionElegida(valor);
  if (minutos === null) return false;
  actualizar(minutos);
  return true;
}
