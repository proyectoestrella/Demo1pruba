import { createServerFn } from "@tanstack/react-start";
import process from "node:process";
import { z } from "zod";
import { fromGoogleWeekdayDescriptions } from "../opening-hours";
import { GALLERY_MAX } from "../demo-photos";
import { BUSINESS_LABEL, inferBusinessType } from "../business-type";

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

/**
 * Sigue la redirección de un enlace corto hasta la dirección larga.
 *
 * `share.google` es el acortador que usa hoy la app del móvil al compartir, y
 * no lleva nada dentro: sin expandirlo el importador no veía ni el nombre.
 * Acaba en una búsqueda de Google con el nombre del negocio en `q=`, que es
 * justo la consulta que necesita Places.
 */
/** Acortadores de Google que se siguen en el servidor. Cualquier otro host se ignora (SSRF). */
const HOSTS_ACORTADOR = new Set(["goo.gl", "maps.app.goo.gl", "share.google", "g.co"]);

export function esAcortadorGoogle(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password && HOSTS_ACORTADOR.has(u.hostname);
  } catch {
    return false;
  }
}

export async function expandShortLink(url: string, pedir: typeof fetch = fetch): Promise<string> {
  // Antes bastaba con que el texto CONTUVIERA «goo.gl» en cualquier parte (p. ej.
  // `http://169.254.169.254/?x=goo.gl`) para que el servidor hiciera la petición:
  // una vía de SSRF abierta a cualquiera, porque esta función no pide sesión.
  if (!esAcortadorGoogle(url)) return url;
  try {
    const res = await pedir(url, { redirect: "follow", signal: AbortSignal.timeout(5000) });
    return res.url || url;
  } catch {
    return url;
  }
}

/**
 * El nombre y las coordenadas viajan en la propia dirección:
 * `/maps/place/Barberia+Pepe/@40.41,-3.70,17z/...`
 */
export interface PistaMaps {
  name?: string;
  lat?: number;
  lng?: number;
  /**
   * El enlace traía una dirección postal, no el nombre del negocio. Cambia la
   * búsqueda: en un portal puede haber dos peluquerías y hay que decir cuál se
   * ha traído en vez de dar por buena la primera que conteste Google.
   */
  esDireccion?: boolean;
}

