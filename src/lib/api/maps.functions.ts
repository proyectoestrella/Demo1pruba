import { createServerFn } from "@tanstack/react-start";
import process from "node:process";
import { z } from "zod";
import { fromGoogleWeekdayDescriptions } from "../opening-hours";
import { GALLERY_MAX, hintFromPhotoName, photoSpec } from "../demo-photos";

/**
 * Rellena una demo a partir de un enlace de Google Maps.
 *
 * Va en el servidor por dos motivos: el navegador no puede seguir la
 * redirección de un enlace corto de Maps (CORS), y la clave de Places no puede
 * viajar al cliente.
 *
 * Funciona en dos niveles, a propósito:
 *
 *  - **Sin clave de Places**: se saca el nombre y las coordenadas del propio
 *    enlace, que los lleva dentro. No hace falta configurar nada y ya ahorra
 *    teclear el nombre.
 *  - **Con `GOOGLE_MAPS_API_KEY`**: además se piden a Places la dirección, el
 *    teléfono, la nota, el número de reseñas y una foto del local.
 *
 * Lo que NO se hace es leer el HTML de Google Maps y sacar datos de ahí. Se
 * puede, pero va contra sus condiciones de uso y se rompe en cuanto cambian su
 * web. Una demo que falla delante del cliente es peor que un campo a mano.
 */

export interface MapsLookup {
  name?: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  heroImage?: string;
  /** Lunes a domingo, en el formato de lib/opening-hours.ts. */
  openingHours?: string[];
  /** Cuántas fotos tiene el local en Google. */
  photoCount?: number;
  /** Fotos elegidas para la galería, en el formato de lib/demo-photos.ts. */
  galleryPhotos?: string[];
  /** Qué se ha podido averiguar y qué no, para decirlo en la interfaz. */
  source: "url" | "places";
  /** Motivo por el que no se han traído todos los campos, si aplica. */
  notice?: string;
}

/** Sigue la redirección de maps.app.goo.gl hasta la dirección larga. */
async function expandShortLink(url: string): Promise<string> {
  if (!/goo\.gl|maps\.app/.test(url)) return url;
  // Las URLs de búsqueda no redirigen a una ficha: no hay nada que expandir.
  try {
    const res = await fetch(url, { redirect: "follow" });
    return res.url || url;
  } catch {
    return url;
  }
}

/**
 * El nombre y las coordenadas viajan en la propia dirección:
 * `/maps/place/Barberia+Pepe/@40.41,-3.70,17z/...`
 */
export function parseMapsUrl(url: string): { name?: string; lat?: number; lng?: number } {
  const out: { name?: string; lat?: number; lng?: number } = {};

  // Enlaces "de búsqueda" y "cómo llegar": el texto de la consulta va en un
  // parámetro y suele ser "Nombre, Dirección", que es la consulta ideal para
  // Places. Son los que genera el rutero y los que da Google al compartir una
  // ficha desde algunas apps.
  try {
    const u = new URL(url);
    const q =
      u.searchParams.get("query") ?? u.searchParams.get("destination") ?? u.searchParams.get("q");
    if (q && q.trim()) {
      out.name = q.trim();
      const coords = q.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
      if (coords) {
        out.lat = Number(coords[1]);
        out.lng = Number(coords[2]);
        delete out.name;
      }
      return out;
    }
  } catch {
    // No es una URL: se trata como texto libre "Nombre, Dirección" más abajo.
  }

  const place = url.match(/\/maps\/place\/([^/@?]+)/);
  if (place?.[1]) {
    try {
      const decoded = decodeURIComponent(place[1].replace(/\+/g, " ")).trim();
      // Google mete a veces la dirección como "nombre" cuando no hay ficha.
      if (decoded && !/^[\d\s,.-]+$/.test(decoded)) out.name = decoded;
    } catch {
      /* dirección mal codificada: se ignora el nombre y se sigue */
    }
  }

  const coords = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coords) {
    out.lat = Number(coords[1]);
    out.lng = Number(coords[2]);
  }

  // "Barbería Pepe, Calle del Pez 23, Madrid" escrito a mano también vale.
  if (
    !out.name &&
    out.lat === undefined &&
    !/^https?:\/\//i.test(url) &&
    /[a-záéíóúñ]/i.test(url)
  ) {
    out.name = url.trim();
  }

  return out;
}

