import { describe, expect, it } from "bun:test";
import * as notionists from "@dicebear/notionists";
import {
  CORRESPONDENCIAS_V2,
  EQUIVALENTES_NOTIONISTS,
  LABIOS_RETRATO,
  PEINADOS_RETRATO,
  PEINADOS_V1,
  cargarRetratos,
  guardarRetrato,
  normalizarRetrato,
  retratoPorDefecto,
  retratoGuardado,
  retratosCargados,
} from "./retratos-avatar";
import { avatarDiceBearUri, uriRetrato } from "./retratos-dicebear";

type Lista = { items: { enum: string[] } };
const propiedades = notionists.schema.properties as unknown as Record<"hair" | "lips", Lista>;
const VARIANTES_PELO = new Set<string>(propiedades.hair.items.enum);
const VARIANTES_LABIOS = new Set<string>(propiedades.lips.items.enum);
const IDS = new Set<string>(PEINADOS_RETRATO.map((p) => p.id));

describe("catálogo de retratos Notionists", () => {
  it("mayoría de pelo largo, al menos un afro y solo tres cortos", () => {
    expect(PEINADOS_RETRATO.filter((p) => p.grupo === "corto")).toHaveLength(3);
    expect(PEINADOS_RETRATO.filter((p) => p.grupo === "afro").length).toBeGreaterThanOrEqual(1);
    const noCortos = PEINADOS_RETRATO.filter((p) => p.grupo !== "corto").length;
    expect(noCortos).toBeGreaterThanOrEqual(10);
    expect(noCortos).toBeLessThanOrEqual(12);
    expect(IDS.size).toBe(PEINADOS_RETRATO.length);
  });

  it("todas las variantes existen en DiceBear Notionists, también la sonrisa", () => {
    for (const { id } of PEINADOS_RETRATO) expect(VARIANTES_PELO.has(id)).toBe(true);
    expect(VARIANTES_LABIOS.has(LABIOS_RETRATO)).toBe(true);
  });

  it("cada peinado genera un SVG distinto, con fondo blanco", () => {
    const uris = new Set<string>();
    for (const { id } of PEINADOS_RETRATO) {
      const uri = uriRetrato({ version: 3, peinado: id }, 96);
      expect(uri.startsWith("data:image/svg+xml")).toBe(true);
      expect(decodeURIComponent(uri)).toContain("#ffffff");
      uris.add(uri);
    }
    expect(uris.size).toBe(PEINADOS_RETRATO.length);
    expect(avatarDiceBearUri("vera-largo", 40).startsWith("data:image/svg+xml")).toBe(true);
  });

  it("el retrato automático es determinista y reparte el catálogo de 15 peinados", () => {
    expect(retratoPorDefecto("clienta-42")).toEqual(retratoPorDefecto("clienta-42"));
    const repartidos = new Set(
      Array.from({ length: 300 }, (_, i) => retratoPorDefecto(`clienta-${i}`).peinado),
    );
    expect(repartidos.size).toBe(15);
  });

  it("la carga diferida devuelve el mismo módulo y queda en caché", async () => {
    const m = await cargarRetratos();
    expect(typeof m.uriRetrato).toBe("function");
    expect(retratosCargados()).toBe(m);
  });
});

