/**
 * La vista previa de «Mi página» (lote P).
 *
 * Antes el borrador viajaba entero en el `?d=` del iframe. Con la carta de 60
 * servicios de PeluChic y sus descripciones la dirección pasaba de 22 000
 * caracteres y el servidor la rechazaba (431: cabecera demasiado grande); en
 * Vercel el tope es aún menor. Ahora el borrador se deja en el sessionStorage
 * de la pestaña —el iframe es del mismo origen y lo comparte— y la dirección
 * solo lleva `?previa=<huella>`, que cambia con el borrador para recargarlo.
 */

const PREFIJO = "sishow-previa:";

/** Huella corta del borrador: cambia cuando cambia, para que el iframe recargue. */
export function huellaPrevia(raw: string): string {
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Deja el borrador (ya codificado como un `?d=`) para la vista previa de este salón. */
export function guardarPrevia(slug: string, raw: string): void {
  try {
    globalThis.sessionStorage?.setItem(`${PREFIJO}${slug}`, raw);
  } catch {
    // Sin sessionStorage la vista previa enseña lo publicado, sin más.
  }
}

/** El borrador que dejó Mi página para este salón, si lo hay. */
export function leerPrevia(slug: string | null | undefined): string | undefined {
  if (!slug) return undefined;
  try {
    return globalThis.sessionStorage?.getItem(`${PREFIJO}${slug}`) ?? undefined;
  } catch {
    return undefined;
  }
}
