import { describe, expect, it } from "bun:test";
import {
  MAPA_OPEN_PEEPS_LEGADO,
  TOTAL_AVATARES_LEGADOS,
  avatarIdDeElegido,
  avatarValido,
  conAvatar,
  avatarPorDefecto,
  elegirAvatar,
  iniciales,
  resolverAvatar,
} from "./avatar";
import { AVATARES, GRUPOS_AVATAR, IDS_AVATAR, uriDeAvatar } from "./avatar-svg";

describe("resolverAvatar: foto > elegido > defecto > iniciales", () => {
  it("la foto manda sobre todo lo demás", () => {
    expect(
      resolverAvatar({ id: "c1", foto: "https://x/f.jpg", elegido: elegirAvatar(IDS_AVATAR[5]) }),
    ).toEqual({ origen: "foto", foto: "https://x/f.jpg" });
  });
  it("sin foto, el elegido", () => {
    expect(resolverAvatar({ id: "c1", elegido: elegirAvatar(IDS_AVATAR[7]) })).toEqual({
      origen: "elegido",
      avatar: IDS_AVATAR[7],
    });
  });
  it("una foto vacía no cuenta", () => {
    expect(
      resolverAvatar({ id: "c1", foto: "  ", elegido: elegirAvatar(IDS_AVATAR[3]) }).origen,
    ).toBe("elegido");
  });
  it("sin elección, el defecto es estable y pertenece al catálogo", () => {
    const avatar = resolverAvatar({ id: "clienta-42" });
    expect(avatar.origen).toBe("defecto");
    expect(resolverAvatar({ id: "clienta-42" })).toEqual(avatar);
    expect(avatar.avatar).toBe(avatarPorDefecto("clienta-42"));
    expect(IDS_AVATAR).toContain(avatar.avatar);
  });
  it("un valor guardado roto cae al defecto", () => {
    expect(resolverAvatar({ id: "c9", elegido: { style: "openPeeps", curado: 99 } }).origen).toBe(
      "defecto",
    );
    expect(resolverAvatar({ id: "c9", elegido: "basura" }).origen).toBe("defecto");
  });
  it("sin id ni elegido, usa iniciales", () => {
    expect(resolverAvatar({})).toEqual({ origen: "iniciales" });
    expect(iniciales("María del Mar López")).toBe("MD");
  });
});

describe("guardado y compatibilidad", () => {
  it("conAvatar pone, cambia y quita sin tocar el original", () => {
    const base = { a: elegirAvatar(IDS_AVATAR[1]) };
    const b = conAvatar(base, "b", elegirAvatar(IDS_AVATAR[2]));
    expect(base).toEqual({ a: elegirAvatar(IDS_AVATAR[1]) });
    expect(Object.keys(b)).toEqual(["a", "b"]);
    expect(conAvatar(b, "a", null)).toEqual({ b: elegirAvatar(IDS_AVATAR[2]) });
  });
  it("acepta los nuevos ids y las 48 claves Open Peeps históricas", () => {
    expect(avatarValido(elegirAvatar(IDS_AVATAR[0]))).toBe(true);
    for (let curado = 0; curado < TOTAL_AVATARES_LEGADOS; curado++) {
      const antiguo = { style: "openPeeps", curado } as const;
      expect(avatarValido(antiguo)).toBe(true);
      expect(avatarIdDeElegido(antiguo)).toBe(MAPA_OPEN_PEEPS_LEGADO[curado]);
      expect(resolverAvatar({ id: "c", elegido: antiguo }).avatar).toBe(
        MAPA_OPEN_PEEPS_LEGADO[curado],
      );
    }
    expect(avatarValido({ style: "trimly", avatar: "no-existe" })).toBe(false);
    expect(avatarValido({ style: "openPeeps", curado: TOTAL_AVATARES_LEGADOS })).toBe(false);
  });
});

describe("familia SVG propia", () => {
  it("tiene al menos 12 avatares, ids únicos y cuatro grupos de edad", () => {
    expect(AVATARES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(IDS_AVATAR).size).toBe(AVATARES.length);
    expect(GRUPOS_AVATAR.map((grupo) => grupo.titulo)).toEqual([
      "Primeros años",
      "Adultas",
      "Maduras",
      "Mayores",
    ]);
    expect(GRUPOS_AVATAR.every((grupo) => grupo.avatares.length >= 3)).toBe(true);
  });
  it("cada grupo conserva ids propios y un orden estable para el selector", () => {
    const idsEnGrupos = GRUPOS_AVATAR.flatMap((grupo) => grupo.avatares.map((avatar) => avatar.id));
    expect(idsEnGrupos).toEqual(IDS_AVATAR);
    expect(new Set(idsEnGrupos).size).toBe(AVATARES.length);
  });
  it("cada avatar genera SVG propio, amarillo y estable", () => {
    for (const avatar of AVATARES) {
      const uri = uriDeAvatar(avatar.id);
      expect(uri.startsWith("data:image/svg+xml,")).toBe(true);
      const svg = decodeURIComponent(uri.slice("data:image/svg+xml,".length));
      expect(svg).toContain("<svg");
      expect(svg).toContain("#F8D665");
      expect(uriDeAvatar(avatar.id)).toBe(uri);
    }
  });
  it("los fondos son pasteles de Arena y no enlazan imágenes externas", () => {
    for (const avatar of AVATARES) {
      const svg = decodeURIComponent(uriDeAvatar(avatar.id).slice("data:image/svg+xml,".length));
      expect(svg).toContain(`fill=\"${avatar.fondo}\"`);
      expect(svg).not.toContain("<image");
      expect(svg).not.toContain("href=");
    }
  });
  it("distingue pelo y rasgos de edad sin duplicar recetas", () => {
    expect(new Set(AVATARES.map((avatar) => avatar.pelo)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(AVATARES.map((avatar) => avatar.colorPelo)).size).toBeGreaterThanOrEqual(10);
    expect(AVATARES.filter((avatar) => avatar.gafas).length).toBeGreaterThanOrEqual(4);
    expect(AVATARES.filter((avatar) => avatar.arrugas).length).toBeGreaterThanOrEqual(8);
  });
});
