import { describe, expect, it } from "bun:test";

import { decodeDemoProfile, encodeDemoProfile } from "../demo-profile";
import { fotoConAnchos, fotosDeGaleria, portadaConAnchos } from "../galeria-salon";
import { servicesForType, textosDeCarta } from "../mock/salon";
import { idsLoMasPedido, resenasDeGoogle } from "../web-publica";
import { completarConDemoRegistrada, esFotoDeGoogle } from "./index";
import type { SalonProfile } from "../mock/types";
import { PELUCHIC } from "./peluchic";

/**
 * El `?d=` con el que se enseñó PeluChic antes del lote P (el que Tomás tiene
 * guardado y aún circula): nombre, dirección, nota, equipo, seis servicios y
 * fotos de su ficha de Google. Sin enlaces, WhatsApp, boletín ni galería propia.
 */
const D_VIEJO = "eyJuIjoiUGVsdUNoaWMiLCJ0IjoiUGVsdXF1ZXLDrWEiLCJkIjoiQ2FsbGUgUHJpbmNlc2EgZGUgw4lib2xpLCAxMDAgKGVzcXVpbmEgQy4gZGUgTWFyw61hIFR1ZG9yLCAxNCwgTG9jIDEwNCksIEhvcnRhbGV6YS9TYW5jaGluYXJybywgMjgwNTAgTWFkcmlkIiwicCI6IjY2NiA3NyA2NyAzMSIsInIiOjQuNSwiYyI6ODEsInMiOlsibm92aWFzIiwibWFkcmluYXMiLCJldmVudG9zIl0sIm8iOlsiQ2VycmFkbyIsIjEwOjAw4oCTMjA6MDAiLCIxMDowMOKAkzIwOjAwIiwiMTA6MDDigJMyMDowMCIsIjEwOjAw4oCTMjA6MDAiLCI5OjAw4oCTMTQ6MDAiLCJDZXJyYWRvIl0sImUiOlsiTWFyw61hfkVzdGlsaXN0YSwgbm92aWFzIHkgcGVpbmFkb3MgZGUgZXZlbnRvIiwiU2FyYX5Db2xvcmlzdGEsIGNvbG9yIHkgbWVjaGFzL2JhbGF5YWdlIiwiTm9lbGlhfkVzdGlsaXN0YSwgcmVjb2dpZG9zIHkgdHJhdGFtaWVudG9zIl0sIm0iOlsiQ29ydGUgeSBwZWluYWRvfjQ1fjI1flBlbHVxdWVyw61hIiwiVGludGV-NDB-MzV-UGVsdXF1ZXLDrWEiLCJNZWNoYXMgLyBiYWxheWFnZX4xMjB-ODB-UGVsdXF1ZXLDrWEiLCJQZWluYWRvIGRlIG5vdmlhfjkwfjkwflBlbHVxdWVyw61hIiwiUmVjb2dpZG8gZGUgZXZlbnRvfjYwfjQ1flBlbHVxdWVyw61hIiwiVHJhdGFtaWVudG8gY2FwaWxhcn4zMH4yMH5QZWx1cXVlcsOtYSJdLCJkZiI6MSwiaCI6Ii9hcGkvZm90bz9wbGFjZT1DaElKY19kWTNxMHVRZzBSZWVBemMxWTNpcnMmaT0wIiwiZiI6MTAsImciOlsiNSIsIjIiLCI3IiwiNCIsIjMiLCI2Il0sImZlIjoxLCJmYiI6IjY2NiA3NyA2NyAzMSIsImZhIjoyMH0";

