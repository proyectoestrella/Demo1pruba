import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Contraste WCAG 2.x de los tokens de color del panel (guía de diseño, §2 y §10):
 * texto normal ≥ 4,5:1; bordes e iconos que informan ≥ 3:1.
 */
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const raiz = css.slice(css.indexOf(":root"));

function token(nombre: string): string {
  const m = raiz.match(new RegExp(`--${nombre}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`token --${nombre} no encontrado`);
  return m[1];
}
function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const SUPERFICIES_K = ["pagina", "superficie"];
const SUPERFICIES = ["pagina", "superficie", "beige", "nata", "perla"];
const PROS = [1, 2, 3, 4, 5, 6, 7];

describe("contraste de los tokens", () => {
  test("la fórmula coincide con valores conocidos", () => {
    expect(contraste("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contraste("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });

  for (const s of SUPERFICIES) {
    for (const t of ["cafe", "cafe-medio", "cafe-suave", "moca-fuerte", "hoja-tinta", "melocoton-tinta"]) {
      test(`texto --${t} sobre --${s} ≥ 4,5`, () => {
        expect(contraste(token(t), token(s))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  for (const [t, f] of [["hoja-tinta", "salvia-clara"], ["hoja-tinta", "salvia-suave"], ["melocoton-tinta", "melocoton"], ["cafe-medio", "taupe-claro"], ["cafe-medio", "arena"], ["cafe", "taupe-claro"], ["terracota", "superficie"]] as const) {
    test(`texto --${t} sobre --${f} ≥ 4,5`, () => {
      expect(contraste(token(t), token(f))).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const s of SUPERFICIES_K) {
    for (const t of ["k-gris", "k-tinta2", "k-libre-t"]) {
      test(`texto --${t} sobre --${s} ≥ 4,5`, () => {
        expect(contraste(token(t), token(s))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  test("texto blanco sobre la acción ≥ 4,5", () => {
    expect(contraste("#FFFFFF", token("moca-fuerte"))).toBeGreaterThanOrEqual(4.5);
  });

  for (const n of PROS) {
    test(`profesional ${n}: texto café sobre el tinte ≥ 4,5 y borde ≥ 3 contra la página y la tarjeta`, () => {
      const tinte = token(`pro-${n}`);
      const borde = token(`pro-${n}-borde`);
      expect(contraste(token("cafe"), tinte)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(borde, token("pagina"))).toBeGreaterThanOrEqual(3);
      expect(contraste(borde, token("superficie"))).toBeGreaterThanOrEqual(3);
    });
  }

  test("los 7 tintes de profesional son distintos entre sí y ninguno es la terracota", () => {
    const hexes = PROS.map((n) => token(`pro-${n}-borde`));
    expect(new Set(hexes).size).toBe(7);
    expect(hexes).not.toContain(token("terracota").toUpperCase());
  });
});
