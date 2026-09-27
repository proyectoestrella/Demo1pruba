import { describe, expect, test } from "bun:test";
import { NOMBRE_PLAN } from "./plan";
import {
  PAGINAS_WEB,
  PREGUNTAS_INICIO,
  RUTAS_NO_INDEXABLES,
  cabezaWeb,
  jsonLdAplicacion,
  jsonLdPreguntas,
  robotsTxt,
  sitemapXml,
  urlCanonica,
  type ClavePagina,
} from "./sishow-web";

/** ¿Bloquea robots.txt esta ruta? Prefijo, o exacta si la regla acaba en `$`. */
function bloqueada(ruta: string): boolean {
  return RUTAS_NO_INDEXABLES.some((r) => (r.endsWith("$") ? ruta === r.slice(0, -1) : ruta.startsWith(r)));
}

describe("SEO de la web oficial", () => {
  test("canónicas siempre en https://sishow.es", () => {
    expect(urlCanonica("/")).toBe("https://sishow.es/");
    expect(urlCanonica("/precios")).toBe("https://sishow.es/precios");
  });

  test("cada página: título, descripción de 70-160 caracteres, canónica e imagen absoluta", () => {
    for (const clave of Object.keys(PAGINAS_WEB) as ClavePagina[]) {
      const { meta, links } = cabezaWeb(clave);
      const p = PAGINAS_WEB[clave];
      expect(meta).toContainEqual({ title: p.titulo });
      expect(p.descripcion.length).toBeGreaterThanOrEqual(70);
      expect(p.descripcion.length).toBeLessThanOrEqual(160);
      expect(links).toContainEqual({ rel: "canonical", href: urlCanonica(p.ruta) });
      expect(meta).toContainEqual({ property: "og:image", content: "https://sishow.es/web/icono-512.png" });
      expect(meta).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
    }
  });

  test("los títulos no se repiten entre páginas", () => {
    const titulos = Object.values(PAGINAS_WEB).map((p) => p.titulo);
    expect(new Set(titulos).size).toBe(titulos.length);
  });

  test("JSON-LD: tres ofertas en euros con el precio anual y preguntas completas", () => {
    const app = jsonLdAplicacion(NOMBRE_PLAN) as { offers: { price: string; priceCurrency: string; name: string }[] };
    expect(app.offers.map((o) => [o.name, o.price, o.priceCurrency])).toEqual([
      ["Reservas", "36", "EUR"],
      ["Reservas + Asistente", "42", "EUR"],
      ["Todo incluido", "55", "EUR"],
    ]);
    const faq = jsonLdPreguntas(PREGUNTAS_INICIO) as { mainEntity: unknown[] };
    expect(faq.mainEntity).toHaveLength(PREGUNTAS_INICIO.length);
    expect(cabezaWeb("inicio", [faq]).meta).toContainEqual({ "script:ld+json": faq });
  });

  test("robots.txt: la web oficial se indexa, el panel no, y apunta al sitemap", () => {
    const r = robotsTxt();
    expect(r).toContain("Sitemap: https://sishow.es/sitemap.xml");
    for (const ruta of ["/app", "/app/caja", "/api/foto", "/demo/peluchic", "/login"]) expect(bloqueada(ruta)).toBe(true);
    for (const p of Object.values(PAGINAS_WEB)) expect(bloqueada(p.ruta)).toBe(false);
    expect(bloqueada("/apple-touch-icon.png")).toBe(false);
  });

  test("sitemap.xml: solo las páginas vivas (inicio y legales), sin las retiradas, y XML bien formado", () => {
    const xml = sitemapXml();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    const RETIRADAS: ClavePagina[] = ["funcionalidades", "precios", "contacto"];
    for (const clave of Object.keys(PAGINAS_WEB) as ClavePagina[]) {
      const loc = `<loc>${urlCanonica(PAGINAS_WEB[clave].ruta)}</loc>`;
      if (RETIRADAS.includes(clave)) expect(xml).not.toContain(loc);
      else expect(xml).toContain(loc);
    }
    expect(xml.match(/<url>/g)).toHaveLength(Object.keys(PAGINAS_WEB).length - RETIRADAS.length);
    expect(xml.match(/<url>/g)?.length).toBe(xml.match(/<\/url>/g)?.length);
  });
});
