import { describe, expect, it } from "bun:test";
import {
  galleryPhotosFor,
  hintFromPhotoName,
  photoSpec,
  placeIdFromHero,
  placePhotoUrl,
} from "./demo-photos";

const PLACE = "ChIJLQw358ErQg0R5c4UaPTk7_M";
const NOMBRE_FOTO = `places/${PLACE}/photos/AeeoHcKq1Xy2mNoPqRsTuVwXyZ0123456789`;

describe("hintFromPhotoName", () => {
  it("se queda con el principio del identificador de la foto", () => {
    expect(hintFromPhotoName(NOMBRE_FOTO)).toBe("AeeoHcKq1Xy2mN");
  });

  it("devuelve vacío si el nombre no tiene la forma esperada", () => {
    expect(hintFromPhotoName("cualquier cosa")).toBe("");
  });
});

describe("photoSpec", () => {
  it("junta índice y pista", () => {
    expect(photoSpec(3, NOMBRE_FOTO)).toBe("3~AeeoHcKq1Xy2mN");
  });

  it("sin nombre de foto deja solo el índice", () => {
    expect(photoSpec(2)).toBe("2");
  });
});

describe("placePhotoUrl", () => {
  it("pasa la pista al proxy cuando la hay", () => {
    expect(placePhotoUrl(PLACE, "3~AeeoHcKq1Xy2mN")).toBe(
      `/api/foto?place=${PLACE}&i=3&k=AeeoHcKq1Xy2mN`,
    );
  });

  it("sigue sirviendo los enlaces antiguos, que solo llevaban índice", () => {
    expect(placePhotoUrl(PLACE, 1)).toBe(`/api/foto?place=${PLACE}&i=1`);
    expect(placePhotoUrl(PLACE, "2")).toBe(`/api/foto?place=${PLACE}&i=2`);
  });
});

describe("placeIdFromHero", () => {
  it("saca el id de una portada con índice y pista", () => {
    expect(placeIdFromHero(`/api/foto?place=${PLACE}&i=7&k=AbC`)).toBe(PLACE);
  });

  it("devuelve null con una portada que no es nuestra", () => {
    expect(placeIdFromHero("https://otro.sitio/foto.jpg")).toBeNull();
    expect(placeIdFromHero(undefined)).toBeNull();
  });
});

describe("galleryPhotosFor", () => {
  it("respeta la selección hecha a mano, en su orden", () => {
    const urls = galleryPhotosFor({
      heroImage: `/api/foto?place=${PLACE}&i=9&k=Portada`,
      photoCount: 10,
      galleryPhotos: ["3~AaA", "1~BbB"],
    });
    expect(urls).toEqual([
      `/api/foto?place=${PLACE}&i=3&k=AaA`,
      `/api/foto?place=${PLACE}&i=1&k=BbB`,
    ]);
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
