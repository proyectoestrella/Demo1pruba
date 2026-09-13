import type { SalonProfile } from "./mock/types";
import { salon as seedSalon } from "./mock/salon";
import { DEFAULT_OPENING_HOURS } from "./opening-hours";

/**
 * Perfiles de demo transportados en la URL.
 *
 * El caso de uso es la puerta fría: preparas la demo con los datos reales de un
 * salón, se la enseñas en la tablet y le mandas el enlace por WhatsApp. Si la
 * personalización viviera solo en localStorage, al abrir ese enlace en SU móvil
 * vería el salón de ejemplo — justo lo contrario del efecto que se busca.
 *
 * Por eso el perfil viaja dentro del propio enlace (`?d=…`), no en un servidor:
 * no hace falta backend ni credenciales, el enlace es autocontenido y no se
 * guarda el negocio de nadie en una base de datos sin que lo haya pedido.
 *
 * Las claves van abreviadas a una letra porque la cadena termina en una URL que
 * alguien tiene que ver en un WhatsApp: con nombres completos ocupa el doble.
 */

/** Campos del perfil que se pueden personalizar por demo. */
export type DemoProfile = Pick<
  SalonProfile,
  | "name"
  | "tagline"
  | "about"
  | "address"
  | "phone"
  | "instagram"
  | "rating"
  | "reviewCount"
  | "specialties"
  | "heroImage"
  | "openingHours"
  | "photoCount"
  | "galleryPhotos"
>;

const KEYS: Record<keyof DemoProfile, string> = {
  name: "n",
  tagline: "t",
  about: "a",
  address: "d",
  phone: "p",
  instagram: "i",
  rating: "r",
  reviewCount: "c",
  specialties: "s",
  heroImage: "h",
  openingHours: "o",
  photoCount: "f",
  galleryPhotos: "g",
};

/** Nombre del search param que lleva el perfil en las rutas públicas. */
export const DEMO_PARAM = "d";

/**
 * Perfil de partida al crear una demo nueva.
 *
 * Los textos que describen al negocio (tipo, presentación, especialidades) van
 * VACÍOS a propósito: heredar los del salón de ejemplo significa enseñarle a
 * una peluquería de señoras que es una "barbería de toda la vida" con "tres
 * profesionales". Un hueco no dice nada; un texto equivocado delata la demo.
 */
export function blankDemoProfile(): DemoProfile {
  return {
    name: "",
    tagline: "",
    about: "",
    address: "",
    phone: "",
    instagram: "",
    rating: seedSalon.rating,
    reviewCount: seedSalon.reviewCount,
    specialties: [],
    heroImage: "",
    openingHours: [...DEFAULT_OPENING_HOURS],
    photoCount: 0,
    galleryPhotos: [],
  };
}

/* ---------- base64url, compatible con navegador y servidor ---------- */

function bufferBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 = typeof btoa === "function" ? btoa(binary) : bufferBase64(bytes);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, "base64").toString("utf-8");
}

/* ---------- codificar / descodificar ---------- */

/**
 * Empaqueta un perfil en una cadena apta para la URL. Solo se incluyen los
 * campos con contenido: un perfil donde únicamente cambia el nombre produce una
 * cadena corta, y el resto de la web sigue mostrando los valores de ejemplo.
 */
export function encodeDemoProfile(profile: Partial<DemoProfile>): string {
  const compact: Record<string, unknown> = {};

  for (const [field, short] of Object.entries(KEYS) as Array<[keyof DemoProfile, string]>) {
    const value = profile[field];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (field === "photoCount" && value === 0) continue;
    if (Array.isArray(value)) {
      const clean = value.map((v) => String(v).trim()).filter(Boolean);
      if (clean.length === 0) continue;
      compact[short] = clean;
      continue;
    }
    compact[short] = value;
  }

  return toBase64Url(JSON.stringify(compact));
}

/**
 * Lee un perfil desde la URL. Devuelve `null` si el parámetro está ausente o
 * corrupto: un enlace mal copiado (WhatsApp a veces parte los enlaces largos)
 * debe enseñar el salón de ejemplo, nunca una página rota.
 */
