import type { SalonProfile } from "./mock/types";

/** Máximo de fotos que enseña la galería: la rejilla está pensada para pocas y grandes. */
export const GALLERY_MAX = 6;

/**
 * Una foto elegida de la ficha de Google, identificada por su posición.
 *
 * Se guarda la posición y no el identificador de la foto porque **los nombres
 * de foto que da Places son tokens de un solo uso**: comprobado el 14/09 sobre
 * seis locales, ninguno de los identificadores obtenidos el día anterior seguía
 * existiendo, ni en la misma posición ni en otra. El orden, en cambio, sí se
 * mantuvo: las diez fotos de cada local aparecieron en la misma posición y con
 * las mismas dimensiones. Por eso la posición es lo único a lo que agarrarse, y
 * por eso no hay que volver a intentar guardar el identificador.
 *
 * Se acepta también la forma `"3~loquesea"` porque hubo enlaces generados con
 * un sufijo que ya no se usa; se ignora lo que va detrás de la virgulilla.
 */
export type PhotoSpec = string | number;

/** URL de una foto elegida, servida por nuestro proxy. */
export function placePhotoUrl(placeId: string, spec: PhotoSpec): string {
  const index = Math.max(0, Number(String(spec).split("~")[0]) || 0);
  return `/api/foto?place=${encodeURIComponent(placeId)}&i=${index}`;
}

/** Saca el id del local de una URL de portada generada por nosotros, o null. */
export function placeIdFromHero(heroImage: string | undefined): string | null {
  if (!heroImage) return null;
  const m = heroImage.match(/^\/api\/foto\?place=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Fotos para la galería de la web pública.
 *
 * Si la demo trae una selección hecha a mano (`galleryPhotos`), manda esa: al
 * repasar los locales del rutero se vio que las fotos de Google vienen en un
 * orden que no sirve — carteles de horario, primeros planos de raíces con
 * canas, capturas de Street View con un teléfono sobreimpreso — y enseñarle eso
 * a un peluquero en la puerta juega en contra. Sin selección se cae al orden de
 * Google saltando la portada, que es lo que hacían las demos anteriores.
 */
export function galleryPhotosFor(
  profile: Pick<SalonProfile, "heroImage" | "photoCount" | "galleryPhotos">,
): string[] {
  const placeId = placeIdFromHero(profile.heroImage);
  if (!placeId) return [];

  const elegidas = profile.galleryPhotos ?? [];
  if (elegidas.length > 0) {
    return elegidas.slice(0, GALLERY_MAX).map((spec) => placePhotoUrl(placeId, spec));
  }

  const count = profile.photoCount ?? 0;
  if (count < 2) return [];
  const n = Math.min(count - 1, GALLERY_MAX);
  return Array.from({ length: n }, (_, k) => placePhotoUrl(placeId, k + 1));
}
