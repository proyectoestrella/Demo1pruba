import type { SalonProfile } from "./mock/types";
import { conAncho, galleryPhotosFor } from "./demo-photos";

/**
 * Fotos de la galería de la web del salón (lote 18.3).
 *
 * Manda `galeriaPropia` (fotos elegidas por el salón, con su texto
 * alternativo); si no hay, la selección de siempre de la ficha de Google.
 */
export interface FotoGaleria {
  /** Fuente pequeña (≈600 px de ancho): la que se pinta en el carrusel. */
  src: string;
  /** `srcSet` con 600 y 1200 px cuando se sabe servir los dos anchos. */
  srcSet?: string;
  /** Fuente grande para la foto ampliada. */
  grande: string;
  alt: string;
}

/** Ficheros propios preparados a dos anchos: `nombre-600.webp` y `nombre-1200.webp`. */
const DOS_ANCHOS = /-(600|1200)\.(webp|avif|jpe?g|png)$/i;

/**
 * Una foto con sus anchos. Tres casos:
 * - del proxy de Google (`/api/foto?…`): el proxy entiende `&w=`;
 * - fichero propio `…-600.webp` / `…-1200.webp`: se deduce el otro ancho;
 * - cualquier otra URL: tal cual, sin `srcSet`.
 */
export function fotoConAnchos(url: string, alt: string): FotoGaleria {
  if (url.startsWith("/api/foto?")) {
    const peq = conAncho(url, 600) ?? url;
    const gran = conAncho(url, 1200) ?? url;
    return { src: peq, srcSet: `${peq} 600w, ${gran} 1200w`, grande: gran, alt };
  }
  if (DOS_ANCHOS.test(url)) {
    const peq = url.replace(DOS_ANCHOS, "-600.$2");
    const gran = url.replace(DOS_ANCHOS, "-1200.$2");
    return { src: peq, srcSet: `${peq} 600w, ${gran} 1200w`, grande: gran, alt };
  }
  return { src: url, grande: url, alt };
}

/** Las fotos de la galería del perfil, en orden. Vacío si no hay ninguna. */
export function fotosDeGaleria(
  profile: Pick<SalonProfile, "heroImage" | "photoCount" | "galleryPhotos" | "galeriaPropia" | "tagline">,
): FotoGaleria[] {
  const propias = (profile.galeriaPropia ?? []).filter((f) => f?.url?.trim());
  if (propias.length > 0) {
    return propias.map((f) => fotoConAnchos(f.url.trim(), f.alt?.trim() || "Trabajo del salón"));
  }
  const negocio = profile.tagline?.trim() ? `la ${profile.tagline.trim().toLowerCase()}` : "el local";
  return galleryPhotosFor(profile).map((url, i) => fotoConAnchos(url, `Foto ${i + 1} de ${negocio}`));
}

/**
 * Cuántas veces hay que repetir la serie para que el carrusel infinito nunca
 * enseñe un hueco. Lo que se ve vive en la segunda copia: a su izquierda
 * queda una serie entera (para arrastrar hacia atrás) y a su derecha, las
 * que hagan falta para cubrir la pantalla más una de margen. Mínimo tres.
 */
export function copiasDelCarrusel(anchoSerie: number, anchoVisible: number): number {
  if (!(anchoSerie > 0)) return 3;
  return Math.max(3, Math.ceil(anchoVisible / anchoSerie) + 2);
}

/** Posición del carrusel devuelta a la primera serie: [0, anchoSerie). */
export function envolver(pos: number, anchoSerie: number): number {
  if (!(anchoSerie > 0)) return pos;
  const r = pos % anchoSerie;
  return r < 0 ? r + anchoSerie : r;
}

/** Portada propia preparada a dos anchos: `nombre-800.webp` y `nombre-1600.webp` (lote P.5). */
const PORTADA_DOS_ANCHOS = /-(800|1600)\.(webp|avif|jpe?g|png)$/i;

/**
 * La portada con sus dos anchos si es un fichero propio `…-800` / `…-1600`
 * (se deduce el otro ancho), o `null` si no lo es: la foto del proxy de
 * Google ya pide su ancho con `&w=` y cualquier otra URL va tal cual.
 */
export function portadaConAnchos(url: string | undefined): { src: string; srcSet: string } | null {
  const u = url?.trim();
  if (!u || u.startsWith("/api/foto?") || !PORTADA_DOS_ANCHOS.test(u)) return null;
  const peq = u.replace(PORTADA_DOS_ANCHOS, "-800.$2");
  const gran = u.replace(PORTADA_DOS_ANCHOS, "-1600.$2");
  return { src: peq, srcSet: `${peq} 800w, ${gran} 1600w` };
}
