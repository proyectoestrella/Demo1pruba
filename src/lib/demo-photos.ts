import type { SalonProfile } from "./mock/types";

/** Máximo de fotos que enseña la galería: la rejilla está pensada para pocas y grandes. */
export const GALLERY_MAX = 6;

/**
 * URL de la foto `i` de un local de Google, servida por nuestro proxy.
 * La portada es la 0; la galería usa a partir de la 1 para no repetirla.
 */
export function placePhotoUrl(placeId: string, index: number): string {
  return `/api/foto?place=${encodeURIComponent(placeId)}&i=${index}`;
}

/** Saca el id del local de una URL de portada generada por nosotros, o null. */
export function placeIdFromHero(heroImage: string | undefined): string | null {
  if (!heroImage) return null;
  const m = heroImage.match(/^\/api\/foto\?place=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Fotos para la galería de la web pública. Si la demo viene de Google y el
 * local tiene más de una foto, se usan las suyas; si no, se devuelve vacío y la
 * galería enseña las de ejemplo. Nunca se mezclan: media galería de su local y
 * media de un sitio ajeno es peor que cualquiera de las dos por separado.
 */
export function galleryPhotosFor(
  profile: Pick<SalonProfile, "heroImage" | "photoCount">,
): string[] {
  const placeId = placeIdFromHero(profile.heroImage);
  const count = profile.photoCount ?? 0;
  if (!placeId || count < 2) return [];
  const n = Math.min(count - 1, GALLERY_MAX);
  return Array.from({ length: n }, (_, k) => placePhotoUrl(placeId, k + 1));
}
