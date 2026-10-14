import { describe, expect, it } from "bun:test";
import { TOTAL_AVATARES, avatarValido, conAvatar, curadoPorDefecto, elegirAvatar, iniciales, resolverAvatar } from "./avatar";
import { CURADOS, opcionesDeCurado, uriDeCurado, LICENCIA_AVATARES } from "./avatar-svg";

describe("resolverAvatar: foto > elegido > defecto > iniciales", () => {
  it("la foto manda sobre todo lo demás", () => {
    const r = resolverAvatar({ id: "c1", foto: "https://x/f.jpg", elegido: elegirAvatar(5) });
    expect(r).toEqual({ origen: "foto", foto: "https://x/f.jpg" });
  });
  it("sin foto, el elegido", () => {
    expect(resolverAvatar({ id: "c1", elegido: elegirAvatar(7) })).toEqual({ origen: "elegido", curado: 7 });
  });
  it("una foto vacía no cuenta", () => {
    expect(resolverAvatar({ id: "c1", foto: "  ", elegido: elegirAvatar(3) }).origen).toBe("elegido");
  });
  it("sin nada elegido, el de por defecto: estable para el mismo id y dentro de rango", () => {
    const a = resolverAvatar({ id: "clienta-42" });
    expect(a.origen).toBe("defecto");
    expect(resolverAvatar({ id: "clienta-42" })).toEqual(a);
    expect(a.curado).toBe(curadoPorDefecto("clienta-42"));
    expect(a.curado!).toBeGreaterThanOrEqual(0);
    expect(a.curado!).toBeLessThan(TOTAL_AVATARES);
  });
  it("un valor guardado roto cae al defecto, no revienta", () => {
    expect(resolverAvatar({ id: "c9", elegido: { style: "openPeeps", curado: 99 } }).origen).toBe("defecto");
    expect(resolverAvatar({ id: "c9", elegido: "basura" }).origen).toBe("defecto");
  });
  it("sin id ni elegido, iniciales", () => {
    expect(resolverAvatar({})).toEqual({ origen: "iniciales" });
    expect(iniciales("María del Mar López")).toBe("MD");
  });
  it("los ids reparten por el conjunto, no todos al mismo", () => {
    const usados = new Set(Array.from({ length: 200 }, (_, i) => curadoPorDefecto(`c-${i}`)));
    expect(usados.size).toBeGreaterThan(30);
  });
});

describe("guardado", () => {
  it("conAvatar pone, cambia y quita sin tocar el original", () => {
    const base = { a: elegirAvatar(1) };
    const b = conAvatar(base, "b", elegirAvatar(2));
    expect(base).toEqual({ a: elegirAvatar(1) });
    expect(Object.keys(b)).toEqual(["a", "b"]);
    expect(conAvatar(b, "a", null)).toEqual({ b: elegirAvatar(2) });
    expect(conAvatar(undefined, "z", elegirAvatar(0))).toEqual({ z: elegirAvatar(0) });
  });
  it("avatarValido", () => {
    expect(avatarValido(elegirAvatar(0))).toBe(true);
    expect(avatarValido(elegirAvatar(TOTAL_AVATARES))).toBe(false);
    expect(avatarValido({ style: "otro", curado: 1 })).toBe(false);
    expect(avatarValido(null)).toBe(false);
  });
});

describe("los 48 curados de Open Peeps", () => {
  it("hay 48, todos distintos y con cara amable", () => {
    expect(CURADOS.length).toBe(TOTAL_AVATARES);
    const amables = new Set(["smile", "calm", "cute", "smileBig", "smileTeethGap"]);
    for (const c of CURADOS) expect(amables.has(c.face)).toBe(true);
    const firmas = new Set(CURADOS.map((c) => JSON.stringify([c.head, c.skin, c.hair, c.facialHair, c.accessories])));
    expect(firmas.size).toBeGreaterThan(44);
  });
  it("cubren varias pieles, peinados y canas", () => {
    expect(new Set(CURADOS.map((c) => c.skin)).size).toBe(5);
    expect(new Set(CURADOS.map((c) => c.head)).size).toBeGreaterThan(30);
    expect(CURADOS.filter((c) => c.head.startsWith("gray")).length).toBeGreaterThanOrEqual(6);
  });
  it("se generan en cliente, sin red, como SVG", () => {
    for (const i of [0, 17, 47]) {
      const uri = uriDeCurado(i);
      expect(uri.startsWith("data:image/svg+xml")).toBe(true);
      expect(uriDeCurado(i)).toBe(uri);
    }
    expect(opcionesDeCurado(0).maskProbability).toBe(0);
  });
  it("la licencia del estilo es CC0", () => {
    expect(LICENCIA_AVATARES?.name ?? "").toContain("CC0");
  });
});
