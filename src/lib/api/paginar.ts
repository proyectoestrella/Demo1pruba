/**
 * Leer una tabla ENTERA a trozos (barrido de calidad 2026-09-26).
 *
 * PostgREST (Supabase) devuelve como mucho `max_rows` filas por petición —
 * 1000 por defecto— y lo hace en silencio: sin error, sin aviso. Un salón con
 * más de 1000 citas recibía solo las primeras 1000, y como el refresco del
 * panel SUSTITUYE la agenda por lo que llega, las demás desaparecían de la
 * pantalla. Aquí se piden páginas `[desde, hasta]` hasta que una llega corta.
 *
 * La consulta debe llevar un orden estable (p. ej. por `id`): sin él, dos
 * páginas pueden repetir o saltarse filas.
 */
export const TAM_PAGINA = 1000;
/** Tope de seguridad: 200 páginas = 200.000 filas. Nadie llega; un bucle roto, sí. */
const PAGINAS_MAX = 200;

export async function leerTodasLasFilas<T, E>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: E | null }>,
  tam: number = TAM_PAGINA,
): Promise<{ data: T[]; error: E | null }> {
  const filas: T[] = [];
  for (let i = 0; i < PAGINAS_MAX; i++) {
    const desde = i * tam;
    const r = await pagina(desde, desde + tam - 1);
    if (r.error) return { data: [], error: r.error };
    const trozo = r.data ?? [];
    for (const f of trozo) filas.push(f);
    if (trozo.length < tam) break;
  }
  return { data: filas, error: null };
}