/**
 * Muchos negocios meten su posicionamiento en el nombre de la ficha:
 * "HTB HAIR SALON | Barbería Alcalá de Henares". En el titular de la demo eso
 * se lee fatal y ocupa dos líneas, así que se corta por el separador y se deja
 * el nombre de verdad. Editable después a mano, como todo lo demás.
 */
export function limpiarNombre(nombre: string): string {
  // "|", "·", rayas, o un guion corto con espacios a ambos lados ("Quka Perez - Peluquería").
  const corte = nombre.split(/\s*(?:[|·–—]|\s-\s)\s*/)[0].trim();
  return corte.length >= 3 ? corte : nombre.trim();
}

/**
 * Tipo de negocio deducido del nombre. Es lo primero que se lee bajo el nombre
 * en la demo y Google no lo da: sin esto, el lote lo pone igual para todas y
 * una "Peluquería de Señoras" sale rotulada como barbería. Se puede corregir
 * a mano; esto solo evita el error más frecuente.
 */
export function inferTipo(nombre: string): string {
  const n = nombre.toLowerCase();
  if (/barber|barbería|barberia|caballeros|shave/.test(n)) return "Barbería";
  if (/señoras|senoras/.test(n)) return "Peluquería de señoras";
  if (/est[ée]tica|nails|uñas|belleza|beauty|spa/.test(n)) return "Peluquería y estética";
  if (/peluquer|estilista|hair|salon|salón/.test(n)) return "Peluquería";
  return "";
}

/** Busca el sitio en Places y devuelve sus datos. Requiere clave. */
/** Foto de Google con lo que hace falta para juzgarla sin descargarla. */
type FotoPlaces = { name?: string; widthPx?: number; heightPx?: number };

/** Por debajo de esto la portada se ve blanda en una pantalla retina. */
const ANCHO_MINIMO_PORTADA = 1200;
/** En la galería cada foto ocupa un cuadrado pequeño y se perdona más. */
const LADO_MINIMO_GALERIA = 700;

/**
 * Elige la foto de portada entre las que tiene el local.
 *
 * La primera que devuelve Google no sirve como portada tan a menudo como
 * parece: al repasar los 54 locales del rutero, la primera era un cartel de
 * "NUEVO HORARIO", un primer plano de raíces con canas o una captura de Street
 * View con un teléfono sobreimpreso. No se puede juzgar el contenido sin verla,
 * pero sí el formato, y con eso se descartan los peores casos: se exige tamaño
 * suficiente para un hero y se penaliza lo que no encaja en una banda ancha —
 * las panorámicas de escaparate y los retratos verticales se recortan fatal.
 */
function elegirPortada(photos: FotoPlaces[]): { index: number; hint: string } | null {
  type Candidata = { index: number; hint: string; puntos: number };
  const candidatas: Candidata[] = [];

  photos.forEach((foto, index) => {
    if (!foto.name) return;
    const w = foto.widthPx ?? 0;
    const h = foto.heightPx ?? 0;
    if (!w || !h) return;

    const ratio = w / h;
    let puntos = 0;
    if (w >= ANCHO_MINIMO_PORTADA) puntos += 3;
    if (w >= 2400) puntos += 1;
    // Entre cuadrada y 16:9 es lo que mejor entra en el hero.
    if (ratio >= 0.9 && ratio <= 1.9) puntos += 3;
    else if (ratio > 1.9 && ratio <= 2.6) puntos += 1;
    // Google tiende a poner primero las más representativas: a igualdad de
    // formato, gana la que venía antes.
    puntos += Math.max(0, 5 - index) / 10;

    candidatas.push({ index, hint: hintFromPhotoName(foto.name), puntos });
  });

  const mejor = candidatas.sort((a, b) => b.puntos - a.puntos)[0];
  return mejor ? { index: mejor.index, hint: mejor.hint } : null;
}

