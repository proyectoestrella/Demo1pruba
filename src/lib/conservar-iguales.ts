/**
 * Compartir estructura entre dos lecturas del servidor (segunda pasada del
 * barrido, 26/09/2026).
 *
 * El refresco del panel trae la agenda entera cada 60 s. Antes se sustituían
 * las listas aunque nada hubiera cambiado: todos los memos por lista
 * (campañas, periodos) se recalculaban en frío y React repintaba todo. Aquí
 * cada elemento igual al anterior se sustituye por EL MISMO objeto, y si la
 * lista entera es igual se devuelve el MISMO array: para la store y para
 * React, «no ha cambiado nada».
 *
 * La igualdad es por valor, a un nivel de profundidad más (arrays como
 * `serviceIds` y objetos como `bookingAnswers`); lo más hondo se compara por
 * JSON, que es de donde viene de todas formas.
 */
function igualValor(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function igualSuperficial(a: object, b: object): boolean {
  if (a === b) return true;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!igualValor((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

export function conservarIguales<T extends { id: string }>(nuevas: T[], viejas: T[]): T[] {
  if (nuevas === viejas) return viejas;
  const porId = new Map<string, T>();
  for (const v of viejas) porId.set(v.id, v);
  let todoIgual = nuevas.length === viejas.length;
  const out = new Array<T>(nuevas.length);
  for (let i = 0; i < nuevas.length; i++) {
    const n = nuevas[i];
    const v = porId.get(n.id);
    const r = v && igualSuperficial(n, v) ? v : n;
    out[i] = r;
    if (todoIgual && r !== viejas[i]) todoIgual = false;
  }
  return todoIgual ? viejas : out;
}