describe("lote P.5 · portada propia de PeluChic", () => {
  it("es un fichero estático a 800 y 1600 px, no una foto de Google por /api/foto", async () => {
    expect(PELUCHIC.heroImage).toBe("/demo/peluchic-galeria/portada-1600.webp");
    expect(esFotoDeGoogle(PELUCHIC.heroImage)).toBe(false);
    for (const ancho of [800, 1600]) {
      const f = new URL(`../../../public/demo/peluchic-galeria/portada-${ancho}.webp`, import.meta.url);
      expect(await Bun.file(f).exists()).toBe(true);
    }
  });

  it("la portada lleva srcSet con los dos anchos", () => {
    expect(portadaConAnchos(PELUCHIC.heroImage)).toEqual({
      src: "/demo/peluchic-galeria/portada-800.webp",
      srcSet: "/demo/peluchic-galeria/portada-800.webp 800w, /demo/peluchic-galeria/portada-1600.webp 1600w",
    });
    expect(portadaConAnchos("/demo/x/portada-800.webp")?.src).toBe("/demo/x/portada-800.webp");
    // El proxy de Google pide su ancho con &w=; otra URL va tal cual.
    expect(portadaConAnchos("/api/foto?place=abc&i=0")).toBeNull();
    expect(portadaConAnchos("https://ejemplo.com/foto.jpg")).toBeNull();
    expect(portadaConAnchos(undefined)).toBeNull();
    // La galería (600/1200) no se confunde con la portada (800/1600).
    expect(fotoConAnchos("/demo/x/portada-1600.webp", "x").srcSet).toBeUndefined();
  });

  it("sin fotos de Google: la galería son sus 12 fotos propias", () => {
    const fotos = fotosDeGaleria(PELUCHIC);
    expect(fotos).toHaveLength(12);
    expect(fotos.every((f) => !f.src.startsWith("/api/foto"))).toBe(true);
  });
});

describe("lote P.5 · lo más pedido", () => {
  const activos = servicesForType("peluqueria", PELUCHIC.menu, textosDeCarta(PELUCHIC)).filter((s) => s.active !== false);

  it("PeluChic destaca corte y peinado, color, mechas y novias (no el lavado de 10 €)", () => {
    expect(PELUCHIC.destacados).toEqual(["lavado-corte-peinar", "color-organico", "mechas", "novias"]);
    const ids = idsLoMasPedido(PELUCHIC.destacados, activos);
    expect(ids).toEqual(PELUCHIC.destacados!);
    const nombres = ids.map((id) => activos.find((s) => s.id === id)?.name);
    expect(nombres).toEqual(["Lavado personalizado + Corte + Peinar", "Color de cobertura Organico", "Mechas*", "Novias"]);
    expect(ids).not.toContain("lavado");
  });

  it("se salta los que ya no están en la carta y, sin ninguno, cae a los cuatro primeros", () => {
    expect(idsLoMasPedido(["no-existe", "mechas", "mechas"], activos)).toEqual(["mechas"]);
    expect(idsLoMasPedido(["no-existe"], activos)).toEqual(activos.slice(0, 4).map((s) => s.id));
    expect(idsLoMasPedido(undefined, activos)).toEqual(activos.slice(0, 4).map((s) => s.id));
    // Con la carta de ejemplo, los del tipo de negocio.
    expect(idsLoMasPedido(undefined, activos, ["a", "b"])).toEqual(["a", "b"]);
    expect(idsLoMasPedido(["a", "b", "c", "d", "e"], [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }])).toHaveLength(4);
  });
});

describe("lote P.5 · reseñas de Google", () => {
  it("PeluChic tiene su ficha de Google y la web enseña su nota real con el enlace", () => {
    expect(PELUCHIC.enlaces?.resenas).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=PeluChic&query_place_id=ChIJ/);
    expect(resenasDeGoogle(PELUCHIC, false)).toEqual({ url: PELUCHIC.enlaces!.resenas!, nota: 4.5, total: 81 });
  });

  it("una demo sin ficha sigue con las reseñas de ejemplo; un salón real busca su ficha", () => {
    const sinFicha = { ...PELUCHIC, enlaces: { blog: "https://x.es" } };
    expect(resenasDeGoogle(sinFicha, false)).toBeNull();
    expect(resenasDeGoogle(sinFicha, true)?.url).toStartWith("https://www.google.com/maps/search/?api=1&query=PeluChic%20");
    // Sin nota no hay nada que enseñar, con ficha o sin ella.
    expect(resenasDeGoogle({ ...PELUCHIC, reviewCount: 0 }, false)).toBeNull();
    expect(resenasDeGoogle({ ...PELUCHIC, rating: 0 }, true)).toBeNull();
    // Una ficha que no es http(s) no llega a un href.
    expect(resenasDeGoogle({ ...PELUCHIC, enlaces: { resenas: "javascript:alert(1)" } }, false)).toBeNull();
  });
});

