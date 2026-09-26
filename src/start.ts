import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { vigilarEntrada } from "./lib/api/errores-serverfn";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Entradas malformadas → 4xx con mensaje en español, nunca 500 ni 200 con el
 * error de zod dentro (ver lib/api/errores-serverfn.ts).
 */
const entradaMiddleware = createMiddleware().server(async ({ request, next }) => {
  let ctx: Awaited<ReturnType<typeof next>> | undefined;
  const r = await vigilarEntrada(request, async () => {
    ctx = await next();
    return (ctx as unknown as { response?: Response }).response;
  });
  // Respuesta propia (400/406) o la reescrita: esa manda. Si no, lo que dio la cadena.
  if (r) return r;
  return ctx ?? next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, entradaMiddleware],
}));
