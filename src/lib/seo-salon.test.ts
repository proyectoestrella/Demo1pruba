import { describe, expect, it } from "bun:test";
import { jsonLdSalon, metaSalon, robotsSalon, sitemapSalon, zonaDeDireccion } from "./seo-salon";

const p = {
  name: "PeluChic",
  tagline: "Especialistas en novias y eventos, color orgánico y tratamientos capilares",
  address: "C/ Princesa de Éboli 100, local 104, 28050 Madrid (Sanchinarro)",
  phone: "666 77 67 31",
  openingHours: ["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "9:00–14:00", "Cerrado"],
  rating: 0,
  reviewCount: 0,
  menu: ["Color de cobertura Organico~60~41.5~~~color-organico", "Novias~90~150~~~novias"],
  destacados: ["color-organico", "novias"],
  heroImage: "https://cdn.example/portada.webp",
};
const o = "https://peluchic.sishow.es";

describe("SEO del salón", () => {
  it("robots y sitemap apuntan al subdominio del salón", () => {
    expect(robotsSalon(o)).toContain("Sitemap: https://peluchic.sishow.es/sitemap.xml");
    expect(robotsSalon(o)).toContain("Disallow: /app");
    const s = sitemapSalon(o);
    expect(s).toContain("<loc>https://peluchic.sishow.es/</loc>");
    expect(s).toContain("<loc>https://peluchic.sishow.es/book</loc>");
    expect(s).not.toContain("sishow.es/precios");
  });
  it("zona, título, descripción, canónica e imagen salen del perfil", () => {
    expect(zonaDeDireccion(p.address)).toBe("Sanchinarro, Madrid");
    const m = metaSalon(p, o, "/");
    expect(m.titulo).toBe("PeluChic · Peluquería en Sanchinarro, Madrid | Reserva tu cita online");
    expect(m.descripcion).toContain("Color de cobertura Organico, Novias");
    expect(m.canonica).toBe("https://peluchic.sishow.es/");
    expect(m.imagen).toBe("https://cdn.example/portada.webp");
    expect(metaSalon(p, o, "/book").canonica).toBe("https://peluchic.sishow.es/book");
  });
  it("JSON-LD HairSalon con horario y sin nota si no la hay; con nota real, aggregateRating", () => {
    const j = jsonLdSalon(p, o) as Record<string, unknown>;
    expect(j["@type"]).toBe("HairSalon");
    expect((j.openingHoursSpecification as unknown[]).length).toBe(5);
    expect(j.aggregateRating).toBeUndefined();
    const conNota = jsonLdSalon({ ...p, rating: 4.5, reviewCount: 81 }, o) as { aggregateRating: { ratingValue: number } };
    expect(conNota.aggregateRating.ratingValue).toBe(4.5);
  });
});
