import type { SalonProfile } from "./mock/types";
import { salon as seedSalon } from "./mock/salon";
import { DEFAULT_OPENING_HOURS } from "./opening-hours";
import {
  MAX_MENU_ENTRIES,
  MAX_MENU_ENTRIES_SALON,
  MAX_TEAM_ENTRIES,
  formatMenuEntry,
  formatTeamEntry,
  parseMenuEntry,
  parseTeamEntry,
} from "./business-type";
import { MAX_PRIORITY_RANGES, formatPriorityRange, parsePriorityRange } from "./reparto";
import { MAX_FAQ_ENTRIES, formatFaqEntry, parseFaqEntry } from "./faq";

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

/** Claves de módulos del panel que una demo puede ocultar. */
export type ModuloOcultable = "equipo" | "marketing" | "lista-espera";

const MODULOS_OCULTABLES: ModuloOcultable[] = ["equipo", "marketing", "lista-espera"];

/**
 * Campos de personalización de la demo que no forman parte del negocio real
 * (no viven en `SalonProfile`): controlan qué enseña el panel y cómo se
 * comporta la reserva pública para ESTA demo en concreto. Todos opcionales,
 * y su ausencia reproduce el comportamiento de siempre.
 */
export interface DemoPersonalizacion {
  /** Módulos del panel que esta demo oculta. Ausente/[] = se ven todos, como hasta ahora. */
  modulosOcultos?: ModuloOcultable[];
  /** Mostrar el bloque «solicitudes pendientes de confirmar» en Inicio y Citas. Por defecto true. */
  mostrarSolicitudes?: boolean;
  /** Aviso de recargo por retraso en la reserva pública. Ausente = no se muestra. */
  recargoRetraso?: { pct: number; minutos: number };
  /** La duración final la decide el salón: reserva pública muestra un rango orientativo. Por defecto false. */
  duracionFlexible?: boolean;
}

/** Campos de negocio del perfil que se pueden personalizar por demo (viven en `SalonProfile`). */
type DemoProfileNegocio = Pick<
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
  | "team"
  | "menu"
  | "faq"
  | "noShowFeeEur"
  | "noShowNoticeHours"
  | "smartSpread"
  | "lastSlotBufferMin"
  | "priorityHours"
  | "depositEnabled"
  | "depositBizumPhone"
  | "depositAmountEur"
  | "depositDeadlineHours"
  | "bookingQuestionsEnabled"
  | "bookingQuestionsRequired"
  // Lote P: lo que edita Mi página y enseña la vista previa.
  | "logoUrl"
  | "whatsapp"
  | "enlaces"
  | "boletin"
  | "galeriaPropia"
  | "descripcionesServicios"
  | "preciosLiterales"
  // Lote P.5: lo que sale en «Lo más pedido».
  | "destacados"
>;

/** Campos del perfil que se pueden personalizar por demo. */
export type DemoProfile = DemoProfileNegocio & DemoPersonalizacion;

/**
 * Campos del perfil que un enlace `?d=` no trae y que, por tanto, NO puede
 * heredar del salón que hubiera antes en este navegador: el logo y todo lo
 * del lote 18 (enlaces, WhatsApp, boletín, galería propia, textos de la
 * carta) y los destacados del lote P.5. Sin blanquearlos, abrir la demo de otra peluquería después de la
 * de PeluChic enseñaba el Instagram, el boletín y el logo de PeluChic.
 */
export type CamposSinHeredar = Pick<
  SalonProfile,
  "logoUrl" | "enlaces" | "whatsapp" | "boletin" | "galeriaPropia" | "descripcionesServicios" | "preciosLiterales" | "destacados" | "demoAbreHoy"
>;

/**
 * Claves abreviadas de los campos de personalización (§ arriba). Se
 * codifican/descodifican aparte de `KEYS` porque no viven en `SalonProfile` y
 * cada una necesita su propia validación.
 */
const PERSONALIZACION_KEYS: Record<keyof DemoPersonalizacion, string> = {
  modulosOcultos: "mo",
  mostrarSolicitudes: "ms",
  recargoRetraso: "rr",
  duracionFlexible: "df",
};

