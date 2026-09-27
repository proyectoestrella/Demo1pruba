import { describe, expect, test } from "bun:test";
import { copiasDelCarrusel, envolver, fotoConAnchos, fotosDeGaleria } from "./galeria-salon";

describe("galería del salón", () => {
  test("fichero propio a dos anchos: srcSet de 600 y 1200 y la grande para ampliar", () => {
    const f = fotoConAnchos("/demo/peluchic/galeria/corona-flores-1200.webp", "Corona de flores");
    expect(f.src).toBe("/demo/peluchic/galeria/corona-flores-600.webp");
    expect(f.srcSet).toBe(
      "/demo/peluchic/galeria/corona-flores-600.webp 600w, /demo/peluchic/galeria/corona-flores-1200.webp 1200w",
    );
    expect(f.grande).toBe("/demo/peluchic/galeria/corona-flores-1200.webp");
  });

  test("foto del proxy de Google: pide el ancho al proxy", () => {
    const f = fotoConAnchos("/api/foto?place=abc&i=2", "x");
    expect(f.src).toBe("/api/foto?place=abc&i=2&w=600");
    expect(f.grande).toBe("/api/foto?place=abc&i=2&w=1200");
  });

  test("otra URL: tal cual y sin srcSet", () => {
    const f = fotoConAnchos("https://ejemplo.com/foto.jpg", "x");
    expect(f).toEqual({ src: "https://ejemplo.com/foto.jpg", grande: "https://ejemplo.com/foto.jpg", alt: "x" });
  });

  test("galeriaPropia manda sobre las fotos de Google", () => {
    const fotos = fotosDeGaleria({
      heroImage: "/api/foto?place=abc&i=0",
      photoCount: 10,
      galleryPhotos: ["5", "2"],
      galeriaPropia: [{ url: "/demo/x/uno-1200.webp", alt: "Uno" }, { url: " ", alt: "vacía" }],
      tagline: "Peluquería",
    });
    expect(fotos.map((f) => f.alt)).toEqual(["Uno"]);
  });

  test("sin galeriaPropia: la selección de Google, en su orden", () => {
    const fotos = fotosDeGaleria({
      heroImage: "/api/foto?place=abc&i=0",
      photoCount: 10,
      galleryPhotos: ["2", "4"],
      tagline: "Peluquería",
    });
    expect(fotos.map((f) => f.src)).toEqual(["/api/foto?place=abc&i=2&w=600", "/api/foto?place=abc&i=4&w=600"]);
    expect(fotos[0].alt).toBe("Foto 1 de la peluquería");
  });

  test("copias del carrusel: nunca menos de tres, y las que hagan falta para no dejar hueco", () => {
    expect(copiasDelCarrusel(3000, 1440)).toBe(3);
    expect(copiasDelCarrusel(1500, 2560)).toBe(4);
    expect(copiasDelCarrusel(900, 2560)).toBe(5);
    expect(copiasDelCarrusel(0, 1000)).toBe(3);
  });

  test("envolver la posición a la primera serie", () => {
    expect(envolver(1050, 1000)).toBe(50);
    expect(envolver(-30, 1000)).toBe(970);
    expect(envolver(200, 0)).toBe(200);
  });
});
