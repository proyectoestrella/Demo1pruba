import { describe, expect, test } from "bun:test";
import { completarNotaGoogleDeDemo, demoPorSlug } from "./index";

describe("completarNotaGoogleDeDemo", () => {
  test("un salón real sin nota toma la de su ficha registrada", () => {
    const demo = demoPorSlug("peluchic")!;
    const out = completarNotaGoogleDeDemo("peluchic", { slug: "peluchic", rating: 0, reviewCount: 0, enlaces: { blog: "https://peluchic.online/" } });
    expect(out.rating).toBe(demo.rating);
    expect(out.reviewCount).toBe(demo.reviewCount);
    expect(out.enlaces?.blog).toBe("https://peluchic.online/");
    expect(out.enlaces?.resenas).toBe(demo.enlaces?.resenas);
  });
  test("si el salón ya guardó su nota, no se toca", () => {
    const real = { slug: "peluchic", rating: 4.8, reviewCount: 120 };
    expect(completarNotaGoogleDeDemo("peluchic", real)).toBe(real);
  });
  test("sin demo registrada devuelve el perfil tal cual", () => {
    const real = { slug: "otro-salon", rating: 0, reviewCount: 0 };
    expect(completarNotaGoogleDeDemo("otro-salon", real)).toBe(real);
  });
});
