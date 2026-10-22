/**
 * «Acceso estilista» en la web pública: SOLO en demos de venta (22-oct-2026).
 *
 * Un comercial abre la landing de una demo (`/s/<slug>?d=<payload>`) y, con un
 * toque, salta al panel de ESA misma demo (`/app?d=<mismo payload>`). En un
 * salón real (PeluChic o cualquier otro) el botón no existe: la web de
 * clientas no enlaza al panel (feedback PeluChic 21-oct).
 */
import { DEMO_PARAM } from "@/lib/demo-profile";

export function hrefAccesoPanelDemo(opts: {
  /** Valor del parámetro `d` de la URL, si lo hay. */
  demo: unknown;
  /** Slug del salón del subdominio (`peluchic.sishow.es`), si lo hay. */
  slugHost: string | undefined;
  /** El slug de la ruta es un salón real cargado desde la base de datos. */
  salonReal: boolean;
}): string | null {
  const { demo, slugHost, salonReal } = opts;
  if (typeof demo !== "string" || demo.trim() === "") return null;
  if (slugHost || salonReal) return null;
  return `/app?${DEMO_PARAM}=${encodeURIComponent(demo)}`;
}
