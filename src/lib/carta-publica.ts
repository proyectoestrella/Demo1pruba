import type { Service } from "./mock/types";
import { agruparCarta } from "./servicios-panel";
import { numeroWhatsApp } from "./web-publica";

/**
 * La carta pública en dos niveles: grupo («Peluquería», «Estética») →
 * subcategoría («Corporal», «Facial») → servicios.
 *
 * `Service.grupo` es opcional. Los servicios sin grupo forman un bloque por
 * cada categoría con `grupo: null`: se ven exactamente como antes. El orden es
 * el de la carta (primera aparición).
 */
export interface SubcategoriaCarta {
  categoria: string;
  servicios: Service[];
}

export interface BloqueCarta {
  /** `null` = servicios sin grupo: un bloque por categoría, como siempre. */
  grupo: string | null;
  subcategorias: SubcategoriaCarta[];
  /** Servicios del bloque entero. */
  total: number;
}

/** Título que se enseña del bloque: el grupo, o la categoría si no tiene grupo. */
export function tituloDeBloque(b: BloqueCarta): string {
  return b.grupo ?? b.subcategorias[0]?.categoria ?? "";
}

export function esSoloConsulta(s: Pick<Service, "soloConsulta">): boolean {
  return s.soloConsulta === true;
}

/**
 * Agrupa en dos niveles. `texto` filtra (sin tildes ni mayúsculas) por nombre,
 * sección o descripción con la misma regla que el buscador del panel. Los
 * servicios apagados no salen.
 */
export function agruparCartaDosNiveles(
  services: Service[],
  filtro: { texto?: string } = {},
): BloqueCarta[] {
  const activos = services.filter((s) => s.active !== false);
  const planos = agruparCarta(activos, { texto: filtro.texto }).flatMap((g) => g.servicios);
  const bloques = new Map<string, BloqueCarta>();
  for (const s of planos) {
    const categoria = s.category ?? "Otros";
    const grupo = s.grupo?.trim() || null;
    const clave = grupo ? `g:${grupo}` : `c:${categoria}`;
    let b = bloques.get(clave);
    if (!b) {
      b = { grupo, subcategorias: [], total: 0 };
      bloques.set(clave, b);
    }
    let sub = b.subcategorias.find((x) => x.categoria === categoria);
    if (!sub) {
      sub = { categoria, servicios: [] };
      b.subcategorias.push(sub);
    }
    sub.servicios.push(s);
    b.total += 1;
  }
  return [...bloques.values()];
}

/**
 * Enlace para «Consultar» un servicio solo consulta: WhatsApp del salón si lo
 * tiene (`whatsapp` o, si no, `phone`) y, si no, el correo. `undefined` si el
 * salón no ha dado ninguno de los dos.
 */
export function enlaceConsulta(
  perfil: { whatsapp?: string; phone?: string; correoPrivacidad?: string; correoDomingosFestivos?: string; name?: string },
  servicio: Pick<Service, "name">,
): string | undefined {
  const texto = `Hola${perfil.name ? `, ${perfil.name}` : ""}. Quería consultaros sobre «${servicio.name}».`;
  const n = numeroWhatsApp(perfil.whatsapp) ?? numeroWhatsApp(perfil.phone);
  if (n) return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
  const correo = perfil.correoPrivacidad?.trim() || perfil.correoDomingosFestivos?.trim();
  if (correo) {
    return `mailto:${correo}?subject=${encodeURIComponent(`Consulta: ${servicio.name}`)}&body=${encodeURIComponent(texto)}`;
  }
  return undefined;
}
