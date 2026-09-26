/**
 * Instante (ms) y día local de una cita, calculados una vez por objeto (lote
 * 15). Las métricas recorrían miles de citas decenas de veces haciendo
 * `new Date(a.start)` en cada vuelta. La caché va por objeto y comprueba el
 * texto de `start`: si alguien cambia `start` en sitio, se recalcula.
 */
const cache = new WeakMap<object, { s: string; ms: number; dia: number }>();

function entrada(a: { start: string }) {
  let e = cache.get(a);
  if (!e || e.s !== a.start) {
    const d = new Date(a.start);
    const ms = d.getTime();
    d.setHours(0, 0, 0, 0);
    e = { s: a.start, ms, dia: d.getTime() };
    cache.set(a, e);
  }
  return e;
}

/** `+new Date(a.start)`, sin volver a parsear. */
export const msDe = (a: { start: string }): number => entrada(a).ms;

/** Medianoche local del día de la cita (ms). */
export const diaDe = (a: { start: string }): number => entrada(a).dia;

/** Medianoche local de una fecha (ms). */
export function medianoche(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}