describe("lote P.5 · destacados y ficha viajan en el ?d= (vista previa de Mi página)", () => {
  it("ida y vuelta", () => {
    const vuelta = decodeDemoProfile(encodeDemoProfile(PELUCHIC, { cartaCompleta: true }));
    expect(vuelta?.destacados).toEqual(PELUCHIC.destacados!);
    expect(vuelta?.enlaces?.resenas).toBe(PELUCHIC.enlaces!.resenas!);
  });

  it("descarta ids raros, repetidos y los que pasan de cuatro", () => {
    const raw = btoa(JSON.stringify({ n: "X", dt: ["mechas", "mechas", "<script>", 3, "a", "b", "c", "d"] }));
    expect(decodeDemoProfile(raw)?.destacados).toEqual(["mechas", "a", "b", "c"]);
    expect(decodeDemoProfile(btoa(JSON.stringify({ n: "X", dt: "mechas" })))?.destacados).toBeUndefined();
  });
});

describe("lote P.5 · el ?d= viejo de PeluChic se completa con la demo registrada", () => {
  const viejo = decodeDemoProfile(D_VIEJO)!;

  it("el enlace viejo es el que se describe: sin enlaces ni galería propia y con portada de Google", () => {
    expect(viejo.name).toBe("PeluChic");
    expect(viejo.enlaces).toBeUndefined();
    expect(viejo.whatsapp).toBeUndefined();
    expect(viejo.galeriaPropia).toBeUndefined();
    expect(esFotoDeGoogle(viejo.heroImage)).toBe(true);
    expect(fotosDeGaleria({ tagline: "", ...viejo }).every((f) => f.src.startsWith("/api/foto"))).toBe(true);
  });

  it("completa enlaces, WhatsApp, boletín, galería propia, textos de la carta, destacados y portada", () => {
    const p = completarConDemoRegistrada("peluchic", viejo);
    expect(p.enlaces).toEqual(PELUCHIC.enlaces!);
    expect(p.whatsapp).toBe("+34 666 77 67 31");
    expect(p.boletin).toEqual(PELUCHIC.boletin!);
    expect(p.galeriaPropia).toEqual(PELUCHIC.galeriaPropia!);
    expect(p.descripcionesServicios).toEqual(PELUCHIC.descripcionesServicios!);
    expect(p.preciosLiterales).toEqual(PELUCHIC.preciosLiterales!);
    expect(p.destacados).toEqual(PELUCHIC.destacados!);
    // Portada de Google → la propia; y la galería ya no enseña ninguna foto de Google.
    expect(p.heroImage).toBe(PELUCHIC.heroImage!);
    const galeria = fotosDeGaleria({ tagline: "", ...p });
    expect(galeria).toHaveLength(12);
    expect(galeria.some((f) => f.src.startsWith("/api/foto"))).toBe(false);
  });

  it("no pisa lo que el enlace sí trae", () => {
    const p = completarConDemoRegistrada("peluchic", viejo);
    for (const campo of ["name", "address", "phone", "rating", "reviewCount", "specialties", "openingHours", "team", "menu", "depositAmountEur"] as const) {
      expect([campo, p[campo]]).toEqual([campo, viejo[campo]]);
    }
    // Lo que trae, aunque sea parcial, manda clave a clave.
    const conBlog: Partial<SalonProfile> = completarConDemoRegistrada("peluchic", { ...viejo, enlaces: { blog: "https://otro.blog/" }, whatsapp: "+34 600 000 000", heroImage: "/mi-portada.webp" });
    expect(conBlog.enlaces?.blog).toBe("https://otro.blog/");
    expect(conBlog.enlaces?.instagram).toBe(PELUCHIC.enlaces!.instagram!);
    expect(conBlog.whatsapp).toBe("+34 600 000 000");
    expect(conBlog.heroImage).toBe("/mi-portada.webp");
    // Y el enlace no se modifica.
    expect(viejo.enlaces).toBeUndefined();
  });

  it("un slug sin demo registrada devuelve el enlace tal cual", () => {
    expect(completarConDemoRegistrada("otro-salon", viejo)).toBe(viejo);
    expect(completarConDemoRegistrada(undefined, viejo)).toBe(viejo);
  });
});
