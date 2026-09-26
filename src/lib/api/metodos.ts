/**
 * Métodos HTTP de las rutas `api/*` (barrido de calidad 2026-09-26).
 *
 * TanStack Start, ante un método que la ruta no declara (PUT, DELETE…),
 * no contesta 405: pinta la aplicación y responde 200 con el HTML de la
 * portada. Un cliente o un monitor que se equivoque de método cree que ha
 * ido bien. `soloMetodos` añade el comodín `ANY`: HEAD se sirve con el GET
 * (sin cuerpo) y todo lo demás es 405 con la cabecera `Allow`.
 */
// El contexto real de TanStack (params, context, next…) lo tipa la ruta; aquí
// solo hace falta `request`, así que el parámetro queda abierto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (ctx: any) => Response | Promise<Response>;

export function soloMetodos<H extends { GET?: Handler; POST?: Handler }>(
  handlers: H,
): H & { ANY: (ctx: { request: Request }) => Promise<Response> } {
  const permitidos = Object.keys(handlers).filter((m) => m !== "ANY");
  if (handlers.GET) permitidos.push("HEAD");
  return {
    ...handlers,
    ANY: async (ctx: { request: Request }) => {
      if (ctx.request.method.toUpperCase() === "HEAD" && handlers.GET) {
        const r = await handlers.GET(ctx);
        return new Response(null, { status: r.status, headers: r.headers });
      }
      return new Response(JSON.stringify({ error: "método no permitido" }), {
        status: 405,
        headers: { Allow: permitidos.join(", "), "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    },
  };
}
