import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const cambios = readFileSync(new URL("./cambios.functions.ts", import.meta.url), "utf8");
const salons = readFileSync(new URL("./salons.functions.ts", import.meta.url), "utf8");
const cuerpo = (fuente: string, nombre: string) => {
  const i = fuente.indexOf(`export const ${nombre} =`);
  const j = fuente.indexOf("\nexport ", i + 10);
  return fuente.slice(i, j < 0 ? undefined : j);
};

describe("guardia del historial y las versiones", () => {
  it("guardarCambio: la autora sale del token, no del navegador, y exige el permiso de la acción", () => {
    const c = cuerpo(cambios, "guardarCambio");
    expect(c).toContain("autor: quien.userId");
    expect(c).not.toContain("c.autor");
    expect(c).toContain("exigirAcciones(quien, accionesDeCambio(data.cambio))");
  });
  it("listarCambios exige historial.ver", () => {
    expect(cuerpo(cambios, "listarCambios")).toContain('exigirAcciones(quien, ["historial.ver"])');
  });
  it("publicar guarda versión; listar y restaurar exigen web.restaurar-version", () => {
    expect(cuerpo(salons, "saveSalonProfile")).toContain("await guardarVersion(");
    expect(cuerpo(salons, "listarVersiones")).toContain('["web.restaurar-version"]');
    expect(cuerpo(salons, "restaurarVersion")).toContain('["web.restaurar-version"]');
    expect(cuerpo(salons, "restaurarVersion")).toContain('tipo: "perfil.restaurar"');
  });
});

describe("versión ligera de los ajustes (lote 9b)", () => {
  it("parche de ajustes: guarda el perfil ANTERIOR solo al empezar una tanda", async () => {
    const { tocaVersionLigera } = await import("./salons.functions");
    const ahora = new Date("2026-09-26T10:00:00Z");
    expect(tocaVersionLigera(null, ahora)).toBe(true);
    expect(tocaVersionLigera("2026-09-26T09:45:00Z", ahora)).toBe(false);
    expect(tocaVersionLigera("2026-09-26T09:15:00Z", ahora)).toBe(true);
    const c = cuerpo(salons, "patchSalonProfile");
    expect(c).toContain("tocaVersionLigera(");
    expect(c).toContain('"Antes de cambiar ajustes"');
  });
});
