import { describe, expect, it } from "bun:test";
import {
  CORRESPONDENCIAS_PEINADOS_LEGADOS,
  EXPRESIONES_RETRATO,
  PEINADOS_RETRATO,
  guardarRetrato,
  migrarRetratoLegado,
  retratoGuardado,
  svgRetrato,
  uriRetrato,
} from "./retratos-avatar";

describe("retratos dibujados", () => {
  it("ofrece variedad larga y afro, con solo tres peinados cortos", () => {
    expect(PEINADOS_RETRATO.filter((p) => p.grupo === "corto")).toHaveLength(3);
    expect(PEINADOS_RETRATO.filter((p) => p.grupo === "largo")).toHaveLength(10);
    expect(PEINADOS_RETRATO.filter((p) => p.grupo === "afro")).toHaveLength(2);
    expect(PEINADOS_RETRATO.map((p) => p.id)).toEqual(
      expect.arrayContaining([
        "largo-liso",
        "largo-flequillo",
        "ondas-largas",
        "rizos-largos",
        "mono-alto",
        "coleta-baja",
        "afro-rizado",
        "trenzas-largas",
      ]),
    );
  });

  it("cada peinado y expresión produce un SVG válido, ligero y sonriente", () => {
    for (const peinado of PEINADOS_RETRATO) {
      for (const expresion of EXPRESIONES_RETRATO) {
        const retrato = { version: 2, peinado: peinado.id, expresion: expresion.id } as const;
        const svg = svgRetrato(retrato);
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
        expect(svg.endsWith("</svg>")).toBe(true);
        expect(svg).toContain(`data-sonrisa="${expresion.id}"`);
        expect(svg).not.toContain("undefined");
        expect(svg).not.toContain("NaN");
        expect(svg.length).toBeLessThan(5000);
        expect(uriRetrato(retrato)).toStartWith("data:image/svg+xml,");
      }
    }
  });
});

describe("compatibilidad de peinados guardados", () => {
  it("mantiene una correspondencia explícita para las 16 opciones anteriores", () => {
    expect(Object.keys(CORRESPONDENCIAS_PEINADOS_LEGADOS)).toHaveLength(16);
    for (const tipo of ["mujer", "hombre"] as const) {
      for (let peinado = 0; peinado < 8; peinado++) {
        const migrado = migrarRetratoLegado({ version: 1, tipo, peinado });
        expect(migrado?.peinado).toBe(CORRESPONDENCIAS_PEINADOS_LEGADOS[`${tipo}:${peinado}`]);
        expect(migrado?.expresion).toBe("amable");
      }
    }
  });

  it("lee guardados v1 y conserva sin cambios los v2", () => {
    const antiguo = {
      style: "trimly",
      avatar: "vera-largo",
      retrato: { version: 1, tipo: "mujer", peinado: 7 },
    } as const;
    expect(retratoGuardado(antiguo)).toEqual({
      version: 2,
      peinado: "trenzas-largas",
      expresion: "amable",
    });

    const actual = guardarRetrato({ version: 2, peinado: "afro-rizado", expresion: "alegre" });
    expect(retratoGuardado(actual)).toEqual({
      version: 2,
      peinado: "afro-rizado",
      expresion: "alegre",
    });
  });
});
