import { serviceMap as catalogo } from "./mock/salon";
import type { Appointment, Service } from "./mock/types";

/**
 * Una cita lleva una lista de servicios y todas las vistas la pintan igual:
 * los nombres en el orden en que se reservaron. Centralizado aquí para que
 * el panel, la confirmación y el calendario no se desvíen entre sí.
 */
export function serviceNamesOf(
  a: Pick<Appointment, "serviceIds">,
  map: Record<string, Service> = catalogo,
): string[] {
  return a.serviceIds.map((id) => map[id]?.name ?? nombreServicioLibre(id) ?? id);
}

/**
 * Servicio libre de una sola cita (lote 9g): «Otro…» en Nueva cita sin
 * guardarlo en la carta. Va en `serviceIds` como `libre:<nombre>`; la
 * duración y el precio, en los campos de siempre de la cita. El backend
 * guarda los servicios como texto separado por comas, sin clave foránea, así
 * que no hace falta ningún campo nuevo: por eso el nombre pierde las comas.
 */
export const PREFIJO_LIBRE = "libre:";

export function idServicioLibre(nombre: string): string {
  const limpio = nombre.replace(/[,;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return `${PREFIJO_LIBRE}${limpio}`;
}

export function nombreServicioLibre(id: string): string | null {
  return id.startsWith(PREFIJO_LIBRE) ? id.slice(PREFIJO_LIBRE.length) || "Servicio sin nombre" : null;
}

/** "Corte de caballero + Arreglo de barba": una sola línea para tablas y tarjetas. */
export function serviceLabelOf(
  a: Pick<Appointment, "serviceIds">,
  map: Record<string, Service> = catalogo,
): string {
  return serviceNamesOf(a, map).join(" + ");
}

/** Lo que bloquea y cobra una cita con estos servicios: la suma de todos. */
export function sumServices(list: Service[], lavado?: ConfigLavado) {
  const contados = lavado && lavadoYaIncluido(list.map((s) => s.id), lavado) ? list.filter((s) => s.id !== lavado.servicioId) : list;
  return {
    durationMin: contados.reduce((s, sv) => s + sv.durationMin, 0),
    priceEur: contados.reduce((s, sv) => s + sv.priceEur, 0),
  };
}

/** Misma forma que `SalonProfile.lavado`. */
export type ConfigLavado = { servicioId: string; incluidoEn: string[] };

/**
 * ¿Va el lavado suelto dentro de otro servicio de la cita? Entonces no se
 * cobra aparte (ni alarga la cita): el Color de PeluChic ya lo incluye.
 */
export function lavadoYaIncluido(serviceIds: readonly string[], lavado: ConfigLavado | undefined): boolean {
  if (!lavado?.servicioId || !lavado.incluidoEn?.length) return false;
  return serviceIds.includes(lavado.servicioId) && serviceIds.some((id) => id !== lavado.servicioId && lavado.incluidoEn.includes(id));
}

/**
 * Precio de un servicio en Nueva cita. Un literal sin importe no se disfraza
 * como «0 €»; los precios numéricos conservan el formato compacto de siempre.
 */
export function textoPrecioServicio(
  servicio: Pick<Service, "priceEur" | "priceText">,
  eur: (importe: number) => string,
): string {
  return servicio.priceEur === 0 && servicio.priceText?.trim()
    ? servicio.priceText.trim()
    : eur(servicio.priceEur).replace(",00", "");
}

/** Un total con algún servicio pendiente de diagnóstico no promete una cifra. */
export function textoTotalServicios(
  servicios: Array<Pick<Service, "priceEur" | "priceText">>,
  totalEur: number,
  eur: (importe: number) => string,
): string {
  return servicios.some((servicio) => servicio.priceEur === 0 && servicio.priceText?.trim())
    ? "A definir"
    : eur(totalEur).replace(",00", "");
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Lavado incluido efectivo de un salón (25-oct, decisión de Tomás: no se le
 * pregunta a la dueña; valor por defecto sensato y editable en Servicios).
 *
 * - Si la gerente ya lo configuró (aunque sea para apagarlo con `servicioId`
 *   vacío), manda lo suyo.
 * - Si no, se deduce de la carta: el lavado suelto es el servicio llamado
 *   «Lavado…» sin «+»; lo incluyen los servicios cuya descripción dice
 *   «incluye lavado» (no «no incluye»), los combinados que ya llevan «lavado»
 *   en el nombre y los de color («el color tiene incluido el lavado», María,
 *   22-oct).
 */
export function lavadoDe(
  perfil: { lavado?: ConfigLavado | null; descripcionesServicios?: Record<string, string> },
  carta: readonly Pick<Service, "id" | "name" | "description">[],
): ConfigLavado | undefined {
  if (perfil.lavado) return perfil.lavado;
  const suelto = carta.find((s) => {
    const n = sinTildes(s.name);
    return n.startsWith("lavado") && !n.includes("+");
  });
  if (!suelto) return undefined;
  const incluidoEn = carta
    .filter((s) => s.id !== suelto.id)
    .filter((s) => {
      const n = sinTildes(s.name);
      const d = sinTildes(perfil.descripcionesServicios?.[s.id] ?? s.description ?? "");
      if (/no incluye[^.]*lavado/.test(d)) return false;
      return /incluye[^.]*lavado/.test(d) || n.includes("lavado") || n.startsWith("color");
    })
    .map((s) => s.id);
  return incluidoEn.length ? { servicioId: suelto.id, incluidoEn } : undefined;
}
