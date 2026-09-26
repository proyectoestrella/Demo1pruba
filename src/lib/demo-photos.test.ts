import { describe, expect, it } from "bun:test";
import { conAncho, galleryPhotosFor, placeIdFromHero, placePhotoUrl, urlFoto } from "./demo-photos";

const PLACE = "ChIJLQw358ErQg0R5c4UaPTk7_M";

describe("placePhotoUrl", () => {
  it("pide la foto por su posición", () => {
    expect(placePhotoUrl(PLACE, 1)).toBe(`/api/foto?place=${PLACE}&i=1`);
    expect(placePhotoUrl(PLACE, "2")).toBe(`/api/foto?place=${PLACE}&i=2`);
  });

  it("ignora el sufijo de los enlaces que llegaron a llevar pista", () => {
    expect(placePhotoUrl(PLACE, "3~AeeoHcKq1Xy2mN")).toBe(`/api/foto?place=${PLACE}&i=3`);
  });

  it("una posición ilegible es la portada, nunca una petición rota", () => {
    expect(placePhotoUrl(PLACE, "no-es-un-numero")).toBe(`/api/foto?place=${PLACE}&i=0`);
  });
});

describe("placeIdFromHero", () => {
  it("saca el id de una portada con índice", () => {
    expect(placeIdFromHero(`/api/foto?place=${PLACE}&i=7`)).toBe(PLACE);
  });

  it("devuelve null con una portada que no es nuestra", () => {
    expect(placeIdFromHero("https://otro.sitio/foto.jpg")).toBeNull();
    expect(placeIdFromHero(undefined)).toBeNull();
  });
});

describe("galleryPhotosFor", () => {
  it("respeta la selección hecha a mano, en su orden", () => {
    const urls = galleryPhotosFor({
      heroImage: `/api/foto?place=${PLACE}&i=9`,
      photoCount: 10,
      galleryPhotos: ["3", "1"],
    });
    expect(urls).toEqual([`/api/foto?place=${PLACE}&i=3`, `/api/foto?place=${PLACE}&i=1`]);
  });

  it("nunca devuelve más de las que caben en la rejilla", () => {
    const urls = galleryPhotosFor({
      heroImage: `/api/foto?place=${PLACE}`,
      photoCount: 10,
      galleryPhotos: ["1", "2", "3", "4", "5", "6", "7", "8"],
    });
    expect(urls).toHaveLength(6);
  });

  it("sin selección cae al orden de Google, saltando la portada", () => {
    const urls = galleryPhotosFor({ heroImage: `/api/foto?place=${PLACE}`, photoCount: 3 });
    expect(urls).toEqual([`/api/foto?place=${PLACE}&i=1`, `/api/foto?place=${PLACE}&i=2`]);
  });

  it("con una sola foto no hay galería que enseñar", () => {
    expect(galleryPhotosFor({ heroImage: `/api/foto?place=${PLACE}`, photoCount: 1 })).toEqual([]);
  });

  it("sin portada de Google no se inventa nada", () => {
    expect(galleryPhotosFor({ heroImage: "", photoCount: 8, galleryPhotos: ["1"] })).toEqual([]);
  });
});

describe("urlFoto / conAncho (lote 16)", () => {
  it("añade el ancho a la URL del proxy", () => {
    expect(urlFoto("ChIJx", 2, 800)).toBe("/api/foto?place=ChIJx&i=2&w=800");
    expect(conAncho("/api/foto?place=ChIJx&i=0&w=1600", 800)).toBe("/api/foto?place=ChIJx&i=0&w=800");
    expect(conAncho("https://otra/foto.jpg", 800)).toBe("https://otra/foto.jpg");
    expect(conAncho(undefined, 800)).toBeUndefined();
  });
});
