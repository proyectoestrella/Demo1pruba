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
import {
  AVATARES,
  COLORES_PELO,
  EDADES,
  FONDOS_AVATAR,
  IDS_AVATAR,
  PEINADOS,
  PIELES,
  SUGERIDOS_AVATAR,
  composicionDeAvatar,
  composicionValida,
  deserializarAvatar,
  serializarAvatar,
  svgDeComposicion,
  uriDeAvatar,
  type AvatarComposicion,
} from "./avatar-svg";

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
  it("sin elección, el defecto es estable y pertenece al catálogo histórico", () => {
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

describe("guardado compacto y compatibilidad", () => {
  it("guarda las cinco decisiones en una clave corta y recupera exactamente la receta", () => {
    const receta: AvatarComposicion = {
      piel: "canela",
      peinado: "trenzas",
      edad: "mayor",
      colorPelo: "blanco",
      fondo: "lavanda",
    };
    const clave = serializarAvatar(receta);
    expect(clave).toMatch(/^v2:[0-9a-z]{5}$/);
    expect(deserializarAvatar(clave)).toEqual(receta);
    expect(composicionDeAvatar(clave)).toEqual(receta);
    expect(elegirAvatar(receta)).toEqual({ style: "trimly", avatar: clave });
    expect(avatarValido(elegirAvatar(receta))).toBe(true);
  });
  it("conAvatar pone, cambia y quita sin tocar el original", () => {
    const base = { a: elegirAvatar(IDS_AVATAR[1]) };
    const b = conAvatar(base, "b", elegirAvatar(SUGERIDOS_AVATAR[0]));
    expect(base).toEqual({ a: elegirAvatar(IDS_AVATAR[1]) });
    expect(Object.keys(b)).toEqual(["a", "b"]);
    expect(conAvatar(b, "a", null)).toEqual({ b: elegirAvatar(SUGERIDOS_AVATAR[0]) });
  });
  it("acepta claves de v1 y las 48 claves Open Peeps históricas", () => {
    for (const avatar of AVATARES) {
      const antiguo = { style: "trimly", avatar: avatar.id } as const;
      expect(avatarValido(antiguo)).toBe(true);
      expect(composicionValida(composicionDeAvatar(avatar.id))).toBe(true);
      expect(uriDeAvatar(avatar.id).startsWith("data:image/svg+xml,")).toBe(true);
    }
    for (let curado = 0; curado < TOTAL_AVATARES_LEGADOS; curado++) {
      const antiguo = { style: "openPeeps", curado } as const;
      expect(avatarValido(antiguo)).toBe(true);
      expect(avatarIdDeElegido(antiguo)).toBe(MAPA_OPEN_PEEPS_LEGADO[curado]);
      expect(composicionValida(composicionDeAvatar(avatarIdDeElegido(antiguo)))).toBe(true);
    }
    expect(avatarValido({ style: "trimly", avatar: "no-existe" })).toBe(false);
    expect(avatarValido({ style: "trimly", avatar: "v2:99999" })).toBe(false);
    expect(avatarValido({ style: "openPeeps", curado: TOTAL_AVATARES_LEGADOS })).toBe(false);
  });
});

describe("familia SVG propia compuesta", () => {
  it("ofrece seis tonos de piel, tres edades, al menos diez peinados y doce sugeridos", () => {
    expect(PIELES.length).toBeGreaterThanOrEqual(6);
    expect(EDADES.map((edad) => edad.id)).toEqual(["joven", "adulta", "mayor"]);
    expect(PEINADOS.length).toBeGreaterThanOrEqual(10);
    expect(COLORES_PELO.length).toBeGreaterThanOrEqual(6);
    expect(FONDOS_AVATAR.length).toBeGreaterThanOrEqual(6);
    expect(SUGERIDOS_AVATAR).toHaveLength(12);
  });
  it("todas las combinaciones válidas generan un SVG plano sin errores ni elementos prohibidos", () => {
    for (const piel of PIELES) {
      for (const peinado of PEINADOS) {
        for (const edad of EDADES) {
          for (const colorPelo of COLORES_PELO) {
            for (const fondo of FONDOS_AVATAR) {
              const receta: AvatarComposicion = {
                piel: piel.id,
                peinado: peinado.id,
                edad: edad.id,
                colorPelo: colorPelo.id,
                fondo: fondo.id,
              };
              const clave = serializarAvatar(receta);
              expect(deserializarAvatar(clave)).toEqual(receta);
              const svg = svgDeComposicion(receta);
              expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
              expect(svg.endsWith("</svg>")).toBe(true);
              expect(svg).not.toContain("undefined");
              expect(svg).not.toContain("NaN");
              expect(svg).not.toContain("<image");
              expect(svg.toLowerCase()).not.toContain("sombrero");
              expect(svg.toLowerCase()).not.toContain("gorro");
              expect(svg.toLowerCase()).not.toContain("<hat");
            }
          }
        }
      }
    }
  });
  it("los SVG llevan fondo circular, hombros y no enlazan recursos externos", () => {
    for (const sugerido of SUGERIDOS_AVATAR) {
      const svg = decodeURIComponent(
        uriDeAvatar(serializarAvatar(sugerido)).slice("data:image/svg+xml,".length),
      );
      expect(svg).toContain('<circle cx="48" cy="48" r="48"');
      expect(svg).toContain('d="M7 96c2-18');
      expect(svg).not.toContain("href=");
      expect(svg).not.toContain("<image");
    }
  });
  it("la edad mayor se distingue con gafas suaves y arrugas discretas", () => {
    const base: AvatarComposicion = {
      piel: "miel",
      peinado: "corto",
      edad: "adulta",
      colorPelo: "gris",
      fondo: "salvia",
    };
    const adulta = svgDeComposicion(base);
    const mayor = svgDeComposicion({ ...base, edad: "mayor" });
    expect(mayor).not.toBe(adulta);
    expect(mayor).toContain('<rect x="28" y="43"');
    expect(mayor).toContain('stroke="#8E6251"');
  });
});
