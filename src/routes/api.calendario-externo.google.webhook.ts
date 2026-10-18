import { soloMetodos } from "@/lib/api/metodos";
import { createFileRoute } from "@tanstack/react-router";
import { procesarNotificacionGoogle } from "@/lib/calendario-externo/calendario-externo.server";

/**
 * El "ping" de un canal `events.watch` de Google: sin cuerpo, solo cabeceras
 * (`X-Goog-Channel-ID`, `X-Goog-Resource-State`). Dice "algo ha cambiado, ve
 * a mirar" — nunca QUÉ cambió, así que aquí solo se dispara la
 * sincronización incremental de esa conexión.
 *
 * Sin autenticación de sesión a propósito (Google no manda ninguna): cada
 * canal lleva un token HMAC derivado que Google devuelve en
 * `X-Goog-Channel-Token`. Sin ambos valores válidos no se toca nada.
 */
async function manejar({ request }: { request: Request }) {
  const canalId = request.headers.get("x-goog-channel-id");
  const tokenCanal = request.headers.get("x-goog-channel-token");
  const estadoRecurso = request.headers.get("x-goog-resource-state");
  if (!canalId || !tokenCanal) return new Response(null, { status: 401 });
  // "sync": el primer aviso al crear el canal, sin cambios reales todavía.
  try {
    const aceptada = await procesarNotificacionGoogle(canalId, tokenCanal, estadoRecurso !== "sync");
    if (!aceptada) return new Response(null, { status: 401 });
  } catch (err) {
    console.error("calendario-externo (webhook Google):", err);
    // La credencial ya se comprobó; el polling de respaldo cubre un fallo de
    // sincronización y Google no debe reintentar el mismo ping sin más datos.
  }
  return new Response(null, { status: 200 });
}

export const Route = createFileRoute("/api/calendario-externo/google/webhook")({
  server: { handlers: soloMetodos({ POST: manejar, GET: manejar }) },
});