describe("compatibilidad de lo guardado", () => {
  it("v1 (antes del 21-oct): mismo peinado si sigue, equivalente si no", () => {
    for (const tipo of ["mujer", "hombre"] as const) {
      PEINADOS_V1[tipo].forEach((antigua, peinado) => {
        const r = normalizarRetrato({ version: 1, tipo, peinado });
        expect(r?.version).toBe(3);
        expect(IDS.has(r!.peinado)).toBe(true);
        const esperado: string = IDS.has(antigua) ? antigua : EQUIVALENTES_NOTIONISTS[antigua];
        expect(r!.peinado as string).toBe(esperado);
      });
    }
    expect(normalizarRetrato({ version: 1, tipo: "mujer", peinado: 0 })?.peinado).toBe("variant23");
    expect(normalizarRetrato({ version: 1, tipo: "mujer", peinado: 4 })?.peinado).toBe("variant47");
    expect(normalizarRetrato({ version: 1, tipo: "hombre", peinado: 1 })?.peinado).toBe(
      "variant06",
    );
    expect(normalizarRetrato({ version: 1, tipo: "hombre", peinado: 7 })?.peinado).toBe(
      "variant06",
    );
  });

  it("v1 conserva el tipo: las mujeres siguen con pelo largo y los hombres con corto", () => {
    PEINADOS_V1.mujer.forEach((_, peinado) => {
      const r = normalizarRetrato({ version: 1, tipo: "mujer", peinado })!;
      expect(PEINADOS_RETRATO.find((p) => p.id === r.peinado)!.grupo).not.toBe("corto");
    });
    PEINADOS_V1.hombre.forEach((_, peinado) => {
      const r = normalizarRetrato({ version: 1, tipo: "hombre", peinado })!;
      expect(PEINADOS_RETRATO.find((p) => p.id === r.peinado)!.grupo).toBe("corto");
    });
  });

  it("v1 con índice fuera de rango no rompe: peinado por defecto del tipo", () => {
    expect(normalizarRetrato({ version: 1, tipo: "mujer", peinado: 99 })?.peinado).toBe(
      "variant23",
    );
    expect(normalizarRetrato({ version: 1, tipo: "hombre", peinado: -1 })?.peinado).toBe(
      "variant06",
    );
    expect(normalizarRetrato({ version: 1, tipo: "hombre", peinado: "x" })?.peinado).toBe(
      "variant06",
    );
  });

  it("v2 (retratos de línea de la noche del 21-oct): los 15 ids tienen equivalente", () => {
    const idsV2 = [
      "pixie",
      "corto-raya",
      "bob-corto",
      "largo-liso",
      "largo-flequillo",
      "ondas-largas",
      "rizos-largos",
      "media-melena",
      "coleta-alta",
      "coleta-baja",
      "mono-alto",
      "mono-bajo",
      "trenza-lateral",
      "afro-rizado",
      "trenzas-largas",
    ];
    expect(Object.keys(CORRESPONDENCIAS_V2).sort()).toEqual([...idsV2].sort());
    for (const id of idsV2) {
      for (const expresion of ["suave", "amable", "alegre", undefined]) {
        const r = normalizarRetrato({ version: 2, peinado: id, expresion });
        expect(r).toEqual({ version: 3, peinado: CORRESPONDENCIAS_V2[id] });
        expect(IDS.has(r!.peinado)).toBe(true);
      }
    }
    expect(
      normalizarRetrato({ version: 2, peinado: "afro-rizado", expresion: "alegre" })?.peinado,
    ).toBe("variant20");
    expect(normalizarRetrato({ version: 2, peinado: "inventado" })?.peinado).toBe("variant23");
  });

  it("lee el avatar guardado completo y hace ida y vuelta con v3", () => {
    const antiguo = {
      style: "trimly",
      avatar: "vera-largo",
      retrato: { version: 1, tipo: "mujer", peinado: 7 },
    };
    expect(retratoGuardado(antiguo)).toEqual({ version: 3, peinado: "variant57" });
    const codex = {
      style: "trimly",
      avatar: "vera-largo",
      retrato: { version: 2, peinado: "trenzas-largas", expresion: "amable" },
    };
    expect(retratoGuardado(codex)).toEqual({ version: 3, peinado: "variant59" });
    const nuevo = guardarRetrato({ version: 3, peinado: "variant20" });
    expect(retratoGuardado(nuevo)).toEqual({ version: 3, peinado: "variant20" });
    expect(normalizarRetrato({ version: 3, peinado: "variant99" })?.peinado).toBe("variant23");
    expect(retratoGuardado({ style: "trimly", avatar: "vera-largo" })).toBeUndefined();
    expect(normalizarRetrato(null)).toBeUndefined();
    expect(normalizarRetrato({ version: 9 })).toBeUndefined();
  });

  it("todo lo que se pueda leer se puede dibujar", () => {
    const entradas = [
      ...(["mujer", "hombre"] as const).flatMap((tipo) =>
        [0, 1, 2, 3, 4, 5, 6, 7, 8].map((peinado) => ({ version: 1, tipo, peinado })),
      ),
      ...Object.keys(CORRESPONDENCIAS_V2).map((peinado) => ({
        version: 2,
        peinado,
        expresion: "amable",
      })),
    ];
    for (const e of entradas) {
      const uri = uriRetrato(normalizarRetrato(e)!, 40);
      expect(uri.length).toBeGreaterThan(500);
    }
  });
});
