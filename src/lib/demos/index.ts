import type { Appointment, Client, SalonProfile } from "../mock/types";
import type { MezclaSemilla } from "../mock/seed";
import { MEZCLA_PELUCHIC, PELUCHIC, posprocesarPeluchic, SERVICIOS_PELUCHIC, VERSION_PELUCHIC } from "./peluchic";

/**
 * Demos registradas por slug (lote P).
 *
 * El enlace `?d=` sigue siendo la forma de enseñar cualquier salón sin tocar
 * el código, pero tiene un techo: viaja por WhatsApp y la carta se corta en
 * 12 servicios. Una demo registrada vive aquí, en el código, con TODOS sus
 * datos (60 servicios, descripciones, enlaces, boletín, galería), y se abre
 * con una URL corta: `/s/<slug>` para la web de reservas y `/demo/<slug>`
 * para entrar al panel.
 *
 * Prioridades, de más a menos:
 *   1. Un salón REAL en Supabase con ese slug. Siempre gana.
 *   2. Un `?d=` en el enlace (o el de esta pestaña). Se comporta como siempre.
 *   3. La demo registrada.
 */
export interface DemoRegistrada {
  perfil: SalonProfile;
  /** Cómo se reparten las citas de la semilla entre sus servicios reales. */
  mezcla?: MezclaSemilla;
  /** Cambia con los datos: un navegador con otra versión vuelve a cargarla. */
  version: string;
  /** Duraciones que el salón no publica y son estimación nuestra: id → minutos estimados. */
  estimadas?: Record<string, number>;
  /** Retoque de las citas ya sembradas (p. ej. historial de color), tras `buildSeed`. */
  posprocesarCitas?: (citas: Appointment[], clients: Client[]) => Appointment[];
}

const REGISTRO: Record<string, DemoRegistrada> = {
  peluchic: {
    perfil: PELUCHIC,
    mezcla: MEZCLA_PELUCHIC,
    version: VERSION_PELUCHIC,
    estimadas: Object.fromEntries(SERVICIOS_PELUCHIC.filter((s) => s.estimada).map((s) => [s.id, s.duracionMin])),
    posprocesarCitas: posprocesarPeluchic,
  },
};

/** La demo registrada con este slug, o `undefined`. */
export function demoRegistrada(slug: string | undefined | null): DemoRegistrada | undefined {
  if (!slug) return undefined;
  return Object.prototype.hasOwnProperty.call(REGISTRO, slug) ? REGISTRO[slug] : undefined;
}

/** El perfil de la demo registrada con este slug, o `undefined`. */
export function demoPorSlug(slug: string | undefined | null): SalonProfile | undefined {
  return demoRegistrada(slug)?.perfil;
}

/** Slugs con demo registrada, en orden. */
export function slugsDeDemos(): string[] {
  return Object.keys(REGISTRO);
}

/**
 * ¿Es la duración de este servicio la estimación que pusimos nosotros? Deja
 * de serlo en cuanto el salón la cambia (entonces ya es suya).
 */
export function duracionEstimada(slug: string | undefined, serviceId: string, durationMin: number): boolean {
  const estimada = demoRegistrada(slug)?.estimadas?.[serviceId];
  return estimada !== undefined && estimada === durationMin;
}

/** Marca que se guarda al aplicar una demo registrada: «slug@versión». */
export function marcaDeDemo(slug: string): string | null {
  const demo = demoRegistrada(slug);
  return demo ? `${slug}@${demo.version}` : null;
}

/* ---------- Lote P.5: el `?d=` viejo de una demo registrada ---------- */

/**
 * Lo que un enlace `?d=` antiguo no trae y la demo registrada del mismo slug
 * sí. El `?d=` de PeluChic con el que se enseñó la demo (antes del lote P) no
 * lleva enlaces, WhatsApp, boletín, galería propia, textos de la carta ni
 * destacados, y su portada es una foto de la ficha de Google.
 */
export const CAMPOS_QUE_COMPLETA_LA_DEMO = [
  "enlaces",
  "whatsapp",
  "boletin",
  "galeriaPropia",
  "descripcionesServicios",
  "preciosLiterales",
  "destacados",
  "heroImage",
] as const satisfies readonly (keyof SalonProfile)[];

/** Diccionarios que se completan clave a clave (manda la del enlace). */
const POR_CLAVE = new Set<string>(["enlaces", "descripcionesServicios", "preciosLiterales"]);

function vacio(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

/** Foto servida por nuestro proxy de Google Places (`/api/foto?…`). */
export function esFotoDeGoogle(url: string | undefined | null): boolean {
  return typeof url === "string" && url.trim().startsWith("/api/foto?");
}

/**
 * El perfil de un enlace `?d=` completado con la demo registrada de ese slug:
 * cada campo de `CAMPOS_QUE_COMPLETA_LA_DEMO` que el enlace no trae (o trae
 * vacío) sale del registro; lo que el enlace sí trae no se pisa. En
 * `enlaces`, las descripciones y los precios literales se completa clave a
 * clave (un enlace con su blog sigue con su blog y gana el Instagram).
 *
 * Una excepción, a propósito: si la portada del enlace es una foto de la
 * ficha de Google (`/api/foto`) y la demo registrada tiene portada propia,
 * manda la propia. Es la misma ficha que el salón ya sustituyó por su foto,
 * Tomás quiere fuera las fotos de Google y el proxy falló (429/502) el 27-09.
 *
 * Sin demo registrada con ese slug, devuelve el perfil tal cual.
 */
export function completarConDemoRegistrada<T extends Partial<SalonProfile>>(slug: string | undefined | null, delEnlace: T): T {
  const demo = demoPorSlug(slug);
  if (!demo) return delEnlace;
  const out: Record<string, unknown> = { ...delEnlace };
  for (const campo of CAMPOS_QUE_COMPLETA_LA_DEMO) {
    const registrado = demo[campo] as unknown;
    if (vacio(registrado)) continue;
    const actual = out[campo];
    if (vacio(actual)) {
      out[campo] = registrado;
    } else if (POR_CLAVE.has(campo) && typeof actual === "object" && !Array.isArray(actual)) {
      out[campo] = { ...(registrado as object), ...(actual as object) };
    }
  }
  if (esFotoDeGoogle(out.heroImage as string | undefined) && demo.heroImage && !esFotoDeGoogle(demo.heroImage)) {
    out.heroImage = demo.heroImage;
  }
  return out as T;
}
