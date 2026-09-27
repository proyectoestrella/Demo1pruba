import { PAGINAS_WEB } from "./sishow-web";
import { resolverHost } from "./host";

/**
 * A qué parte de siShow pertenece una ruta (integración 7):
 *
 * - `oficial`: la web oficial de sishow.es (inicio, funcionalidades, precios,
 *   contacto y legales). Es un escaparate: ni manifiesto de la app, ni
 *   botones de la demo en el iPad, ni datos del panel en el navegador.
 * - `salon`: la web de reservas de un salón (`/s/<slug>/…`, o la raíz de su
 *   subdominio, que el router ya ha traducido a `/s/<slug>`).
 * - `panel`: todo lo demás (panel, rutero, demos, accesos).
 *
 * Recibe la ruta INTERNA del router. En el subdominio de un salón, la `/`
 * pública es `/s/<slug>` por dentro (ver lib/host.ts), así que nunca cae en
 * `oficial`.
 */
export type ZonaWeb = "oficial" | "salon" | "panel";

const RUTAS_OFICIALES: ReadonlySet<string> = new Set(Object.values(PAGINAS_WEB).map((p) => p.ruta));

export function zonaDeRuta(pathname: string): ZonaWeb {
  const ruta = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname || "/";
  if (ruta === "/s" || ruta.startsWith("/s/")) return "salon";
  return RUTAS_OFICIALES.has(ruta) ? "oficial" : "panel";
}

/**
 * ¿Está esta pestaña en la web oficial? Mira la dirección REAL del navegador
 * (no la del router): en `peluchic.sishow.es/` la ruta pública es `/` pero es
 * la web del salón. Fuera del navegador, `false`.
 */
export function pestanaEnWebOficial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (resolverHost(window.location.hostname).tipo === "salon") return false;
    return zonaDeRuta(window.location.pathname) === "oficial";
  } catch {
    return false;
  }
}