const KEYS: Record<keyof DemoProfileNegocio, string> = {
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
  team: "e",
  menu: "m",
  faq: "j",
  noShowFeeEur: "q",
  noShowNoticeHours: "w",
  smartSpread: "k",
  lastSlotBufferMin: "u",
  priorityHours: "y",
  // Señal por Bizum (caso PeluChic): activa, número y cuánto.
  depositEnabled: "fe",
  depositBizumPhone: "fb",
  depositAmountEur: "fa",
  depositDeadlineHours: "fh",
  bookingQuestionsEnabled: "bq",
  bookingQuestionsRequired: "br",
  // Lote P (ver `codificarLote18`/`leerLote18`).
  logoUrl: "lg",
  whatsapp: "wa",
  enlaces: "en",
  boletin: "bo",
  galeriaPropia: "gp",
  descripcionesServicios: "ds",
  preciosLiterales: "pl",
  destacados: "dt",
};

/* ---------- lote P: enlaces, boletín, galería y textos de la carta ---------- */

const CAMPOS_LOTE18 = new Set<keyof DemoProfileNegocio>([
  "logoUrl", "whatsapp", "enlaces", "boletin", "galeriaPropia", "descripcionesServicios", "preciosLiterales", "destacados",
]);
const CLAVES_ENLACES = { blog: "b", instagram: "i", facebook: "f", tienda: "t", web: "w", resenas: "r" } as const;
const ID_SERVICIO = /^[a-z0-9][a-z0-9-]{0,59}$/;
const MAX_GALERIA = 12;
/** «Lo más pedido» enseña cuatro como mucho. */
export const MAX_DESTACADOS = 4;

/** Ids de servicio válidos y sin repetir, como mucho `MAX_DESTACADOS`, o `null` si no queda ninguno. */
function idsDestacados(valor: unknown): string[] | null {
  if (!Array.isArray(valor)) return null;
  const ids = [...new Set(valor.map((v) => (typeof v === "string" ? v.trim() : "")).filter((v) => ID_SERVICIO.test(v)))].slice(0, MAX_DESTACADOS);
  return ids.length ? ids : null;
}

/**
 * Una dirección que se puede pintar o enlazar: http(s) y, si `relativa`, una
 * ruta de la propia web («/demo/…»). Nada de `javascript:` ni `data:`: el
 * enlace lo puede fabricar cualquiera y acaba en un `href`.
 */
export function urlSegura(valor: unknown, relativa = false): string | null {
  if (typeof valor !== "string") return null;
  const v = valor.trim();
  if (!v || v.length > 500 || /\s/.test(v)) return null;
  if (/^https?:\/\/[^/]/i.test(v)) return v;
  if (relativa && /^\/(?!\/)/.test(v)) return v;
  return null;
}

function textoCorto(valor: unknown, max: number): string | null {
  if (typeof valor !== "string") return null;
  const v = valor.trim();
  return v ? v.slice(0, max) : null;
}

/** Diccionario «id de servicio → texto» limpio, o `null` si no queda nada. */
function textosPorServicio(valor: unknown, max: number): Record<string, string> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const out: Record<string, string> = {};
  for (const [id, texto] of Object.entries(valor as Record<string, unknown>).slice(0, MAX_MENU_ENTRIES_SALON)) {
    const t = textoCorto(texto, max);
    if (ID_SERVICIO.test(id) && t) out[id] = t;
  }
  return Object.keys(out).length ? out : null;
}

