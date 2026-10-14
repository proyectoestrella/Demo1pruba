import { createAvatar } from "@dicebear/core";
import { openPeeps } from "@dicebear/collection";
import { TOTAL_AVATARES } from "./avatar";

/**
 * Los 48 avatares curados de Open Peeps. Solo caras amables (nada de
 * enfado, miedo ni desprecio) y mucha variedad de pelo, piel y edad.
 * Ojo: en este estilo el color de pelo solo afecta a algunos peinados
 * (flequillos, mechones, canas); el largo y el rizado salen siempre oscuros.
 */
type Piel = "ffdbb4" | "edb98a" | "d08b5b" | "ae5d29" | "694d3d";
const NEGRO = "2c1b18";
const CASTANO = "724133";
const CASTANO_CLARO = "b58143";
const CANAS = "e8e1e1";
const ROSA = "f59797";
const ROJO = "c93305";
const RUBIO = "d6b370";
const CASTANO_ROJIZO = "a55728";

interface Receta {
  head: string;
  skin: Piel;
  face: string;
  hair?: string;
  facialHair?: string;
  accessories?: string;
  /** Ropa en tonos de la marca (moca, salvia, nata tostada, terracota suave). */
  ropa: number;
}

const ROPA = ["8a6446", "78593f", "a9b29b", "d9a58b", "b7a48f", "6b7a6a"];
const FONDO = ["f3e9db", "efe7dc", "e8d9c5", "f1dccb", "e4e1d3", "f6efe4"];

const r = (head: string, skin: Piel, face: string, ropa: number, extra: Partial<Receta> = {}): Receta => ({ head, skin, face, ropa, ...extra });

export const CURADOS: readonly Receta[] = [
  // Afro, trenzas, twists, rastas, bantu (12)
  r("afro", "694d3d", "smile", 0), r("afro", "ae5d29", "smileBig", 2), r("longAfro", "694d3d", "calm", 3), r("longAfro", "ae5d29", "cute", 4),
  r("bantuKnots", "694d3d", "smileTeethGap", 1), r("bantuKnots", "ae5d29", "smile", 5), r("cornrows", "694d3d", "calm", 2), r("cornrows2", "ae5d29", "smile", 0),
  r("dreads1", "694d3d", "smileBig", 3), r("dreads2", "ae5d29", "calm", 1), r("twists", "694d3d", "cute", 5), r("twists2", "d08b5b", "smile", 4),
  // Hijab, turbante, moños (6)
  r("hijab", "edb98a", "calm", 2), r("hijab", "d08b5b", "smile", 3), r("hijab", "ffdbb4", "cute", 5), r("turban", "ae5d29", "smileBig", 0),
  r("bun", "edb98a", "smile", 1), r("buns", "d08b5b", "smile", 4),
  // Largos y medios, en todos los tonos (10)
  r("long", "ffdbb4", "smile", 3, { hair: CASTANO }), r("longCurly", "edb98a", "smileBig", 0, { hair: CASTANO_ROJIZO }), r("longBangs", "ffdbb4", "cute", 2, { hair: RUBIO }),
  r("medium1", "d08b5b", "calm", 5), r("medium2", "edb98a", "smile", 4), r("medium3", "ae5d29", "smileTeethGap", 1), r("mediumStraight", "ffdbb4", "calm", 3),
  r("mediumBangs", "d08b5b", "smile", 0), r("mediumBangs2", "edb98a", "cute", 2), r("longCurly", "ae5d29", "smile", 5),
  // Cortos, rapados y calvos, con y sin barba (6)
  r("short1", "ffdbb4", "smile", 1, { facialHair: "full" }), r("short2", "d08b5b", "smileBig", 0), r("shaved1", "ae5d29", "calm", 4),
  r("noHair1", "edb98a", "smile", 5, { facialHair: "goatee1" }), r("noHair2", "694d3d", "smileTeethGap", 2, { facialHair: "moustache1" }), r("flatTop", "d08b5b", "cute", 3),
  // Mayores, con canas, gafas y bigote (8)
  r("grayBun", "ffdbb4", "smile", 0, { accessories: "glasses" }), r("grayMedium", "edb98a", "calm", 2, { accessories: "glasses2" }),
  r("grayShort", "d08b5b", "smile", 5, { accessories: "glasses3" }), r("grayShort", "ffdbb4", "smileBig", 1, { facialHair: "moustache2" }),
  r("grayMedium", "ae5d29", "cute", 3), r("grayBun", "d08b5b", "calm", 4), r("grayShort", "edb98a", "smile", 2, { facialHair: "full2", accessories: "glasses" }),
  r("grayMedium", "ffdbb4", "smile", 5, { accessories: "glasses4" }),
  // Pelo de color (6): solo los peinados donde el color se nota
  r("bangs", "edb98a", "smile", 3, { hair: ROSA }), r("bangs", "ffdbb4", "cute", 0, { hair: ROJO }), r("mediumBangs2", "d08b5b", "smileBig", 2, { hair: ROSA }),
  r("bun", "ffdbb4", "smile", 4, { hair: CASTANO_CLARO }), r("short4", "ae5d29", "calm", 1, { hair: ROJO }), r("short4", "ffdbb4", "smile", 5, { hair: RUBIO }),
];

if (CURADOS.length !== TOTAL_AVATARES) {
  throw new Error(`Los avatares curados deben ser ${TOTAL_AVATARES}, hay ${CURADOS.length}`);
}

const cache = new Map<number, string>();

/** Opciones de DiceBear de un curado (sin red, sin aleatoriedad). */
export function opcionesDeCurado(i: number) {
  const c = CURADOS[i];
  return {
    seed: `curado-${i}`,
    head: [c.head],
    face: [c.face],
    skinColor: [c.skin],
    headContrastColor: [c.hair ?? (c.head.startsWith("gray") ? CANAS : NEGRO)],
    clothingColor: [ROPA[c.ropa]],
    backgroundColor: [FONDO[i % FONDO.length]],
    facialHair: c.facialHair ? [c.facialHair] : undefined,
    facialHairProbability: c.facialHair ? 100 : 0,
    accessories: c.accessories ? [c.accessories] : undefined,
    accessoriesProbability: c.accessories ? 100 : 0,
    maskProbability: 0,
  };
}

/** SVG del curado `i` como `data:` URI. Se calcula una vez y se reutiliza. */
export function uriDeCurado(i: number): string {
  const guardada = cache.get(i);
  if (guardada) return guardada;
  const uri = createAvatar(openPeeps, opcionesDeCurado(i) as never).toDataUri();
  cache.set(i, uri);
  return uri;
}

export const LICENCIA_AVATARES = openPeeps.meta.license;
