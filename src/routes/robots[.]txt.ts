import { createFileRoute } from "@tanstack/react-router";
import { soloMetodos } from "@/lib/api/metodos";
import { robotsTxt } from "@/lib/sishow-web";

/**
 * robots.txt de la web oficial: todo indexable salvo el panel, la API, los
 * accesos y la demo; apunta al sitemap de sishow.es. El contenido sale de
 * `robotsTxt()` en lib/sishow-web.ts.
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: soloMetodos({
      GET: () =>
        new Response(robotsTxt(), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        }),
    }),
  },
});
