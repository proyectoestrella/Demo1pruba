import { expect, test } from "bun:test";

test("head del salón real: título, canónica, og:image y JSON-LD desde el perfil (26-oct)", async () => {
  const { Route } = await import("./s.$salonSlug");
  const perfilSeo = {
    name: "PeluChic", tagline: "Especialistas en novias y eventos", address: "C/ Princesa de Éboli 100, local 104, 28050 Madrid (Sanchinarro)",
    phone: "666 77 67 31", openingHours: ["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "9:00–14:00", "Cerrado"],
    rating: 4.5, reviewCount: 81, heroImage: "https://cdn.example/portada.webp", menu: [], destacados: [],
  };
  const head = (Route.options.head as (c: unknown) => { meta: Array<Record<string, string>>; links: Array<Record<string, string>>; scripts: Array<{ children: string }> })({
    match: { params: { salonSlug: "peluchic" }, pathname: "/s/peluchic", search: {} },
    loaderData: { perfilSeo },
  });
  expect(head.meta.find((m) => "title" in m)?.title).toContain("PeluChic · Peluquería en Sanchinarro, Madrid");
  expect(head.links[0]).toEqual({ rel: "canonical", href: "https://peluchic.sishow.es/" });
  expect(head.meta.find((m) => m.property === "og:image")?.content).toBe("https://cdn.example/portada.webp");
  const ld = JSON.parse(head.scripts[0].children);
  expect(ld["@type"]).toBe("HairSalon");
  expect(ld.aggregateRating.ratingValue).toBe(4.5);
});
