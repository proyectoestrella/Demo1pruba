/** El perfil de un salón real manda; en demo conserva el interruptor del enlace. */
export function duracionFlexibleActiva(
  perfil: { duracionFlexible?: boolean },
  demo: { duracionFlexible?: boolean } | null | undefined,
  esReal: boolean,
): boolean {
  return esReal ? !!perfil.duracionFlexible : (demo ? !!demo.duracionFlexible : !!perfil.duracionFlexible);
}
