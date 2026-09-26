import { createFileRoute } from "@tanstack/react-router";
import process from "node:process";
import { timingSafeEqual } from "node:crypto";
import { sincronizarPollingDeRespaldo } from "@/lib/calendario-externo/calendario-externo.server";

/**
 * Polling de respaldo cada 5 min (ver `vercel.json`): recorre TODAS las
 * conexiones activas. Es lo único que sincroniza Apple (no tiene webhooks) y
 * la red de seguridad de Google si el canal watch falla o caduca antes de
 * renovarse. Mismo candado que `/api/recordatorios` — reutiliza `CRON_SECRET`.
 */
function responder(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function autorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const cabecera = request.headers.get("authorization") ?? "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : (new URL(request.url).searchParams.get("token") ?? "");
  const a = Buffer.from(token);
  const b = Buffer.from(secreto);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function manejar({ request }: { request: Request }) {
  if (!autorizado(request)) return responder(401, { error: "no autorizado" });
  try {
    return responder(200, await sincronizarPollingDeRespaldo());
  } catch (err) {
    console.error("calendario-externo (cron):", err);
    return responder(500, { error: "no se pudo sincronizar" });
  }
}

export const Route = createFileRoute("/api/calendario-externo/cron")({
  server: { handlers: { GET: manejar, POST: manejar } },
});
