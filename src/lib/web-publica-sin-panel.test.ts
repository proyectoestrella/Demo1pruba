/**
 * Feedback PeluChic (21-oct-2026): la web de clientas no enlaza al panel de
 * profesionales. El panel sigue en su URL propia (/login, /app).
 */
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RUTAS = join(import.meta.dir, "..", "routes");
const publicas = readdirSync(RUTAS).filter((f) => /^s\.\$salonSlug(\.[a-z0-9-]+)?\.tsx$/.test(f));

describe("web pública del salón sin acceso al panel", () => {
  it("hay rutas públicas que revisar", () => expect(publicas.length).toBeGreaterThan(3));
  for (const f of publicas) {
    it(`${f} no enlaza a /login ni a /app ni dice «Acceso …»`, () => {
      const src = readFileSync(join(RUTAS, f), "utf8").replace(/\{\/\*[\s\S]*?\*\/\}|\/\/.*$/gm, "");
      expect(src).not.toMatch(/["'`]\/login/);
      expect(src).not.toMatch(/["'`]\/app[?/"'`]/);
      expect(src).not.toMatch(/Acceso \{?professionalWord|Acceso estilista|Panel del salón/);
    });
  }
  it("el panel sigue existiendo en su URL propia", () => {
    expect(existsSync(join(RUTAS, "login.tsx"))).toBe(true);
  });
});
