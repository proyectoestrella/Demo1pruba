import { createFileRoute } from "@tanstack/react-router";
import process from "node:process";

/**
 * Sirve una foto de Google Places sin exponer la clave.
 *
 * La URL que da Google lleva la clave dentro (`…/media?key=…`). Si esa URL se
 * guardara en la demo acabaría dentro del enlace que se manda por WhatsApp, o
 * sea: la clave de facturación en el móvil de cada peluquero visitado. Por eso
 * la demo guarda solo la REFERENCIA de la foto y el navegador pide la imagen
 * aquí; la clave se añade en el servidor y no sale de él.
 *
 * La respuesta se cachea de forma agresiva: sin eso, cada visita al enlace
 * compartido sería una llamada facturable a Google.
 */

/** Una referencia válida es `places/<id>/photos/<id>`, nada más. */
const REF_VALIDA = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export const Route = createFileRoute("/api/foto")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ref = new URL(request.url).searchParams.get("ref");

        // Se valida la forma antes de reenviar nada: sin esto, el parámetro
        // sería una vía para hacer peticiones arbitrarias con nuestra clave.
        if (!ref || !REF_VALIDA.test(ref)) {
          return new Response("Referencia de foto no válida", { status: 400 });
        }

        const key = process.env.GOOGLE_MAPS_API_KEY;
        if (!key) return new Response("Falta configurar GOOGLE_MAPS_API_KEY", { status: 503 });

        const upstream = await fetch(
          `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=1600&key=${key}`,
          { redirect: "follow" },
        );

        if (!upstream.ok || !upstream.body) {
          return new Response("No se pudo obtener la foto", { status: upstream.status || 502 });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
            // Las fotos de un local no cambian: un año de caché y el CDN
            // responde sin volver a preguntar (ni facturar).
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