/** Forma compacta de un campo del lote 18 para el enlace, o `undefined` si no hay nada que llevar. */
function codificarLote18(field: keyof DemoProfileNegocio, value: unknown): unknown {
  switch (field) {
    case "logoUrl":
      return urlSegura(value, true) ?? undefined;
    case "whatsapp":
      return textoCorto(value, 30) ?? undefined;
    case "enlaces": {
      if (!value || typeof value !== "object") return undefined;
      const out: Record<string, string> = {};
      for (const [campo, corta] of Object.entries(CLAVES_ENLACES)) {
        const url = urlSegura((value as Record<string, unknown>)[campo]);
        if (url) out[corta] = url;
      }
      return Object.keys(out).length ? out : undefined;
    }
    case "boletin": {
      const b = value as SalonProfile["boletin"];
      const texto = textoCorto(b?.texto, 200);
      const url = urlSegura(b?.url, true);
      if (!texto || !url) return undefined;
      const condiciones = textoCorto(b?.condiciones, 300);
      return condiciones ? { t: texto, u: url, c: condiciones } : { t: texto, u: url };
    }
    case "galeriaPropia": {
      if (!Array.isArray(value)) return undefined;
      const fotos = value
        .map((f) => [urlSegura((f as { url?: unknown })?.url, true), textoCorto((f as { alt?: unknown })?.alt, 200) ?? ""] as const)
        .filter(([url]) => url !== null)
        .slice(0, MAX_GALERIA);
      return fotos.length ? fotos : undefined;
    }
    case "descripcionesServicios":
      return textosPorServicio(value, 400) ?? undefined;
    case "preciosLiterales":
      return textosPorServicio(value, 80) ?? undefined;
    case "destacados":
      return idsDestacados(value) ?? undefined;
    default:
      return undefined;
  }
}

