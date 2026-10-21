/** Feedback PeluChic (21-oct-2026): «Reservas con siShow» discreto, enlazado a sishow.es. */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RUTAS = join(import.meta.dir, "..", "routes");
const enlace = /<a\s+href="https:\/\/sishow\.es"\s+target="_blank"\s+rel="noopener"[^>]*>\s*(Reservas con siShow|Powered by siShow\.es)\s*<\/a>/;

describe("powered by siShow", () => {
  for (const f of ["s.$salonSlug.tsx", "s.$salonSlug.confirmation.tsx"]) {
    it(`${f} enlaza a https://sishow.es en pestaña nueva con rel=noopener`, () => {
      expect(readFileSync(join(RUTAS, f), "utf8")).toMatch(enlace);
    });
  }
  it("sin colores nuevos: solo tokens existentes en el enlace", () => {
    const src = readFileSync(join(RUTAS, "s.$salonSlug.confirmation.tsx"), "utf8");
    const bloque = src.slice(src.indexOf("Powered by siShow.es") - 300, src.indexOf("Powered by siShow.es"));
    expect(bloque).not.toMatch(/#[0-9a-f]{3,6}|rgb\(|text-(red|blue|green|gray|slate)-/i);
  });
});
