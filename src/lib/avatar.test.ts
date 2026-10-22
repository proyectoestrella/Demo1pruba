import { describe, expect, it } from "bun:test";
import {
  MAPA_OPEN_PEEPS_LEGADO,
  TOTAL_AVATARES_LEGADOS,
  avatarIdDeElegido,
  avatarPorDefecto,
  avatarValido,
  conAvatar,
  elegirAvatar,
  iniciales,
  resolverAvatar,
} from "./avatar";
import {
  AVATARES,
  COLOR_CAMISETA,
  COLORES_PELO,
  EDADES,
  FONDOS_AVATAR,
  IDS_AVATAR,
  PEINADOS,
  PIELES,
  RASGOS_POR_PIEL,
  SUGERIDOS_AVATAR,
  composicionDeAvatar,
  composicionValida,
  contrasteWCAG,
  deserializarAvatar,
  serializarAvatar,
  svgDeComposicion,
  uriDeAvatar,
  type AvatarComposicion,
} from "./avatar-svg";

describe("resolverAvatar: foto > elegido > defecto > iniciales", () => {
  it("mantiene la prioridad y el automático estable", () => {
    const legado = IDS_AVATAR[5]!;
    expect(
      resolverAvatar({ id: "c1", foto: "https://x/f.jpg", elegido: elegirAvatar(legado) }),
    ).toEqual({ origen: "foto", foto: "https://x/f.jpg" });
    expect(resolverAvatar({ id: "c1", elegido: elegirAvatar(legado) })).toEqual({
      origen: "elegido",
      avatar: legado,
    });
    expect(resolverAvatar({ id: "clienta-42" })).toEqual(resolverAvatar({ id: "clienta-42" }));
    expect(resolverAvatar({ id: "clienta-42" }).avatar).toBe(avatarPorDefecto("clienta-42"));
    expect(resolverAvatar({}).origen).toBe("iniciales");
    expect(iniciales("María del Mar López")).toBe("MD");
  });
  it("descarta elecciones guardadas rotas", () => {
    expect(resolverAvatar({ id: "c9", elegido: { style: "openPeeps", curado: 99 } }).origen).toBe(
      "defecto",
    );
    expect(avatarValido({ style: "trimly", avatar: "v2:99999" })).toBe(false);
  });
});

describe("guardado compacto y compatibilidad", () => {
  it("serializa y recupera exactamente las cinco decisiones", () => {
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
  });
  it("mantiene las claves v1, las recetas v2 históricas y Open Peeps", () => {
    for (const avatar of AVATARES) {
      expect(avatarValido({ style: "trimly", avatar: avatar.id })).toBe(true);
      expect(composicionValida(composicionDeAvatar(avatar.id))).toBe(true);
      expect(uriDeAvatar(avatar.id).startsWith("data:image/svg+xml,")).toBe(true);
    }
    // Valores que podía guardar la v2 anterior: se aceptan y se dibujan aunque
    // el catálogo actual sea más amplio.
    for (const clave of ["v2:00000", "v2:01234", "v2:5d164"]) {
      expect(avatarValido({ style: "trimly", avatar: clave })).toBe(true);
      expect(composicionValida(composicionDeAvatar(clave))).toBe(true);
    }
    for (let curado = 0; curado < TOTAL_AVATARES_LEGADOS; curado++) {
      const elegido = { style: "openPeeps", curado } as const;
      expect(avatarValido(elegido)).toBe(true);
      expect(avatarIdDeElegido(elegido)).toBe(MAPA_OPEN_PEEPS_LEGADO[curado]);
    }
  });
  it("conAvatar no muta el mapa original", () => {
    const base = { a: elegirAvatar(IDS_AVATAR[1]!) };
    const cambiado = conAvatar(base, "b", elegirAvatar(SUGERIDOS_AVATAR[0]));
    expect(Object.keys(base)).toEqual(["a"]);
    expect(Object.keys(cambiado)).toEqual(["a", "b"]);
    expect(conAvatar(cambiado, "a", null)).toEqual({ b: cambiado.b });
  });
});

