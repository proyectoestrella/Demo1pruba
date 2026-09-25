/** El perfil de un salón real manda; en demo conserva el interruptor del enlace. */
export function duracionFlexibleActiva(
  perfil: { duracionFlexible?: boolean },
  demo: { duracionFlexible?: boolean } | null | undefined,
  esReal: boolean,
): boolean {
  return esReal ? !!perfil.duracionFlexible : (demo ? !!demo.duracionFlexible : !!perfil.duracionFlexible);
}

/**
 * Lo que la dueña elige en el desplegable «Duración» del diálogo de nueva
 * cita, o `null` si no ha elegido nada válido.
 *
 * Hace falta porque el desplegable (Radix Select) avisa con una cadena vacía
 * cuando su valor deja de corresponder a una opción: al desmarcar el único
 * servicio la duración de catálogo pasa a 0, no hay opción «0» y llega un
 * `onValueChange("")`. Antes eso se convertía en `Number("") === 0` y la
 * cita se creaba con 0 minutos, es decir, sin ocupar hueco en la agenda.
 * Reproducido el 26/09/2026 en la demo PeluChic (también en la rama
 * congelada): desmarcar «Corte y peinado» y volver a marcarlo.
 */
export function duracionElegida(valor: string | null | undefined): number | null {
  const n = Number(valor);
  return valor !== "" && valor != null && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