export function parseMapsUrl(url: string): PistaMaps {
  const out: PistaMaps = {};

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

  // "Cómo llegar" sin parámetros: `/maps/dir//C. Isla de Tavira, 26, 28035
  // Madrid/data=!4m6…`. Es lo que da Google al compartir una ruta desde el
  // escritorio, y es el enlace que más se pega en la calle porque sale al
  // tocar «Cómo llegar». El destino va en el propio camino, no en un
  // parámetro: el primer hueco es el origen (vacío = «mi posición») y lo que
  // viene después es la ficha. Con la dirección sola basta: Places devuelve
  // el negocio que está en ese portal.
  if (!out.name) {
    const dir = url.match(/\/maps\/dir\/([^?#]*)/);
    if (dir?.[1]) {
      const destino = dir[1]
        .split("/")
        .map((s) => s.trim())
        .filter((s) => s && !/^(?:data=|@|am=|!)/.test(s))
        .pop();
      if (destino) {
        try {
          const decoded = decodeURIComponent(destino.replace(/\+/g, " ")).trim();
          // Un destino que son solo coordenadas no es un nombre: se usa como tal.
          const soloCoords = decoded.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
          if (soloCoords) {
            out.lat = Number(soloCoords[1]);
            out.lng = Number(soloCoords[2]);
          } else if (decoded && !/^[\d\s,.-]+$/.test(decoded)) {
            out.name = decoded;
            out.esDireccion = true;
          }
        } catch {
          /* destino mal codificado: se ignora y se sigue con las coordenadas */
        }
      }
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
 *
 * La deducción en sí vive en `lib/business-type.ts` — única fuente para toda
 * la app — y nunca cae en "Barbería" por defecto: sin pistas se asume
 * "Peluquería", que es el oficio más frecuente del rutero.
 */
export function inferTipo(nombre: string): string {
  return BUSINESS_LABEL[inferBusinessType(nombre)];
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
function elegirPortada(photos: FotoPlaces[]): number | null {
  type Candidata = { index: number; puntos: number };
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

    candidatas.push({ index, puntos });
  });

  const mejor = candidatas.sort((a, b) => b.puntos - a.puntos)[0];
  return mejor ? mejor.index : null;
}

/** Las demás fotos que dan la talla, saltándose la que se usa de portada. */
function elegirGaleria(photos: FotoPlaces[], portada: number | undefined): string[] {
  const out: string[] = [];
  photos.forEach((foto, index) => {
    if (index === portada || !foto.name || out.length >= GALLERY_MAX) return;
    const lado = Math.min(foto.widthPx ?? 0, foto.heightPx ?? 0);
    if (lado < LADO_MINIMO_GALERIA) return;
    out.push(String(index));
  });
  return out;
}

interface PlaceResultado {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: Array<{ name?: string; widthPx?: number; heightPx?: number }>;
}

const CAMPOS_PLACES =
  "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.regularOpeningHours.weekdayDescriptions,places.photos.name,places.photos.widthPx,places.photos.heightPx";

/** Una búsqueda de texto en Places. Devuelve `null` si Google no responde bien. */
async function buscarEnPlaces(
  key: string,
  textQuery: string,
  bias: { lat?: number; lng?: number },
  maxResultCount: number,
): Promise<PlaceResultado[] | { error: number }> {
  const body: Record<string, unknown> = { textQuery, languageCode: "es", maxResultCount };
  if (bias.lat !== undefined && bias.lng !== undefined) {
    // Con coordenadas se acierta el local concreto y no otro del mismo nombre.
    body.locationBias = {
      circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 200 },
    };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": CAMPOS_PLACES,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return { error: res.status };
  return ((await res.json()) as { places?: PlaceResultado[] }).places ?? [];
}

/**
 * Un resultado que no tiene ni reseñas ni fotos no es un negocio: es el portal.
 * Google lo devuelve cuando se le pregunta por una dirección a secas, que es
 * justo lo que trae un enlace de «Cómo llegar».
 */
function esSoloUnPortal(place: PlaceResultado): boolean {
  return !place.userRatingCount && !(place.photos?.length ?? 0);
}

/** "C. Isla de Tavira, 32, Fuencarral…" → "c. isla de tavira|32". */
function portalDe(direccion: string | undefined): string | null {
  if (!direccion) return null;
  const partes = direccion
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(",")
    .map((p) => p.trim());
  const numero = partes.slice(1).find((p) => /^\d+$/.test(p));
  return partes[0] && numero ? `${partes[0]}|${numero}` : null;
}

export async function fromPlaces(key: string, hint: PistaMaps): Promise<MapsLookup | null> {
  if (!hint.name) return null;

  // Un enlace de «Cómo llegar» trae el portal, no el negocio. Preguntar por la
  // dirección a secas no sirve: Google unas veces contesta el edificio y otras
  // una de las peluquerías del portal, a capricho — y en la calle no se puede
  // enseñar la demo del vecino. Se pregunta por el oficio en esa dirección, se
  // exige que el portal coincida, y si hay más de una se dice cuál se ha traído.
  const consulta = hint.esDireccion ? `peluquería o barbería en ${hint.name}` : hint.name;
  const primera = await buscarEnPlaces(key, consulta, hint, hint.esDireccion ? 10 : 1);
  if ("error" in primera) {
    return {
      source: "url",
      name: hint.name,
      notice: `Google respondió ${primera.error}. Comprueba que la clave tenga habilitada la Places API.`,
    };
  }

  let place = hint.esDireccion ? undefined : primera[0];
  let notice: string | undefined;

  if (!place) {
    const portalBuscado = portalDe(hint.name);
    const enEsePortal = primera.filter(
      (p) => portalBuscado && portalDe(p.formattedAddress) === portalBuscado,
    );
    if (enEsePortal.length > 0) {
      // Gana el que tiene fotos —sin ellas la demo sale con la foto de ejemplo
      // y no impresiona a nadie— y, a igualdad, el de más reseñas.
      const ordenados = [...enEsePortal].sort(
        (a, b) =>
          (b.photos?.length ?? 0) - (a.photos?.length ?? 0) ||
          (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0),
      );
      place = ordenados[0];
      // El enlace no traía el nombre: quien lo pega tiene que poder comprobar
      // de un vistazo que el salón es el que tiene delante. Google no siempre
      // lista los mismos vecinos, así que el aviso se da siempre, haya salido
      // uno o varios.
      const otros = ordenados
        .slice(1)
        .map((p) => p.displayName?.text)
        .filter(Boolean)
        .join(", ");
      notice = otros
        ? `Ese enlace solo traía la dirección. He traído «${place.displayName?.text}»; en ese portal también está ${otros}.`
        : `Ese enlace solo traía la dirección: comprueba que «${place.displayName?.text}» es el salón que tienes delante.`;
    } else if (!hint.esDireccion) {
      place = primera[0];
    }
  }

  if (!place) return { source: "url", name: hint.name, notice: "Google no encontró ese sitio." };
  if (esSoloUnPortal(place)) {
    return {
      source: "url",
      name: hint.name,
      notice:
        "Ese enlace lleva la dirección pero no el negocio, y Google no encuentra ninguno en ese portal. Abre su ficha en Maps y usa «Compartir».",
    };
  }

  const portada = elegirPortada(place.photos ?? []);
  const galeria = elegirGaleria(place.photos ?? [], portada ?? undefined);

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
      place.id && portada !== null
        ? `/api/foto?place=${encodeURIComponent(place.id)}&i=${portada}`
        : undefined,
    openingHours: fromGoogleWeekdayDescriptions(place.regularOpeningHours?.weekdayDescriptions),
    photoCount: place.photos?.length ?? 0,
    galleryPhotos: galeria,
    notice,
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