describe("familia SVG propia compuesta", () => {
  it("expone los diez tonos prescritos, tres edades, dieciséis peinados y seis sugeridos", () => {
    expect(PIELES.map((piel) => piel.color)).toEqual([
      "#FFE4C0",
      "#F5D7B1",
      "#EFCC9F",
      "#E2BA87",
      "#C99C62",
      "#D08B5B",
      "#AE5D29",
      "#8C5A2B",
      "#694D3D",
      "#4A2E20",
    ]);
    expect(EDADES.map((edad) => edad.id)).toEqual(["joven", "adulta", "mayor"]);
    expect(PEINADOS).toHaveLength(16);
    expect(COLORES_PELO.length).toBeGreaterThanOrEqual(8);
    expect(SUGERIDOS_AVATAR).toHaveLength(6);
  });

  it("mantiene ojos, nariz y boca con contraste WCAG de al menos 3:1", () => {
    for (const piel of PIELES) {
      const rasgos = RASGOS_POR_PIEL[piel.id];
      for (const [nombre, color] of Object.entries({
        ojos: rasgos.ojo,
        boca: rasgos.boca,
      })) {
        expect(contrasteWCAG(piel.color, color), `${piel.id}: ${nombre}`).toBeGreaterThanOrEqual(3);
      }
      // La nariz es una línea sutil de tono de piel más oscuro: solo ha de distinguirse.
      expect(contrasteWCAG(piel.color, rasgos.nariz), `${piel.id}: nariz`).toBeGreaterThanOrEqual(
        1.3,
      );
    }
  });

  it("todas las combinaciones se serializan, generan SVG válido y no usan trazos finos", () => {
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
              const svg = svgDeComposicion(receta);
              expect(deserializarAvatar(clave)).toEqual(receta);
              expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
              expect(svg.endsWith("</svg>")).toBe(true);
              expect(svg).not.toContain("undefined");
              expect(svg).not.toContain("NaN");
              for (const ancho of svg.matchAll(/stroke-width="([\d.]+)"/g))
                expect(Number(ancho[1])).toBeGreaterThanOrEqual(1.5);
              expect(svg.match(/stroke="/g)?.length ?? 0).toBe(svg.match(/stroke-width="/g)?.length ?? 0);
              expect(svg.toLowerCase()).not.toContain("sombrero");
              expect(svg.toLowerCase()).not.toContain("gorro");
              expect(svg.toLowerCase()).not.toContain("<hat");
              expect(svg).toContain(`fill="${COLOR_CAMISETA}"`);
            }
          }
        }
      }
    }
  });

  it("la camiseta es exactamente la misma sin importar piel, fondo o edad", () => {
    for (const fondo of FONDOS_AVATAR) expect(fondo.ropa).toBe(COLOR_CAMISETA);
    for (const piel of PIELES) {
      for (const edad of EDADES) {
        const svg = svgDeComposicion({
          piel: piel.id,
          peinado: "corto-con-raya",
          edad: edad.id,
          colorPelo: "castano",
          fondo: "salvia",
        });
        expect(svg.match(new RegExp(`fill="${COLOR_CAMISETA}"`, "g"))?.length).toBe(1);
      }
    }
  });

  it("la edad mayor suma canas y detalles suaves rellenos, sin gafas ni líneas", () => {
    const base: AvatarComposicion = {
      piel: "miel",
      peinado: "corto-con-raya",
      edad: "adulta",
      colorPelo: "castano",
      fondo: "salvia",
    };
    const mayor = svgDeComposicion({ ...base, edad: "mayor" });
    expect(mayor).not.toBe(svgDeComposicion(base));
    expect(mayor).toContain("stroke-linecap");
    expect(mayor).not.toContain('opacity="0.92"');
    expect(mayor).not.toContain("<rect");
  });

  it("la variante pequeña profunda lee como cara y no como gafas claras", () => {
    const receta: AvatarComposicion = {
      piel: "profunda",
      peinado: "corto-con-raya",
      edad: "adulta",
      colorPelo: "negro",
      fondo: "salvia",
    };
    const simple = svgDeComposicion(receta, { simple: true });

    // Cabeza algo mayor, dos puntos de tinta con brillo y cejas finas de pelo:
    // no hay escleróticas ni cejas claras que puedan unirse como unas gafas.
    expect(simple).toContain('cx="48" cy="46.5" rx="22" ry="25"');
    expect(simple.match(/fill="#120A06"/g)).toHaveLength(2);
    expect(simple).toContain('stroke="#261B1A" stroke-width="1.5"');
    expect(simple).not.toContain('fill="#F5F0E8"');
  });
});

import { avatarInicialesUri } from "./avatar-placeholder";
import { resolverAvatar as resolverAvatarIniciales } from "./avatar";
it("las iniciales generadas no cuentan como foto: dejan pasar el retrato", () => {
  const r = resolverAvatarIniciales({ id: "maria", foto: avatarInicialesUri("María", "maria") });
  expect(r.origen).toBe("defecto");
  expect(resolverAvatarIniciales({ id: "maria", foto: "https://x/f.webp" }).origen).toBe("foto");
});
