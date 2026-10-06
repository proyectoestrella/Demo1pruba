/**
 * Los precios de una reserva pública se ven salvo que el salón haya elegido
 * ocultarlos expresamente. El importe se sigue calculando y guardando para el
 * panel; esta regla decide únicamente qué llega a ver la clienta.
 */
export function mostrarPreciosEnReserva(perfil: { ocultarPrecioReserva?: boolean }): boolean {
  return perfil.ocultarPrecioReserva !== true;
}
