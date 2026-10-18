import { sumServices } from "./appointment-services";
import type { Service } from "./mock/types";

/**
 * Datos que necesita el resumen de una reserva pública. La suma vive en
 * `sumServices`, igual que en el resto de la cita: este módulo solo decide
 * qué se enseña a la clienta y cuándo se oculta el importe.
 */
export function resumenServiciosReserva(servicios: readonly Service[], mostrarPrecio: boolean) {
  const { durationMin, priceEur } = sumServices([...servicios]);

  return {
    cantidad: servicios.length,
    nombres: servicios.map((servicio) => servicio.name),
    durationMin,
    priceEur,
    mostrarPrecio: mostrarPrecio && servicios.length > 0,
  };
}
