/**
 * Feedback PeluChic (21-oct-2026): la web de clientas de un salón real no
 * enlaza al panel de profesionales. El panel sigue en su URL propia (/login, /app).
 *
 * Excepción (22-oct-2026): en una DEMO de venta (`/s/<slug>?d=<payload>`) la
 * cabecera muestra «Acceso estilista», que abre el panel de esa misma demo
 * (`/app?d=<mismo payload>`). La URL solo la construye `hrefAccesoPanelDemo`,
 * que devuelve null sin payload de demo o en un salón real.
 */
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { hrefAccesoPanelDemo } from "./demos/acceso-panel-demo";

const RUTAS = join(import.meta.dir, "..", "routes");
const publicas = readdirSync(RUTAS).filter((f) => /^s\.\$salonSlug(\.[a-z0-9-]+)?\.tsx$/.test(f));
const sinComentarios = (f: string) =>
  readFileSync(join(RUTAS, f), "utf8").replace(/\{\/\*[\s\S]*?\*\/\}|\/\/.*$/gm, "");

describe("web pública del salón sin acceso al panel", () => {
  it("hay rutas públicas que revisar", () => expect(publicas.length).toBeGreaterThan(3));
  for (const f of publicas) {
    it(`${f} no enlaza a /login ni a /app a mano ni dice «Panel del salón»`, () => {
      const src = sinComentarios(f);
      expect(src).not.toMatch(/["'`]\/login/);
      expect(src).not.toMatch(/["'`]\/app[?/"'`]/);
      expect(src).not.toMatch(/Acceso estilista|Panel del salón/);
    });
  }
  it("«Acceso …» solo existe en la cabecera, detrás de la guarda de demo", () => {
    for (const f of publicas) {
      const src = sinComentarios(f);
      const usos = src.match(/Acceso[^{\n]{0,60}\{professionalWord/g) ?? [];
      if (f !== "s.$salonSlug.tsx") {
        expect(usos.length).toBe(0);
        continue;
      }
      expect(usos.length).toBeGreaterThan(0);
      // El botón se pinta solo si la guarda devolvió un href, y el href es el suyo.
      expect(src).toMatch(/\{hrefPanelDemo && \(\s*<a\s+href=\{hrefPanelDemo\}/);
      expect(src).toMatch(/hrefAccesoPanelDemo\(\{[\s\S]*?slugHost: slugSalonDelHost\(\)[\s\S]*?salonReal:/);
    }
  });
  it("el panel sigue existiendo en su URL propia", () => {
    expect(existsSync(join(RUTAS, "login.tsx"))).toBe(true);
  });
});

describe("guarda de «Acceso estilista» (hrefAccesoPanelDemo)", () => {
  const d = "eyJuIjoiV2VsbFBlbCJ9";
  it("demo de venta: enlaza al panel de la MISMA demo, con el mismo payload", () => {
    expect(hrefAccesoPanelDemo({ demo: d, slugHost: undefined, salonReal: false })).toBe(
      `/app?d=${d}`,
    );
  });
  it("sin payload de demo: no hay botón", () => {
    for (const demo of [undefined, null, "", "  ", 2]) {
      expect(hrefAccesoPanelDemo({ demo, slugHost: undefined, salonReal: false })).toBeNull();
    }
  });
  it("salón real por subdominio (peluchic.sishow.es): no hay botón, ni con ?d=", () => {
    expect(hrefAccesoPanelDemo({ demo: d, slugHost: "peluchic", salonReal: false })).toBeNull();
    expect(hrefAccesoPanelDemo({ demo: undefined, slugHost: "peluchic", salonReal: true })).toBeNull();
  });
  it("salón real cargado en la ruta (/s/peluchic): no hay botón, ni con ?d=", () => {
    expect(hrefAccesoPanelDemo({ demo: d, slugHost: undefined, salonReal: true })).toBeNull();
    expect(hrefAccesoPanelDemo({ demo: undefined, slugHost: undefined, salonReal: true })).toBeNull();
  });
});