/** Lo contrario de `codificarLote18`, con la misma validación: lo raro se descarta. */
function leerLote18(field: keyof DemoProfileNegocio, value: unknown): unknown {
  switch (field) {
    case "logoUrl":
      return urlSegura(value, true) ?? undefined;
    case "whatsapp":
      return textoCorto(value, 30) ?? undefined;
    case "enlaces": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
      const out: NonNullable<SalonProfile["enlaces"]> = {};
      for (const [campo, corta] of Object.entries(CLAVES_ENLACES) as Array<[keyof typeof CLAVES_ENLACES, string]>) {
        const url = urlSegura((value as Record<string, unknown>)[corta]);
        if (url) out[campo] = url;
      }
      return Object.keys(out).length ? out : undefined;
    }
    case "boletin": {
      if (!value || typeof value !== "object") return undefined;
      const v = value as Record<string, unknown>;
      const texto = textoCorto(v.t, 200);
      const url = urlSegura(v.u, true);
      if (!texto || !url) return undefined;
      const condiciones = textoCorto(v.c, 300);
      return condiciones ? { texto, url, condiciones } : { texto, url };
    }
    case "galeriaPropia": {
      if (!Array.isArray(value)) return undefined;
      const fotos = value
        .filter((f): f is unknown[] => Array.isArray(f))
        .map((f) => ({ url: urlSegura(f[0], true), alt: textoCorto(f[1], 200) ?? "" }))
        .filter((f): f is { url: string; alt: string } => f.url !== null)
        .slice(0, MAX_GALERIA);
      return fotos.length ? fotos : undefined;
    }
    case "descripcionesServicios":
      return textosPorServicio(value, 400) ?? undefined;
    case "preciosLiterales":
      return textosPorServicio(value, 80) ?? undefined;
    case "destacados":
      return idsDestacados(value) ?? undefined;
    default:
      return undefined;
  }
}

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
export function blankDemoProfile(): DemoProfile & CamposSinHeredar {
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
    team: [],
    menu: [],
    faq: [],
    // Ausentes/0 = desactivadas — igual que team/menu arriba, hay que
    // ponerlas EXPLÍCITAS a "apagado" y no simplemente omitirlas: si no, al
    // abrir un enlace sin "q"/"k" tras haber tenido activa la demo anterior
    // (mismo navegador), `useDisplayProfile` conservaría la política o el
    // reparto de la demo previa en vez de apagarlos.
    noShowFeeEur: 0,
    noShowNoticeHours: 2,
    smartSpread: false,
    lastSlotBufferMin: 0,
    priorityHours: [],
    // Explícitas por la misma razón que noShowFeeEur: sin "fe" en el enlace, apagada.
    depositEnabled: false,
    depositBizumPhone: "",
    depositAmountEur: 0,
    depositDeadlineHours: 4,
    // undefined conserva el valor por defecto derivado del tipo de negocio.
    bookingQuestionsEnabled: undefined,
    bookingQuestionsRequired: false,
    // Misma razón que arriba: explícitas, para que un enlace sin "mo"/"ms"/
    // "rr"/"df" no herede la personalización de la demo anterior en este
    // mismo navegador.
    modulosOcultos: [],
    mostrarSolicitudes: true,
    recargoRetraso: undefined,
    duracionFlexible: false,
    // Ver `CamposSinHeredar`: presentes y vacíos para que pisen lo anterior.
    logoUrl: undefined,
    enlaces: undefined,
    whatsapp: undefined,
    boletin: undefined,
    galeriaPropia: undefined,
    descripcionesServicios: undefined,
    preciosLiterales: undefined,
    destacados: undefined,
    demoAbreHoy: undefined,
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
export function encodeDemoProfile(
  profile: Partial<DemoProfile>,
  opciones: {
    /**
     * Carta entera (hasta 60) en vez de 12. Solo para la vista previa de Mi
     * página, que no viaja por WhatsApp: un enlace para compartir se queda
     * en 12 para que siga siendo pegable.
     */
    cartaCompleta?: boolean;
  } = {},
): string {
  const compact: Record<string, unknown> = {};

  for (const [field, short] of Object.entries(KEYS) as Array<[keyof DemoProfile, string]>) {
    const value = profile[field];
    if (value === undefined || value === null) continue;
    if (CAMPOS_LOTE18.has(field as keyof DemoProfileNegocio)) {
      const compacto = codificarLote18(field as keyof DemoProfileNegocio, value);
      if (compacto !== undefined) compact[short] = compacto;
      continue;
    }
    if (typeof value === "string" && value.trim() === "") continue;
    if (field === "photoCount" && value === 0) continue;
    if (field === "noShowFeeEur") {
      const n = Number(value);
      // 0 o inválido = política desactivada: no ocupa sitio en el enlace.
      if (!Number.isFinite(n) || n <= 0) continue;
      compact[short] = Math.min(50, Math.round(n * 100) / 100);
      continue;
    }
    if (field === "noShowNoticeHours") {
      const n = Number(value);
      const fee = Number(profile.noShowFeeEur ?? 0);
      // Las horas de aviso no significan nada sin penalización activa.
      if (!Number.isFinite(n) || n <= 0 || !(fee > 0)) continue;
      compact[short] = Math.min(48, Math.max(1, Math.round(n)));
      continue;
    }
    if (field === "depositEnabled") {
      if (value !== true) continue;
      compact[short] = 1;
      continue;
    }
    if (field === "bookingQuestionsEnabled" || field === "bookingQuestionsRequired") {
      compact[short] = value === true ? 1 : 0;
      continue;
    }
    if (field === "depositDeadlineHours") {
      if (![1, 2, 4, 12, 24].includes(Number(value))) continue;
      compact[short] = Number(value);
      continue;
    }
    if (field === "depositAmountEur") {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0 || profile.depositEnabled !== true) continue;
      compact[short] = Math.min(200, Math.round(n * 100) / 100);
      continue;
    }
    if (field === "depositBizumPhone") {
      if (profile.depositEnabled !== true) continue;
    }
    if (field === "smartSpread") {
      if (value !== true) continue;
      compact[short] = 1;
      continue;
    }
    if (field === "lastSlotBufferMin") {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) continue;
      compact[short] = Math.min(240, Math.round(n));
      continue;
    }
    if (field === "team" && Array.isArray(value)) {
      // Se valida igual que al descodificar: un equipo con una entrada
      // corrupta ("~~~") no debe colarse en el enlace tal cual.
      const clean = value
        .map((v) => parseTeamEntry(String(v)))
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .slice(0, MAX_TEAM_ENTRIES)
        .map(formatTeamEntry);
      if (clean.length === 0) continue;
      compact[short] = clean;
      continue;
    }
    if (field === "menu" && Array.isArray(value)) {
      const clean = value
        .map((v) => parseMenuEntry(String(v)))
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .slice(0, opciones.cartaCompleta ? MAX_MENU_ENTRIES_SALON : MAX_MENU_ENTRIES)
        .map(formatMenuEntry);
      if (clean.length === 0) continue;
      compact[short] = clean;
      continue;
    }
    if (field === "faq" && Array.isArray(value)) {
      // Igual que team/menu: se valida al codificar con la misma regla que al
      // descodificar, para que una pregunta sin respuesta no viaje en el enlace.
      const clean = value
        .map((v) => parseFaqEntry(String(v)))
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .slice(0, MAX_FAQ_ENTRIES)
        .map(formatFaqEntry);
      if (clean.length === 0) continue;
      compact[short] = clean;
      continue;
    }
    if (field === "priorityHours" && Array.isArray(value)) {
      // Igual que team/menu: se valida al codificar con la misma regla que
      // al descodificar, para que un rango corrupto no se cuele en el enlace.
      const clean = value
        .map((v) => parsePriorityRange(String(v)))
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .slice(0, MAX_PRIORITY_RANGES)
        .map(formatPriorityRange);
      if (clean.length === 0) continue;
      compact[short] = clean;
      continue;
    }
    if (Array.isArray(value)) {
      const clean = value.map((v) => String(v).trim()).filter(Boolean);
      if (clean.length === 0) continue;
      compact[short] = clean;
      continue;
    }
    compact[short] = value;
  }

  // Campos de personalización — no viven en SalonProfile, se codifican aparte.
  const modulos = (profile.modulosOcultos ?? []).filter((m) => MODULOS_OCULTABLES.includes(m));
  if (modulos.length > 0) compact[PERSONALIZACION_KEYS.modulosOcultos] = modulos;

  // true es el comportamiento de siempre: solo ocupa sitio en el enlace
  // cuando se ha apagado explícitamente.
  if (profile.mostrarSolicitudes === false) {
    compact[PERSONALIZACION_KEYS.mostrarSolicitudes] = 0;
  }

  if (profile.recargoRetraso) {
    const pct = Number(profile.recargoRetraso.pct);
    const minutos = Number(profile.recargoRetraso.minutos);
    if (Number.isFinite(pct) && pct > 0 && Number.isFinite(minutos) && minutos > 0) {
      compact[PERSONALIZACION_KEYS.recargoRetraso] = [
        Math.min(100, Math.round(pct)),
        Math.min(120, Math.round(minutos)),
      ];
    }
  }

  if (profile.duracionFlexible === true) {
    compact[PERSONALIZACION_KEYS.duracionFlexible] = 1;
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

    if (CAMPOS_LOTE18.has(field as keyof DemoProfileNegocio)) {
      const leido = leerLote18(field as keyof DemoProfileNegocio, value);
      if (leido !== undefined) (out as Record<string, unknown>)[field] = leido;
      continue;
    }

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
    } else if (field === "team") {
      // "Nombre" o "Nombre~Especialidad", de 1 a 3 — el resto se corta.
      if (Array.isArray(value)) {
        const clean = value
          .map((v) => parseTeamEntry(String(v)))
          .filter((v): v is NonNullable<typeof v> => v !== null)
          .slice(0, MAX_TEAM_ENTRIES)
          .map(formatTeamEntry);
        if (clean.length) out.team = clean;
      }
    } else if (field === "faq") {
      // "Pregunta~Respuesta", de 1 a 8 — el resto se corta.
      if (Array.isArray(value)) {
        const clean = value
          .map((v) => parseFaqEntry(String(v)))
          .filter((v): v is NonNullable<typeof v> => v !== null)
          .slice(0, MAX_FAQ_ENTRIES)
          .map(formatFaqEntry);
        if (clean.length) out.faq = clean;
      }
    } else if (field === "noShowFeeEur") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0 && n <= 50) out.noShowFeeEur = n;
    } else if (field === "noShowNoticeHours") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 1 && n <= 48) out.noShowNoticeHours = Math.round(n);
    } else if (field === "depositEnabled") {
      out.depositEnabled = value === 1 || value === true || value === "1";
    } else if (field === "bookingQuestionsEnabled" || field === "bookingQuestionsRequired") {
      out[field] = (value === 1 || value === true || value === "1") as never;
    } else if (field === "depositDeadlineHours") {
      if ([1, 2, 3, 4, 12, 24].includes(Number(value))) out.depositDeadlineHours = Number(value) as 1 | 2 | 3 | 4 | 12 | 24;
    } else if (field === "depositAmountEur") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0 && n <= 200) out.depositAmountEur = n;
    } else if (field === "smartSpread") {
      out.smartSpread = value === 1 || value === true || value === "1";
    } else if (field === "lastSlotBufferMin") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0 && n <= 240) out.lastSlotBufferMin = Math.round(n);
    } else if (field === "menu") {
      // "Nombre~minutos~precio" o "...~Categoría". Un enlace para compartir
      // trae como mucho 12; la vista previa de Mi página, la carta entera.
      if (Array.isArray(value)) {
        const clean = value
          .map((v) => parseMenuEntry(String(v)))
          .filter((v): v is NonNullable<typeof v> => v !== null)
          .slice(0, MAX_MENU_ENTRIES_SALON)
          .map(formatMenuEntry);
        if (clean.length) out.menu = clean;
      }
    } else if (field === "priorityHours") {
      // "HH:mm-HH:mm", de 0 a 3 — un rango corrupto o al revés se descarta.
      if (Array.isArray(value)) {
        const clean = value
          .map((v) => parsePriorityRange(String(v)))
          .filter((v): v is NonNullable<typeof v> => v !== null)
          .slice(0, MAX_PRIORITY_RANGES)
          .map(formatPriorityRange);
        if (clean.length) out.priorityHours = clean;
      }
    } else if (typeof value === "string" && value.trim() !== "") {
      out[field] = value.trim() as never;
    }
  }

  // Campos de personalización — misma cadena, claves aparte (ver KEYS arriba).
  const modulosRaw = source[PERSONALIZACION_KEYS.modulosOcultos];
  if (Array.isArray(modulosRaw)) {
    const clean = modulosRaw
      .map((v) => String(v))
      .filter((v): v is ModuloOcultable => (MODULOS_OCULTABLES as string[]).includes(v));
    if (clean.length) out.modulosOcultos = clean;
  }

  const mostrarRaw = source[PERSONALIZACION_KEYS.mostrarSolicitudes];
  if (mostrarRaw !== undefined) {
    out.mostrarSolicitudes = !(mostrarRaw === 0 || mostrarRaw === false || mostrarRaw === "0");
  }

  const recargoRaw = source[PERSONALIZACION_KEYS.recargoRetraso];
  if (Array.isArray(recargoRaw) && recargoRaw.length === 2) {
    const pct = Number(recargoRaw[0]);
    const minutos = Number(recargoRaw[1]);
    if (Number.isFinite(pct) && pct > 0 && pct <= 100 && Number.isFinite(minutos) && minutos > 0) {
      out.recargoRetraso = { pct: Math.round(pct), minutos: Math.min(120, Math.round(minutos)) };
    }
  }

  const flexibleRaw = source[PERSONALIZACION_KEYS.duracionFlexible];
  if (flexibleRaw !== undefined) {
    out.duracionFlexible = flexibleRaw === 1 || flexibleRaw === true || flexibleRaw === "1";
  }

  return Object.keys(out).length ? out : null;
}

/** `true` cuando el equipo de esta demo tiene una sola persona. */
export function esUnicoProfesional(profile: Pick<DemoProfile, "team">): boolean {
  return (profile.team ?? []).length === 1;
}

/** `true` cuando esta demo NO oculta el módulo dado. */
export function moduloVisible(
  profile: Pick<DemoProfile, "modulosOcultos">,
  clave: ModuloOcultable,
): boolean {
  return !(profile.modulosOcultos ?? []).includes(clave);
}

/** Construye el enlace público completo para una demo. */
export function demoUrl(profile: Partial<DemoProfile>, origin: string): string {
  const slug = slugify(profile.name ?? "") || "demo";
  return `${origin}/s/${slug}?${DEMO_PARAM}=${encodeDemoProfile(profile)}`;
}

/** Construye el enlace al dosier comercial imprimible de una demo. */
export function dosierUrl(profile: Partial<DemoProfile>, origin: string): string {
  const slug = slugify(profile.name ?? "") || "demo";
  return `${origin}/s/${slug}/dosier?${DEMO_PARAM}=${encodeDemoProfile(profile)}`;
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
