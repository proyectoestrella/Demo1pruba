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
