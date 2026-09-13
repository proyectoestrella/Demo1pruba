import type { SalonProfile } from "./mock/types";

/** Máximo de fotos que enseña la galería: la rejilla está pensada para pocas y grandes. */
export const GALLERY_MAX = 6;

/**
 * Una foto elegida de la ficha de Google, escrita como `"<índice>~<pista>"`.
 *
 * El índice dice en qué posición estaba cuando se preparó la demo y la pista
 * son los primeros caracteres de su identificador, para reconocerla aunque
 * Google reordene las fotos del local. La pista es opcional: `"3"` también vale.
 */
export type PhotoSpec = string;

/** Longitud de la pista. Suficiente para distinguir, corta para el enlace. */
export const HINT_LENGTH = 14;

/** Saca la pista del nombre completo del recurso, `places/X/photos/<id>`. */
export function hintFromPhotoName(name: string): string {
  const id = name.split("/photos/")[1] ?? "";
  return id.slice(0, HINT_LENGTH);
}

/** Escribe la especificación que viaja en la demo. */
export function photoSpec(index: number, photoName?: string): PhotoSpec {
  const hint = photoName ? hintFromPhotoName(photoName) : "";
  return hint ? `${index}~${hint}` : String(index);
}

/**
 * URL de una foto elegida, servida por nuestro proxy.
 *
 * Se acepta tanto un número suelto (fotos de demos antiguas, sin pista) como la
 * forma con pista: los enlaces ya repartidos tienen que seguir funcionando.
 */
export function placePhotoUrl(placeId: string, spec: PhotoSpec | number): string {
  const [rawIndex, hint] = String(spec).split("~");
  const index = Math.max(0, Number(rawIndex) || 0);
  const base = `/api/foto?place=${encodeURIComponent(placeId)}&i=${index}`;
  return hint ? `${base}&k=${encodeURIComponent(hint)}` : base;
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
