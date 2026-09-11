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
  return a.serviceIds.map((id) => map[id]?.name ?? id);
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
