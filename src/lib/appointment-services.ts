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
export function sumServices(list: Service[]) {
  return {
    durationMin: list.reduce((s, sv) => s + sv.durationMin, 0),
    priceEur: list.reduce((s, sv) => s + sv.priceEur, 0),
  };
}