export function decodeDemoProfile(raw: string | undefined | null): Partial<DemoProfile> | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  const source = parsed as Record<string, unknown>;
  const out: Partial<DemoProfile> = {};

  for (const [field, short] of Object.entries(KEYS) as Array<[keyof DemoProfile, string]>) {
    const value = source[short];
    if (value === undefined) continue;

    if (field === "rating") {
      const n = Number(value);
      // Una nota fuera de escala delataría la demo — se descarta en silencio.
      if (Number.isFinite(n) && n >= 0 && n <= 5) out.rating = n;
    } else if (field === "reviewCount") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) out.reviewCount = Math.round(n);
    } else if (field === "openingHours") {
      if (Array.isArray(value) && value.length === 7) {
        out.openingHours = value.map((v) => String(v).trim().slice(0, 60));
      }
    } else if (field === "photoCount") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) out.photoCount = Math.min(Math.round(n), 10);
    } else if (field === "galleryPhotos") {
      if (Array.isArray(value)) {
        // Cada entrada es "<índice>~<pista>"; se descarta lo que no lo parezca
        // para que un enlace manipulado no llegue al proxy de fotos.
        const clean = value
          .map((v) => String(v).trim())
          .filter((v) => /^\d{1,2}(~[A-Za-z0-9_-]{1,40})?$/.test(v))
          .slice(0, 6);
        if (clean.length) out.galleryPhotos = clean;
      }
    } else if (field === "specialties") {
      if (Array.isArray(value)) {
        const clean = value
          .map((v) => String(v).trim())
          .filter(Boolean)
          .slice(0, 8);
        if (clean.length) out.specialties = clean;
      }
    } else if (typeof value === "string" && value.trim() !== "") {
      out[field] = value.trim() as never;
    }
  }

  return Object.keys(out).length ? out : null;
}

/** Construye el enlace público completo para una demo. */
export function demoUrl(profile: Partial<DemoProfile>, origin: string): string {
  const slug = slugify(profile.name ?? "") || "demo";
  return `${origin}/s/${slug}?${DEMO_PARAM}=${encodeDemoProfile(profile)}`;
}

/** Slug legible para que el enlace se reconozca de un vistazo en el chat. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* ---------- importar desde una ficha de Google Maps ---------- */

/**
 * Extrae lo que se pueda de un pegote de texto copiado de una ficha de Google
 * Maps. Es una ayuda para no teclear en la calle, no un analizador fiable:
 * devuelve solo los campos que reconoce y deja el resto para revisar a mano.
 */
export function parseGoogleMapsPaste(text: string): Partial<DemoProfile> {
  const out: Partial<DemoProfile> = {};
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return out;

  // Nota y número de reseñas: "4,8(312)", "4.8 (312)", "4,8 · 312 reseñas".
  const ratingMatch = text.match(/(\d[.,]\d)\s*(?:\(|·|\s)\s*([\d.,]+)\s*(?:\)|rese)/i);
  if (ratingMatch) {
    const rating = Number(ratingMatch[1].replace(",", "."));
    const count = Number(ratingMatch[2].replace(/[.,]/g, ""));
    if (Number.isFinite(rating) && rating <= 5) out.rating = rating;
    if (Number.isFinite(count)) out.reviewCount = count;
  } else {
    const loneRating = text.match(/(?:^|\s)([1-5][.,]\d)(?:\s|$)/);
    if (loneRating) out.rating = Number(loneRating[1].replace(",", "."));
  }

  // Teléfono español, con o sin prefijo y con separadores variados.
  const phoneMatch = text.match(
    /(?:\+34[\s.-]?)?(?:[6789]\d{2})[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/,
  );
  if (phoneMatch) out.phone = phoneMatch[0].replace(/[.-]/g, " ").replace(/\s+/g, " ").trim();

  const instaMatch = text.match(/@[A-Za-z0-9._]{2,30}/);
  if (instaMatch) out.instagram = instaMatch[0];

  // Dirección: la línea que empieza por un tipo de vía español.
  const street = lines.find((l) =>
    /^(c\/|calle|avda|avenida|av\.|plaza|pza|paseo|ronda|carrer|rúa|rua|camino|ctra|carretera|travesía|travesia)\b/i.test(
      l,
    ),
  );
  if (street) out.address = street;

  // El nombre suele ser la primera línea, salvo que esa línea ya sea otra cosa.
  const first = lines[0];
  const firstIsOtherField =
    first === street ||
    /^\d[.,]\d/.test(first) ||
    (out.phone !== undefined && first.includes(out.phone)) ||
    first.startsWith("@");
  if (!firstIsOtherField && first.length <= 80) out.name = first;

  return out;
}
