import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import QRCode from "qrcode";
import { z } from "zod";

/**
 * Genera el QR del dosier en el servidor, no en el navegador.
 *
 * El dosier se imprime desde `window.print()`, así que el QR tiene que estar
 * ya en el HTML que sirve el servidor (SSR): si se generara en un
 * `useEffect`, un iPad que imprime antes de que ese efecto termine —o
 * cualquier entorno sin JS, como el `vite dev` de un worktree— se quedaría
 * sin QR en el PDF.
 *
 * Apunta a la URL pública completa de la demo de ESE salón
 * (origen + `/s/<slug>?d=<mismo d>`), para que escanearlo desde el dosier
 * impreso lleve a la misma demo que se enseñó en la visita.
 */
export const getDosierQr = createServerFn({ method: "POST" })
  .inputValidator(z.object({
      // Solo una ruta interna: `//otro.sitio` o `@host` harían que el QR impreso
      // apunte fuera de nuestro dominio; y un tope, porque un QR no admite más.
      path: z.string().min(1).max(2900).regex(/^\/(?![/\\])/, "La ruta debe empezar por una sola /"),
    }))
  .handler(async ({ data }) => {
    let origin = "";
    try {
      const reqUrl = getRequestUrl();
      origin = `${reqUrl.protocol}//${reqUrl.host}`;
    } catch {
      // Sin contexto de petición (p. ej. una build estática): el QR queda
      // relativo, mejor que romper el render.
      origin = "";
    }
    const absoluteUrl = `${origin}${data.path}`;
    const dataUri = await QRCode.toDataURL(absoluteUrl, {
      errorCorrectionLevel: "L",
      margin: 2,
      scale: 8,
    });
    return { absoluteUrl, dataUri };
  });
