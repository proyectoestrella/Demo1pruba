/**
 * Memoización por VERSIÓN DE DATOS (lote 15, «delay absurdo al cambiar de
 * página»). La store sustituye el array de citas/clientas/servicios cuando
 * algo cambia y lo conserva igual cuando no: la identidad del array ES la
 * versión. Así, volver a una ruta (o re-renderizar) con los mismos datos no
 * recalcula nada.
 *
 * Clave de caché: arrays largos por identidad (y longitud), cortos (≤ 64,
 * equipo y carta) por contenido; `Date` por
 * minuto (las pantallas pasan `new Date()` en cada render: sin redondear,
 * nunca acertaría; un minuto de desfase es lo que ya tiene el reloj de la
 * pantalla); primitivas por valor; objetos planos pequeños (un `Rango`) por
 * su contenido. Guarda las últimas `max` combinaciones (LRU corto): no crece
 * con el uso.
 *
 * Nada se calcula al importar: el primer cálculo es la primera llamada.
 */
const ids = new WeakMap<object, number>();
let siguienteId = 1;
const idDe = (o: object) => {
  let id = ids.get(o);
  if (id === undefined) {
    id = siguienteId++;
    ids.set(o, id);
  }
  return id;
};

function claveDe(v: unknown): string {
  if (v instanceof Date) return `d${Math.floor(v.getTime() / 60_000)}`;
  if (v === null || v === undefined) return String(v);
  // Arrays cortos (equipo, carta) por contenido: `mock/salon.ts` muta en
  // sitio el equipo y la carta al cambiar de tipo de negocio, y la identidad
  // no cambiaría. Los largos (citas, clientas) los sustituye la store.
  if (Array.isArray(v)) return v.length <= 64 ? `[${JSON.stringify(v)}]` : `#${idDe(v)}:${v.length}`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Objeto plano de valores simples o fechas (Rango, opciones): por contenido.
    const vals = Object.keys(o).sort().map((k) => {
      const x = o[k];
      if (x instanceof Date) return `${k}:${x.getTime()}`;
      if (x === null || ["string", "number", "boolean", "undefined"].includes(typeof x)) return `${k}:${String(x)}`;
      return `${k}:${claveDe(x)}`;
    });
    return `{${vals.join(",")}}`;
  }
  if (typeof v === "function") return `f${idDe(v)}`;
  return `${typeof v}:${String(v)}`;
}

export function memoPorDatos<A extends unknown[], R>(fn: (...args: A) => R, max = 8): ((...args: A) => R) & { limpiar(): void } {
  const cache = new Map<string, R>();
  const memo = ((...args: A): R => {
    const k = args.map(claveDe).join("|");
    if (cache.has(k)) {
      const r = cache.get(k)!;
      cache.delete(k);
      cache.set(k, r);
      return r;
    }
    const r = fn(...args);
    cache.set(k, r);
    if (cache.size > max) cache.delete(cache.keys().next().value as string);
    return r;
  }) as ((...args: A) => R) & { limpiar(): void };
  memo.limpiar = () => cache.clear();
  return memo;
}
