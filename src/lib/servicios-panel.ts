import type { Service } from "./mock/types";
import { categoryOrderOf } from "./business-type";

/**
 * La carta del panel agrupada por sus secciones (lote P).
 *
 * Con seis servicios basta una rejilla; con los 60 de PeluChic en siete
 * secciones («Trabajos Cotidianos Peluquería», «Trabajos de la Mirada»…) la
 * dueña tiene que ver SU carta como la tiene en su web: por secciones, con un
 * buscador y un filtro por sección.
 */

export interface GrupoCarta {
  categoria: string;
  servicios: Service[];
  /** Precio más bajo y más alto de la sección (el de reserva de cada servicio). */
  desde: number;
  hasta: number;
}

/** Minúsculas y sin tildes, para buscar «depilacion» y encontrar «depilación». */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Agrupa en el orden en que aparecen las secciones en la carta. `categoria`
 * deja una sola; `texto` filtra por nombre, sección o descripción. Una
 * sección que se queda sin servicios no sale.
 */
export function agruparCarta(services: Service[], filtro: { categoria?: string | null; texto?: string } = {}): GrupoCarta[] {
  const q = normalizar(filtro.texto ?? "");
  const pasa = (s: Service) =>
    !q || normalizar(`${s.name} ${s.category ?? ""} ${s.description ?? ""}`).includes(q);
  const grupos: GrupoCarta[] = [];
  for (const categoria of categoryOrderOf(services)) {
    if (filtro.categoria && filtro.categoria !== categoria) continue;
    const servicios = services.filter((s) => (s.category ?? "Otros") === categoria && pasa(s));
    if (servicios.length === 0) continue;
    const precios = servicios.map((s) => s.priceEur);
    grupos.push({ categoria, servicios, desde: Math.min(...precios), hasta: Math.max(...precios) });
  }
  return grupos;
}
