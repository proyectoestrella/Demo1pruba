/**
 * Sustituye `createServerFn` de TanStack Start por una versión mínima que
 * compone lo mismo que una petición real en el servidor —validador de
 * entrada (zod) y después el handler— para poder ejecutar la función de
 * verdad desde una prueba. Sin el compilador de Start, `.handler(fn)` no
 * llega a ejecutarse por el camino normal. Solo para pruebas.
 *
 * Uso: llamar a `instalarDobleStart()` ANTES del `await import` de la
 * función que se prueba.
 */
import { mock } from "bun:test";

export function instalarDobleStart() {
  const createServerFn = () => {
    let validador: { parse?: (x: unknown) => unknown; "~standard"?: unknown } | undefined;
    const b: Record<string, unknown> = {
      middleware: () => b,
      inputValidator: (v: typeof validador) => { validador = v; return b; },
      validator: (v: typeof validador) => { validador = v; return b; },
      handler: (fn: (o: { data: unknown; context: object }) => unknown) =>
        async (o?: { data?: unknown }) => {
          const data = validador?.parse ? validador.parse(o?.data) : o?.data;
          return fn({ data, context: {} });
        },
    };
    return b;
  };
  mock.module("@tanstack/react-start", () => ({
    createServerFn,
    createMiddleware: () => ({ client: () => ({}), server: () => ({}) }),
  }));
}

/** Atajo: `llamar(fn, data)` = `fn({ data })`. */
export const llamar = <T>(fn: unknown, data: unknown): Promise<T> =>
  (fn as (o: { data: unknown }) => Promise<T>)({ data });

/**
 * `mock.module` de bun es GLOBAL para todo el proceso de `bun test` y no se
 * deshace. Para no contaminar otras pruebas, el doble delega en el módulo REAL
 * salvo mientras `activo` es true (beforeAll/afterAll del fichero que lo usa).
 */
export async function mockTransitorio(ruta: string, stubs: Record<string, (...a: never[]) => unknown>) {
  const real = (await import(ruta)) as Record<string, unknown>;
  let activo = false;
  const envuelto: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(real)) {
    envuelto[k] = typeof v === "function"
      ? (...a: unknown[]) => (activo && stubs[k] ? (stubs[k] as (...x: unknown[]) => unknown)(...a) : (v as (...x: unknown[]) => unknown)(...a))
      : v;
  }
  for (const k of Object.keys(stubs)) if (!(k in envuelto)) envuelto[k] = (...a: unknown[]) => (stubs[k] as (...x: unknown[]) => unknown)(...a);
  mock.module(ruta, () => envuelto);
  return { activar: () => { activo = true; }, desactivar: () => { activo = false; } };
}
