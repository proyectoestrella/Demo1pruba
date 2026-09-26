/**
 * Piezas compartidas de la web pública del salón (portada, reserva y
 * confirmación), lote 17.
 *
 * Un solo contenedor para cabecera, secciones, flujo de reserva y pie: antes
 * la cabecera iba a `max-w-7xl` y la reserva a `max-w-6xl`, y a 1440 px el
 * título de la reserva empezaba 58 px más a la derecha que el logo.
 */
export const CONTENEDOR_WEB = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/** Ritmo vertical de sección, sobre la escala de 4 (56 / 80 px). */
export const SECCION_WEB = "py-14 md:py-20";

/** «novias, madrinas y eventos»: lista en español con «y» antes del último. */
export function listaConY(items: string[]): string {
  const limpios = items.map((s) => s.trim()).filter(Boolean);
  if (limpios.length <= 1) return limpios[0] ?? "";
  return `${limpios.slice(0, -1).join(", ")} y ${limpios[limpios.length - 1]}`;
}

/** Nota con coma decimal: 4.5 → «4,5». */
export function notaEs(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
}