/** Las demás fotos que dan la talla, saltándose la que se usa de portada. */
function elegirGaleria(photos: FotoPlaces[], portada: number | undefined): string[] {
  const out: string[] = [];
  photos.forEach((foto, index) => {
    if (index === portada || !foto.name || out.length >= GALLERY_MAX) return;
    const lado = Math.min(foto.widthPx ?? 0, foto.heightPx ?? 0);
    if (lado < LADO_MINIMO_GALERIA) return;
    out.push(photoSpec(index, foto.name));
  });
  return out;
}

async function fromPlaces(
  key: string,
  hint: { name?: string; lat?: number; lng?: number },
): Promise<MapsLookup | null> {
  if (!hint.name) return null;

  const body: Record<string, unknown> = {
    textQuery: hint.name,
    languageCode: "es",
    maxResultCount: 1,
  };
  if (hint.lat !== undefined && hint.lng !== undefined) {
    // Con coordenadas se acierta el local concreto y no otro del mismo nombre.
    body.locationBias = {
      circle: { center: { latitude: hint.lat, longitude: hint.lng }, radius: 200 },
    };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.regularOpeningHours.weekdayDescriptions,places.photos.name,places.photos.widthPx,places.photos.heightPx",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return {
      source: "url",
      name: hint.name,
      notice: `Google respondió ${res.status}. Comprueba que la clave tenga habilitada la Places API.`,
    };
  }

  const json = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      nationalPhoneNumber?: string;
      rating?: number;
      userRatingCount?: number;
      regularOpeningHours?: { weekdayDescriptions?: string[] };
      photos?: Array<{ name?: string; widthPx?: number; heightPx?: number }>;
    }>;
  };

  const place = json.places?.[0];
  if (!place) return { source: "url", name: hint.name, notice: "Google no encontró ese sitio." };

  const portada = elegirPortada(place.photos ?? []);
  const galeria = elegirGaleria(place.photos ?? [], portada?.index);

  return {
    source: "places",
    name: place.displayName?.text ? limpiarNombre(place.displayName.text) : hint.name,
    address: place.formattedAddress,
    phone: place.nationalPhoneNumber,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    // Se guarda el id del sitio (27 caracteres), no la referencia de la foto
    // (casi 500): la dirección va dentro del enlace que se manda por WhatsApp
    // y con la referencia entera el enlace se vuelve impresentable. El proxy
    // resuelve la foto a partir del id, y de paso la clave no sale del
    // servidor.
    heroImage:
      place.id && portada
        ? `/api/foto?place=${encodeURIComponent(place.id)}&i=${portada.index}&k=${portada.hint}`
        : undefined,
    openingHours: fromGoogleWeekdayDescriptions(place.regularOpeningHours?.weekdayDescriptions),
    photoCount: place.photos?.length ?? 0,
    galleryPhotos: galeria,
  };
}

export const lookupGoogleMaps = createServerFn({ method: "POST" })
  .inputValidator(z.object({ url: z.string().min(1) }))
  .handler(async ({ data }): Promise<MapsLookup> => {
    const expanded = await expandShortLink(data.url.trim());
    const hint = parseMapsUrl(expanded);

    if (!hint.name && hint.lat === undefined) {
      return {
        source: "url",
        notice:
          "No parece un enlace de un sitio concreto de Google Maps. Abre la ficha del salón y usa «Compartir».",
      };
    }

    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      return {
        source: "url",
        name: hint.name,
        notice:
          "Solo el nombre: falta configurar GOOGLE_MAPS_API_KEY para traer dirección, teléfono y foto.",
      };
    }

    try {
      return (await fromPlaces(key, hint)) ?? { source: "url", name: hint.name };
    } catch {
      return {
        source: "url",
        name: hint.name,
        notice: "No se pudo consultar Google. Se ha traído solo el nombre del enlace.",
      };
    }
  });
