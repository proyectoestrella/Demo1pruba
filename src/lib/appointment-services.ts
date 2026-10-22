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
