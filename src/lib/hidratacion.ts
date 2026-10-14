/**
 * Valor que deben compartir el HTML del servidor y el primer render del
 * navegador mientras se resuelve si una web pública pertenece a un salón real.
 */
export function estadoInicialReservaPublica(): "resolviendo" {
  return "resolviendo";
}
