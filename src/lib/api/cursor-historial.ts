/**
 * Cursor del historial (segunda pasada del barrido, 26/09/2026).
 *
 * Con solo `fecha < último`, dos cambios guardados en el mismo instante
 * (un deshacer y su original, un lote de la caja) partidos entre dos
 * páginas hacían que el segundo no apareciera NUNCA al pulsar «Cargar
 * más». El orden es (fecha desc, id desc) y el cursor, la pareja:
 * `fecha < F  o  (fecha = F  y  id < I)`. Filtro `or` de PostgREST, con los
 * valores entre comillas porque una fecha ISO lleva «:» y «+».
 */
const citar = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
export function cursorHistorial(fecha: string, id: string): string {
  return `fecha.lt.${citar(fecha)},and(fecha.eq.${citar(fecha)},id.lt.${citar(id)})`;
}
