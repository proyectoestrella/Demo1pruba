import { createFileRoute } from "@tanstack/react-router";
import { soloMetodos } from "@/lib/api/metodos";
import { sitemapXml } from "@/lib/sishow-web";

/** Sitemap de la web oficial (las siete páginas de sishow.es). Sale de `sitemapXml()`. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: soloMetodos({
      GET: () =>
        new Response(sitemapXml(), {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        }),
    }),
  },
});
