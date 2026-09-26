import { createFileRoute } from "@tanstack/react-router";
import process from "node:process";
import { servirFoto } from "@/lib/api/foto";
import { soloMetodos } from "@/lib/api/metodos";

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

export const Route = createFileRoute("/api/foto")({
  server: {
    handlers: soloMetodos({
      GET: ({ request }) => servirFoto(request, process.env.GOOGLE_MAPS_API_KEY),
    }),
  },
});
