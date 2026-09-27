import { soloMetodos } from "@/lib/api/metodos";
import { createFileRoute } from "@tanstack/react-router";
import process from "node:process";
import { timingSafeEqual } from "node:crypto";
import { enviarRecordatoriosDeManana, leerFiltroRecordatorios } from "@/lib/api/recordatorios.server";

/**
 * Disparador del recordatorio automático por email (ver
 * `lib/api/recordatorios.server.ts`). Lo llama el cron de Vercel definido en
 * `vercel.json`, que manda `Authorization: Bearer <CRON_SECRET>`; para
 * lanzarlo a mano vale `?token=<CRON_SECRET>`. A mano, además, se puede
 * limitar a un salón (`?salon=<slug>`), a una cita (`?cita=<id>`) o solo
 * simular (`?dry=1`); ver `leerFiltroRecordatorios` y
 * docs/pruebas-google-2026-09-27.md.
 *
 * Sin `CRON_SECRET` en el entorno la ruta no hace nada: un endpoint que manda
 * correos no puede quedar abierto a quien adivine la URL.
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
  const filtro = leerFiltroRecordatorios(new URL(request.url));
  if ("error" in filtro) return responder(400, filtro);
  try {
    return responder(200, await enviarRecordatoriosDeManana(new Date(), undefined, filtro));
  } catch (err) {
    console.error("recordatorios:", err);
    return responder(500, { error: "no se pudieron enviar los recordatorios" });
  }
}

export const Route = createFileRoute("/api/recordatorios")({
  server: { handlers: soloMetodos({ GET: manejar, POST: manejar }) },
});
