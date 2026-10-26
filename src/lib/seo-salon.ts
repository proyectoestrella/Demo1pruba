/**
 * SEO de la web de un salón en su subdominio (26-oct): robots, sitemap,
 * título y descripción con sus datos, canónica y JSON-LD `HairSalon`.
 * Nada inventado: todo sale del perfil; la nota solo si es real (> 0).
 */
import type { SalonProfile } from "./mock/types";

type PerfilSeo = Pick<SalonProfile, "name" | "tagline" | "address" | "phone" | "openingHours" | "rating" | "reviewCount"> &
  Partial<Pick<SalonProfile, "heroImage" | "logoUrl" | "destacados" | "menu" | "enlaces" | "instagram">>;

export function robotsSalon(origen: string): string {
  return ["User-agent: *", "Allow: /", "Disallow: /app", "Disallow: /api/", "Disallow: /login", "", `Sitemap: ${origen}/sitemap.xml`, ""].join("\n");
}

export function sitemapSalon(origen: string, hoy = new Date()): string {
  const fecha = hoy.toISOString().slice(0, 10);
  const url = (loc: string, prioridad: string) => `  <url><loc>${loc}</loc><lastmod>${fecha}</lastmod><priority>${prioridad}</priority></url>`;
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', url(`${origen}/`, "1.0"), url(`${origen}/book`, "0.8"), "</urlset>", ""].join("\n");
}

/** «Sanchinarro, Madrid» a partir de la dirección (barrio entre paréntesis y ciudad), si la hay. */
export function zonaDeDireccion(direccion: string | undefined): string | null {
  const d = (direccion ?? "").trim();
  if (!d) return null;
  const barrio = d.match(/\(([^)]+)\)\s*$/)?.[1]?.trim();
  const ciudad = d.match(/\d{5}\s+([A-Za-zÁÉÍÓÚÑáéíóúñ ]+?)(?:\s*\(|$)/)?.[1]?.trim();
  if (barrio && ciudad) return `${barrio}, ${ciudad}`;
  return barrio ?? ciudad ?? null;
}

function nombresDestacados(p: PerfilSeo): string[] {
  const carta = (p.menu ?? []).map((m) => ({ nombre: m.split("~")[0]?.trim(), id: m.split("~")[5]?.trim() }));
  return (p.destacados ?? [])
    .map((id) => carta.find((c) => c.id === id)?.nombre)
    .filter((x): x is string => !!x)
    .slice(0, 3);
}

export function metaSalon(p: PerfilSeo, origen: string, ruta: "/" | "/book") {
  const zona = zonaDeDireccion(p.address);
  const tipo = "Peluquería";
  const titulo =
    ruta === "/book"
      ? `Reserva tu cita en ${p.name}${zona ? ` · ${tipo} en ${zona}` : ""}`
      : `${p.name} · ${tipo}${zona ? ` en ${zona}` : ""} | Reserva tu cita online`;
  const servicios = nombresDestacados(p);
  const descripcion = [
    p.tagline?.trim(),
    servicios.length ? `Servicios: ${servicios.join(", ")}.` : "",
    zona ? `En ${zona}.` : "",
    "Reserva tu cita online, sin llamar.",
  ].filter(Boolean).join(" ").replace(/\.\./g, ".").slice(0, 300);
  const imagen = absoluta(p.heroImage || p.logoUrl, origen);
  return { titulo, descripcion, canonica: `${origen}${ruta === "/" ? "/" : "/book"}`, imagen };
}

function absoluta(url: string | undefined, origen: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${origen}${url}`;
  return undefined;
}

const DIAS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function jsonLdSalon(p: PerfilSeo, origen: string): Record<string, unknown> {
  const horario: Array<Record<string, string>> = [];
  (p.openingHours ?? []).forEach((valor, i) => {
    for (const m of (valor ?? "").matchAll(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/g)) {
      horario.push({ "@type": "OpeningHoursSpecification", dayOfWeek: DIAS[i], opens: `${m[1].padStart(2, "0")}:${m[2]}`, closes: `${m[3].padStart(2, "0")}:${m[4]}` });
    }
  });
  const imagen = absoluta(p.heroImage || p.logoUrl, origen);
  const mismo = [p.enlaces?.resenas, p.instagram].filter((x): x is string => !!x && /^https?:\/\//.test(x));
  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: p.name,
    url: `${origen}/`,
    ...(p.tagline ? { description: p.tagline } : {}),
    ...(p.phone ? { telephone: p.phone } : {}),
    ...(p.address ? { address: { "@type": "PostalAddress", streetAddress: p.address, addressCountry: "ES" } } : {}),
    ...(imagen ? { image: imagen } : {}),
    ...(horario.length ? { openingHoursSpecification: horario } : {}),
    ...(p.rating > 0 && p.reviewCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviewCount, bestRating: 5 } }
      : {}),
    ...(mismo.length ? { sameAs: mismo } : {}),
  };
}
