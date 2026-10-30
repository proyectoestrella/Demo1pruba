import { createFileRoute } from "@tanstack/react-router";
import { soloMetodos } from "@/lib/api/metodos";
import { sitemapXml } from "@/lib/sishow-web";
import { resolverHost } from "@/lib/host";
import { sitemapSalon } from "@/lib/seo-salon";

/** Sitemap de la web oficial (las siete páginas de sishow.es). Sale de `sitemapXml()`. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: soloMetodos({
      // En el subdominio de un salón (peluchic.sishow.es), el suyo (26-oct).
      GET: ({ request }: { request: Request }) =>
        new Response(
          resolverHost(new URL(request.url).hostname).tipo === "salon"
            ? sitemapSalon(new URL(request.url).origin)
            : sitemapXml(),
          {
            headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
          },
        ),
    }),
  },
});
