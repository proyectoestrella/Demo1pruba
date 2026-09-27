import { describe, expect, it } from "bun:test";
import { zonaDeRuta } from "./zona-web";

describe("zona de cada ruta (integración 7)", () => {
  it("las siete páginas de la web oficial", () => {
    for (const r of ["/", "/funcionalidades", "/precios", "/contacto", "/legal/aviso-legal", "/legal/privacidad", "/legal/cookies", "/precios/"]) {
      expect([r, zonaDeRuta(r)]).toEqual([r, "oficial"]);
    }
  });

  it("la web de reservas de un salón", () => {
    for (const r of ["/s/peluchic", "/s/peluchic/", "/s/peluchic/book", "/s/the-best-shave-barber/confirmation"]) {
      expect([r, zonaDeRuta(r)]).toEqual([r, "salon"]);
    }
  });

  it("el resto es el panel (y lo que no se conoce, también)", () => {
    for (const r of ["/app", "/app/calendar", "/demo/peluchic", "/rutero", "/login", "/aceptar", "/legal", "/precio", "/sitemap.xml"]) {
      expect([r, zonaDeRuta(r)]).toEqual([r, "panel"]);
    }
  });
});
