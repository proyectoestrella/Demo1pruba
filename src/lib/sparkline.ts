/**
 * Mínimo de días con actividad para que una línea de tendencia signifique
 * algo. Con uno o dos, cualquier curva que se dibuje es la misma para todas
 * las tarjetas: plana y con un repunte al final. Eso no es información, es
 * adorno — el mismo motivo por el que se eliminó el `fallbackPct` inventado
 * de las tarjetas KPI.
 */
export const MIN_VALORES_PARA_TENDENCIA = 3;

/**
 * ¿Hay material suficiente para dibujar la línea de tendencia de una serie?
 *
 * El criterio es cuántos valores distintos de cero trae: por debajo de
 * `MIN_VALORES_PARA_TENDENCIA` no se dibuja nada y la tarjeta enseña un guion.
 */
export function hayTendenciaQueDibujar(data: readonly number[]): boolean {
  if (!data) return false;
  let conDato = 0;
  for (const v of data) {
    if (Number.isFinite(v) && v !== 0) conDato++;
    if (conDato >= MIN_VALORES_PARA_TENDENCIA) return true;
  }
  return false;
}
