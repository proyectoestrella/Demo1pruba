import { createFileRoute } from "@tanstack/react-router";
import process from "node:process";
import { timingSafeEqual } from "node:crypto";
import { liberarSenalesVencidasDeTodos } from "@/lib/api/senales-vencidas.server";

/**
 * Disparador de la liberación automática de señales vencidas (lote 12), sin
 * depender de que alguien tenga el panel abierto. Lo llama el cron de Vercel
 * definido en `vercel.json`, que manda `Authorization: Bearer <CRON_SECRET>`;
 * para lanzarlo a mano vale `?token=<CRON_SECRET>`. Mismo patrón que
 * `/api/recordatorios`.
 *
 * Sin `CRON_SECRET` en el entorno la ruta no hace nada: un endpoint que
 * cancela citas no puede quedar abierto a quien adivine la URL.
 */
function responder(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function autorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const cabecera = request.headers.get("authorization") ?? "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : new URL(request.url).searchParams.get("token") ?? "";
  const a = Buffer.from(token);
  const b = Buffer.from(secreto);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function manejar({ request }: { request: Request }) {
  if (!autorizado(request)) return responder(401, { error: "no autorizado" });
  try {
    return responder(200, await liberarSenalesVencidasDeTodos());
  } catch (err) {
    console.error("senales-vencidas:", err);
    return responder(500, { error: "no se pudieron liberar las señales vencidas" });
  }
}

export const Route = createFileRoute("/api/senales-vencidas")({
  server: { handlers: { GET: manejar, POST: manejar } },
});
