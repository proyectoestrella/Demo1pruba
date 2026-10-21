import { describe, expect, it } from "bun:test";

const FUENTE = await Bun.file(new URL("./fotos-personas.functions.ts", import.meta.url)).text();

describe("las funciones de fotos no se pueden llamar sin sesión de salón", () => {
  it("las cinco llevan sesión y piden acceso de miembro antes de tocar nada", () => {
    expect(FUENTE.match(/\.middleware\(\[conSesion\]\)/g)).toHaveLength(5);
    expect(FUENTE).toContain("exigirAcceso(s)");
    expect(FUENTE.indexOf("exigirAcceso(s)")).toBeLessThan(FUENTE.indexOf("getSupabaseServerClient()"));
  });
  it("la autoría y el rol salen de la sesión, no del cuerpo", () => {
    expect(FUENTE).not.toMatch(/userId|creado_por|rol:/);
  });
});
