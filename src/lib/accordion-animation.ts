/**
 * En la primera pintura el contenido ya abierto forma parte de la maquetación
 * servida. Animarlo al hidratar convierte esa pintura estable en un salto.
 * Después de la primera acción de la persona usuaria se conserva la transición
 * habitual al abrir y cerrar categorías.
 */
export function debeAnimarAcordeon(haInteractuado: boolean): boolean {
  return haInteractuado;
}
