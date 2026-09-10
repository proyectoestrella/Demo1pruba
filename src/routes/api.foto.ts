import { createFileRoute } from "@tanstack/react-router";
import process from "node:process";

/**
 * Sirve la foto de un local de Google Places sin exponer la clave.
 *
 * Dos problemas que resuelve, y los dos se descubrieron probando:
 *
 * 1. La URL de foto que da Google lleva la clave dentro (`…/media?key=…`). Esa
 *    dirección se guarda en la demo, y la demo viaja entera dentro del enlace
 *    que se manda por WhatsApp: la clave de facturación habría acabado en el
 *    móvil de cada peluquería visitada.
 *
 * 2. La referencia de una foto ocupa casi 500 caracteres. Metida en el enlace,
 *    lo vuelve impresentable en un chat. Por eso aquí se recibe el ID del sitio
 *    —27 caracteres— y es el servidor quien averigua cuál es su foto.
 *
 * El coste se controla con la caché: sin ella, cada apertura del enlace
 * compartido sería una llamada facturable. Las fotos de un local no cambian, así
 * que se cachean un año y el CDN responde sin volver a preguntar a Google.
 */

/** Los IDs de Places son alfanuméricos con guiones; nada más entra aquí. */
const ID_VALIDO = /^[A-Za-z0-9_-]{5,300}$/;

/** Respuesta de error que no se cachea, para poder reintentar al arreglarlo. */
function error(mensaje: string, status: number) {
  return new Response(mensaje, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/foto")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const placeId = new URL(request.url).searchParams.get("place");

        // Se valida la forma antes de reenviar nada: sin esta comprobación el
        // parámetro sería una vía para lanzar peticiones arbitrarias firmadas
        // con nuestra clave.
        if (!placeId || !ID_VALIDO.test(placeId)) {
          return error("Identificador de sitio no válido", 400);
        }

        const key = process.env.GOOGLE_MAPS_API_KEY;
        if (!key) return error("Falta configurar GOOGLE_MAPS_API_KEY", 503);

        // Paso 1: pedir a Places cuál es la foto de ese sitio.
        const detalles = await fetch(
          `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
          {
            headers: {
              "X-Goog-Api-Key": key,
              "X-Goog-FieldMask": "photos",
            },
          },
        );

        if (!detalles.ok) {
          return error(`Google respondió ${detalles.status} al buscar la foto`, 502);
        }

        const json = (await detalles.json()) as { photos?: Array<{ name?: string }> };
        const referencia = json.photos?.[0]?.name;
        if (!referencia) return error("Ese sitio no tiene fotos en Google", 404);

        // Paso 2: traer la imagen y devolverla tal cual.
        const imagen = await fetch(
          `https://places.googleapis.com/v1/${referencia}/media?maxWidthPx=1600&key=${key}`,
          { redirect: "follow" },
        );

        if (!imagen.ok || !imagen.body) {
          return error("No se pudo descargar la foto", imagen.status || 502);
        }

        return new Response(imagen.body, {
          headers: {
            "Content-Type": imagen.headers.get("content-type") ?? "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
