import { createServerFn } from "@tanstack/react-start";
import process from "node:process";
import { z } from "zod";

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
  /** Qué se ha podido averiguar y qué no, para decirlo en la interfaz. */
  source: "url" | "places";
  /** Motivo por el que no se han traído todos los campos, si aplica. */
  notice?: string;
}

/** Sigue la redirección de maps.app.goo.gl hasta la dirección larga. */
async function expandShortLink(url: string): Promise<string> {
  if (!/goo\.gl|maps\.app/.test(url)) return url;
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

  return out;
}

/** Busca el sitio en Places y devuelve sus datos. Requiere clave. */
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
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount",
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
    }>;
  };

  const place = json.places?.[0];
  if (!place) return { source: "url", name: hint.name, notice: "Google no encontró ese sitio." };

  return {
    source: "places",
    name: place.displayName?.text ?? hint.name,
    address: place.formattedAddress,
    phone: place.nationalPhoneNumber,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    // Se guarda el id del sitio (27 caracteres), no la referencia de la foto
    // (casi 500): la dirección va dentro del enlace que se manda por WhatsApp
    // y con la referencia entera el enlace se vuelve impresentable. El proxy
    // resuelve la foto a partir del id, y de paso la clave no sale del
    // servidor.
    heroImage: place.id ? `/api/foto?place=${encodeURIComponent(place.id)}` : undefined,
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
