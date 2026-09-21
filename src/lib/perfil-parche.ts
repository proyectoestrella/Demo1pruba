/**
 * La fusión del perfil del salón: lo que hay en el servidor, más lo que este
 * navegador acaba de cambiar.
 *
 * Vive en su propio módulo, fuera de `api/salons.functions.ts`, para poder
 * probarla en unidad sin arrastrar `createServerFn` ni el cliente de Supabase.
 */

/**
 * Fusión de un nivel: las claves del parche pisan, las demás se conservan tal
 * y como están en el servidor.
 *
 * Es deliberadamente superficial. El perfil tiene arrays (equipo, carta,
 * galería, FAQ) y una fusión «inteligente» de arrays no existe: si el dueño
 * borra un servicio, el array llega con uno menos y tiene que ganar entero.
 * Una clave presente en el parche se sustituye completa; una clave ausente no
 * se toca. `undefined` cuenta como «no tocar» (así viaja por JSON de todas
 * formas), y `null` como «vaciar a propósito».
 */
export function fusionarPerfil(
  servidor: Record<string, unknown>,
  parche: Record<string, unknown>,
): Record<string, unknown> {
  const salida = { ...servidor };
  for (const [clave, valor] of Object.entries(parche)) {
    if (valor === undefined) continue;
    salida[clave] = valor;
  }
  return salida;
}
