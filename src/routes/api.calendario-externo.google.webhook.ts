import { createFileRoute } from "@tanstack/react-router";
import { procesarNotificacionGoogle } from "@/lib/calendario-externo/calendario-externo.server";

/**
 * El "ping" de un canal `events.watch` de Google: sin cuerpo, solo cabeceras
 * (`X-Goog-Channel-ID`, `X-Goog-Resource-State`). Dice "algo ha cambiado, ve
 * a mirar" — nunca QUÉ cambió, así que aquí solo se dispara la
 * sincronización incremental de esa conexión.
 *
 * Sin autenticación de sesión a propósito (Google no manda ninguna): la
 * "autorización" es que el `X-Goog-Channel-ID` tiene que coincidir con un
 * `canal_watch_id` guardado — si no coincide, no se toca nada. Responder
 * siempre 200 rápido es lo que pide Google (si no, reintenta con backoff y,
 * si sigue fallando, para el canal).
 */
async function manejar({ request }: { request: Request }) {
  const canalId = request.headers.get("x-goog-channel-id");
  const estadoRecurso = request.headers.get("x-goog-resource-state");
  // "sync": el primer aviso al crear el canal, sin cambios reales todavía.
  if (canalId && estadoRecurso !== "sync") {
    try {
      await procesarNotificacionGoogle(canalId);
    } catch (err) {
      console.error("calendario-externo (webhook Google):", err);
      // Se responde 200 igualmente: el polling de respaldo del cron cubre
      // el caso, y devolver un error aquí solo consigue que Google reintente
      // el mismo ping sin más información.
    }
  }
  return new Response(null, { status: 200 });
}

export const Route = createFileRoute("/api/calendario-externo/google/webhook")({
  server: { handlers: { POST: manejar, GET: manejar } },
});
