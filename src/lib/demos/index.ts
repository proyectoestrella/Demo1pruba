import type { SalonProfile } from "../mock/types";
import type { MezclaSemilla } from "../mock/seed";
import { MEZCLA_PELUCHIC, PELUCHIC, VERSION_PELUCHIC } from "./peluchic";

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
}

const REGISTRO: Record<string, DemoRegistrada> = {
  peluchic: { perfil: PELUCHIC, mezcla: MEZCLA_PELUCHIC, version: VERSION_PELUCHIC },
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

/** Marca que se guarda al aplicar una demo registrada: «slug@versión». */
export function marcaDeDemo(slug: string): string | null {
  const demo = demoRegistrada(slug);
  return demo ? `${slug}@${demo.version}` : null;
}
