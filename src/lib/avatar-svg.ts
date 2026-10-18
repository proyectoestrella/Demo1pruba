/**
 * Avatares propios de Trimly.
 *
 * Cada retrato es un SVG plano y autosuficiente: formas rellenas, sin trazos
 * finos ni recursos externos. La receta compacta v2 se mantiene para que los
 * perfiles existentes continúen siendo válidos.
 */
export const COLOR_CAMISETA = "#2F8791";

/** De claro a oscuro; dorado y oliváceo no son tonos de transición ocultos. */
export const PIELES = [
  { id: "muy-clara", nombre: "Muy clara", color: "#FFE4C0" },
  { id: "clara", nombre: "Clara", color: "#F5D7B1" },
  { id: "miel", nombre: "Miel", color: "#EFCC9F" },
  { id: "dorado", nombre: "Dorado", color: "#E2BA87" },
  { id: "oliva", nombre: "Oliva", color: "#C99C62" },
  { id: "canela", nombre: "Canela", color: "#D08B5B" },
  { id: "morena", nombre: "Morena", color: "#AE5D29" },
  { id: "castana", nombre: "Castaña", color: "#8C5A2B" },
  { id: "oscura", nombre: "Oscura", color: "#694D3D" },
  { id: "profunda", nombre: "Profunda", color: "#4A2E20" },
] as const;

/** Las 16 siluetas que ofrece el editor. Ninguna lleva gorro, sombrero o pañuelo. */
export const PEINADOS = [
  { id: "rapado", nombre: "Rapado" },
  { id: "corto-con-raya", nombre: "Corto con raya" },
  { id: "corto-texturizado", nombre: "Texturizado" },
  { id: "fade-tupe", nombre: "Fade y tupé" },
  { id: "flat-top", nombre: "Flat top" },
  { id: "mohicano", nombre: "Mohicano" },
  { id: "bob", nombre: "Bob" },
  { id: "largo-liso", nombre: "Melena lisa" },
  { id: "ondulado-largo", nombre: "Ondas largas" },
  { id: "rizado-corto", nombre: "Rizado corto" },
  { id: "afro", nombre: "Afro" },
  { id: "trenzas", nombre: "Trenzas" },
  { id: "mono-alto", nombre: "Moño alto" },
  { id: "coleta-baja", nombre: "Coleta baja" },
  { id: "calvo-barba", nombre: "Calvo y barba" },
  { id: "flequillo-media-melena", nombre: "Flequillo" },
] as const;

export const EDADES = [
  { id: "joven", nombre: "Joven" },
  { id: "adulta", nombre: "Adulta" },
  { id: "mayor", nombre: "Mayor" },
] as const;

export const COLORES_PELO = [
  { id: "negro", nombre: "Negro", color: "#261B1A" },
  { id: "espresso", nombre: "Espresso", color: "#38241F" },
  { id: "castano-oscuro", nombre: "Castaño oscuro", color: "#51352B" },
  { id: "castano", nombre: "Castaño", color: "#714936" },
  { id: "avellana", nombre: "Avellana", color: "#8A6242" },
  { id: "rubio", nombre: "Rubio oscuro", color: "#A87B43" },
  { id: "rubio-ceniza", nombre: "Rubio ceniza", color: "#B7A17E" },
  { id: "pelirrojo", nombre: "Pelirrojo", color: "#96513C" },
  { id: "gris", nombre: "Canas", color: "#8E8B89" },
  { id: "blanco", nombre: "Blanco", color: "#E3E0DA" },
] as const;

/** El fondo sí cambia; la camiseta no. `ropa` se conserva por compatibilidad. */
export const FONDOS_AVATAR = [
  { id: "melocoton", nombre: "Melocotón", color: "#F2D8C6", ropa: COLOR_CAMISETA },
  { id: "salvia", nombre: "Salvia", color: "#D5E4D2", ropa: COLOR_CAMISETA },
  { id: "lavanda", nombre: "Lavanda", color: "#E3DAEE", ropa: COLOR_CAMISETA },
  { id: "azul", nombre: "Azul suave", color: "#D6E4EF", ropa: COLOR_CAMISETA },
  { id: "arena", nombre: "Arena", color: "#E9DFD1", ropa: COLOR_CAMISETA },
  { id: "rosa", nombre: "Rosa suave", color: "#F1D9C8", ropa: COLOR_CAMISETA },
] as const;

export type Piel = (typeof PIELES)[number]["id"];
export type Peinado = (typeof PEINADOS)[number]["id"];
export type EdadAvatar = (typeof EDADES)[number]["id"];
export type ColorPelo = (typeof COLORES_PELO)[number]["id"];
export type FondoAvatar = (typeof FONDOS_AVATAR)[number]["id"];

export interface AvatarComposicion {
  piel: Piel;
  peinado: Peinado;
  edad: EdadAvatar;
  colorPelo: ColorPelo;
  fondo: FondoAvatar;
}

interface AvatarLegado extends AvatarComposicion {
  id: string;
  nombre: string;
}

/** Las claves de v1 no cambian aunque su dibujo se haya renovado. */
export const AVATARES = [
  {
    id: "alma-coletas",
    nombre: "Alma, trenzas",
    piel: "miel",
    peinado: "trenzas",
    edad: "joven",
    colorPelo: "castano",
    fondo: "melocoton",
  },
  {
    id: "nico-rizos",
    nombre: "Nico, rizos",
    piel: "castana",
    peinado: "rizado-corto",
    edad: "joven",
    colorPelo: "negro",
    fondo: "salvia",
  },
  {
    id: "luna-flequillo",
    nombre: "Luna, flequillo",
    piel: "clara",
    peinado: "flequillo-media-melena",
    edad: "joven",
    colorPelo: "pelirrojo",
    fondo: "lavanda",
  },
  {
    id: "leo-corto",
    nombre: "Leo, pelo corto",
    piel: "miel",
    peinado: "corto-con-raya",
    edad: "joven",
    colorPelo: "castano",
    fondo: "azul",
  },
  {
    id: "vera-largo",
    nombre: "Vera, pelo largo",
    piel: "muy-clara",
    peinado: "largo-liso",
    edad: "adulta",
    colorPelo: "castano-oscuro",
    fondo: "rosa",
  },
  {
    id: "dani-corto",
    nombre: "Dani, pelo corto",
    piel: "canela",
    peinado: "corto-texturizado",
    edad: "adulta",
    colorPelo: "negro",
    fondo: "salvia",
  },
  {
    id: "ines-mono",
    nombre: "Inés, moño",
    piel: "clara",
    peinado: "mono-alto",
    edad: "adulta",
    colorPelo: "pelirrojo",
    fondo: "arena",
  },
  {
    id: "alex-rapado",
    nombre: "Alex, rapado",
    piel: "oscura",
    peinado: "rapado",
    edad: "adulta",
    colorPelo: "negro",
    fondo: "azul",
  },
  {
    id: "marina-ondas",
    nombre: "Marina, ondas",
    piel: "clara",
    peinado: "ondulado-largo",
    edad: "adulta",
    colorPelo: "castano",
    fondo: "lavanda",
  },
  {
    id: "sam-coleta",
    nombre: "Sam, coleta",
    piel: "canela",
    peinado: "coleta-baja",
    edad: "adulta",
    colorPelo: "castano-oscuro",
    fondo: "salvia",
  },
  {
    id: "cora-bob",
    nombre: "Cora, melena corta",
    piel: "miel",
    peinado: "bob",
    edad: "adulta",
    colorPelo: "pelirrojo",
    fondo: "melocoton",
  },
  {
    id: "rui-rizado",
    nombre: "Rui, afro",
    piel: "oscura",
    peinado: "afro",
    edad: "adulta",
    colorPelo: "negro",
    fondo: "arena",
  },
  {
    id: "elia-canas",
    nombre: "Elia, canas",
    piel: "muy-clara",
    peinado: "corto-con-raya",
    edad: "mayor",
    colorPelo: "gris",
    fondo: "azul",
  },
  {
    id: "tomas-canoso",
    nombre: "Tomás, canoso",
    piel: "miel",
    peinado: "calvo-barba",
    edad: "mayor",
    colorPelo: "gris",
    fondo: "salvia",
  },
  {
    id: "nora-mono-gris",
    nombre: "Nora, moño gris",
    piel: "castana",
    peinado: "mono-alto",
    edad: "mayor",
    colorPelo: "gris",
    fondo: "lavanda",
  },
  {
    id: "paz-plateado",
    nombre: "Paz, pelo plateado",
    piel: "clara",
    peinado: "largo-liso",
    edad: "mayor",
    colorPelo: "blanco",
    fondo: "melocoton",
  },
] as const satisfies readonly AvatarLegado[];

export type AvatarId = (typeof AVATARES)[number]["id"];
export type AvatarSerializado = `v2:${string}`;
export type AvatarClave = AvatarId | AvatarSerializado;
export const IDS_AVATAR = AVATARES.map((avatar) => avatar.id) as readonly AvatarId[];

export interface AvatarSugerido extends AvatarComposicion {
  id: string;
  nombre: string;
}

/** Puntos de partida; editar siempre conserva las cinco decisiones visibles. */
export const SUGERIDOS_AVATAR = [
  {
    id: "sol",
    nombre: "Corto claro",
    piel: "muy-clara",
    peinado: "corto-con-raya",
    edad: "joven",
    colorPelo: "rubio",
    fondo: "salvia",
  },
  {
    id: "luz",
    nombre: "Rizos",
    piel: "dorado",
    peinado: "rizado-corto",
    edad: "joven",
    colorPelo: "negro",
    fondo: "azul",
  },
  {
    id: "nora",
    nombre: "Ondas",
    piel: "oliva",
    peinado: "ondulado-largo",
    edad: "adulta",
    colorPelo: "castano",
    fondo: "rosa",
  },
  {
    id: "ari",
    nombre: "Afro",
    piel: "morena",
    peinado: "afro",
    edad: "adulta",
    colorPelo: "negro",
    fondo: "melocoton",
  },
  {
    id: "mar",
    nombre: "Canas",
    piel: "castana",
    peinado: "mono-alto",
    edad: "mayor",
    colorPelo: "gris",
    fondo: "lavanda",
  },
  {
    id: "dani",
    nombre: "Rapado",
    piel: "profunda",
    peinado: "rapado",
    edad: "adulta",
    colorPelo: "negro",
    fondo: "arena",
  },
] as const satisfies readonly AvatarSugerido[];

const porId = new Map<string, AvatarLegado>(AVATARES.map((avatar) => [avatar.id, avatar]));

function tieneId<T extends { id: string }>(
  coleccion: readonly T[],
  valor: unknown,
): valor is T["id"] {
  return typeof valor === "string" && coleccion.some((opcion) => opcion.id === valor);
}

export function composicionValida(valor: unknown): valor is AvatarComposicion {
  if (!valor || typeof valor !== "object") return false;
  const composicion = valor as Partial<AvatarComposicion>;
  return (
    tieneId(PIELES, composicion.piel) &&
    tieneId(PEINADOS, composicion.peinado) &&
    tieneId(EDADES, composicion.edad) &&
    tieneId(COLORES_PELO, composicion.colorPelo) &&
    tieneId(FONDOS_AVATAR, composicion.fondo)
  );
}

function indiceDe<T extends { id: string }>(coleccion: readonly T[], id: string): number {
  const indice = coleccion.findIndex((opcion) => opcion.id === id);
  if (indice < 0) throw new Error(`Opción de avatar desconocida: ${id}`);
  return indice;
}

/** Cinco índices base 36: piel, peinado, edad, color de pelo y fondo. */
export function serializarAvatar(composicion: AvatarComposicion): AvatarSerializado {
  if (!composicionValida(composicion)) throw new Error("Composición de avatar no válida");
  return `v2:${[
    indiceDe(PIELES, composicion.piel),
    indiceDe(PEINADOS, composicion.peinado),
    indiceDe(EDADES, composicion.edad),
    indiceDe(COLORES_PELO, composicion.colorPelo),
    indiceDe(FONDOS_AVATAR, composicion.fondo),
  ]
    .map((indice) => indice.toString(36))
    .join("")}`;
}

/** También admite las claves v2 ya guardadas: se vuelven a dibujar, sin fallar. */
export function deserializarAvatar(clave: unknown): AvatarComposicion | undefined {
  if (typeof clave !== "string") return undefined;
  const partes = /^v2:([0-9a-z])([0-9a-z])([0-9a-z])([0-9a-z])([0-9a-z])$/.exec(clave);
  if (!partes) return undefined;
  const [piel, peinado, edad, colorPelo, fondo] = partes
    .slice(1)
    .map((parte) => Number.parseInt(parte, 36));
  const composicion = {
    piel: PIELES[piel]?.id,
    peinado: PEINADOS[peinado]?.id,
    edad: EDADES[edad]?.id,
    colorPelo: COLORES_PELO[colorPelo]?.id,
    fondo: FONDOS_AVATAR[fondo]?.id,
  };
  return composicionValida(composicion) ? composicion : undefined;
}

export function composicionDeAvatar(clave: unknown): AvatarComposicion | undefined {
  const moderna = deserializarAvatar(clave);
  if (moderna) return moderna;
  if (typeof clave !== "string") return undefined;
  const legado = porId.get(clave);
  return legado
    ? {
        piel: legado.piel,
        peinado: legado.peinado,
        edad: legado.edad,
        colorPelo: legado.colorPelo,
        fondo: legado.fondo,
      }
    : undefined;
}

export function claveAvatarValida(clave: unknown): clave is AvatarClave {
  return composicionDeAvatar(clave) !== undefined;
}

export function avatarPorId(id: string): AvatarLegado | undefined {
  return porId.get(id);
}

export const GRUPOS_AVATAR = EDADES.map(({ id, nombre }) => ({
  titulo: nombre,
  avatares: AVATARES.filter((avatar) => avatar.edad === id),
})) as readonly { titulo: string; avatares: readonly AvatarLegado[] }[];

export function luminanciaWCAG(color: string): number {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error(`Color hexadecimal no válido: ${color}`);
  const canales = [0, 2, 4].map(
    (inicio) => Number.parseInt(hex.slice(inicio, inicio + 2), 16) / 255,
  );
  const lineal = canales.map((canal) =>
    canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * lineal[0]! + 0.7152 * lineal[1]! + 0.0722 * lineal[2]!;
}

/** Ratio WCAG, útil para impedir que los rasgos desaparezcan sobre una piel. */
export function contrasteWCAG(a: string, b: string): number {
  const [claro, oscuro] = [luminanciaWCAG(a), luminanciaWCAG(b)].sort((x, y) => y - x);
  return (claro! + 0.05) / (oscuro! + 0.05);
}

export interface RasgosAvatar {
  cejas: string;
  ojo: string;
  pupila?: string;
  nariz: string;
  boca: string;
}

/** Colores por tono: los dos últimos usan ojo claro y nunca un contorno oscuro. */
export const RASGOS_POR_PIEL: Record<Piel, RasgosAvatar> = {
  "muy-clara": { cejas: "#5A3A22", ojo: "#3F2616", nariz: "#D9A98A", boca: "#B2504E" },
  clara: { cejas: "#5A3A22", ojo: "#3F2616", nariz: "#D2A07C", boca: "#B2504E" },
  miel: { cejas: "#5A3A22", ojo: "#3F2616", nariz: "#C9966F", boca: "#A8434A" },
  dorado: { cejas: "#4A2B19", ojo: "#3A2012", nariz: "#B98558", boca: "#9A3A46" },
  oliva: { cejas: "#3A2214", ojo: "#2E190E", nariz: "#A67443", boca: "#8A323E" },
  canela: { cejas: "#3A2214", ojo: "#2E190E", nariz: "#B26E43", boca: "#7E2A33" },
  morena: { cejas: "#25150D", ojo: "#1F100A", nariz: "#8C4820", boca: "#3B1214" },
  castana: { cejas: "#21120C", ojo: "#1C0F09", nariz: "#70441F", boca: "#2E0F10" },
  oscura: {
    cejas: "#F5F0E8",
    ojo: "#F5F0E8",
    pupila: "#120A06",
    nariz: "#46301F",
    boca: "#F2A39A",
  },
  profunda: {
    cejas: "#F5F0E8",
    ojo: "#F5F0E8",
    pupila: "#120A06",
    nariz: "#7A5644",
    boca: "#F2A39A",
  },
};

function opcion<T extends { id: string }>(coleccion: readonly T[], id: string): T {
  const encontrada = coleccion.find((item) => item.id === id);
  if (!encontrada) throw new Error(`Opción de avatar desconocida: ${id}`);
  return encontrada;
}

const cierre = (d: string, color: string, opacity?: number) =>
  `<path d="${d}" fill="${color}"${opacity ? ` opacity="${opacity}"` : ""}/>`;
const ovalo = (cx: number, cy: number, rx: number, ry: number, color: string, opacity?: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}"${opacity ? ` opacity="${opacity}"` : ""}/>`;
const circulo = (cx: number, cy: number, r: number, color: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;

function peloDetras(peinado: Peinado, color: string): string {
  switch (peinado) {
    case "bob":
      return cierre(
        "M24 40C19 54 21 73 29 82h10l3-7 6 4 6-4 3 7h10c8-9 10-28 5-42-7 9-16 13-24 13S31 49 24 40Z",
        color,
      );
    case "largo-liso":
      return `${cierre(
        "M23 39C18 54 20 80 28 91h40c8-11 10-37 5-52-7 10-15 14-25 14S30 49 23 39Z",
        color,
      )}${trazo("M26 58c-1 10 0 20 3 28", mezclar(color, "#000000", 0.3), 1.8)}${trazo("M70 58c1 10 0 20-3 28", mezclar(color, "#000000", 0.3), 1.8)}`;
    case "ondulado-largo":
      return `${cierre(
        "M22 41c-6 13-3 27 2 36-3 6-1 11 4 14 3-3 6-3 9 0 3-3 6-3 9 0 3-3 6-3 9 0 3-3 6-3 9 0 5-3 7-8 4-14 5-9 8-23 2-36-8 9-17 13-26 13S30 50 22 41Z",
        color,
      )}${trazo("M25 56c3 4-3 8 0 12s-2 6 0 9", mezclar(color, "#000000", 0.3), 1.8)}${trazo("M71 56c-3 4 3 8 0 12s2 6 0 9", mezclar(color, "#000000", 0.3), 1.8)}`;
    case "trenzas": {
      const oscuro = mezclar(color, "#000000", 0.3);
      const claro = mezclar(color, "#FFFFFF", 0.12);
      // Cada trenza es una cinta continua con cruces desiguales: evita la
      // lectura de una columna de bolitas perfectamente regular.
      const izquierda = cierre(
        "M25 48c-4 6-4 12-1 17-4 4-3 9 0 13-3 4-2 8 1 11l7-2c-2-4-1-8 1-11-2-4-2-9 1-13-2-5 0-10 3-14Z",
        color,
      );
      const derecha = cierre(
        "M71 48c4 7 4 13 1 18 4 4 3 8 0 12 3 4 2 8-1 12l-7-2c2-4 1-8-1-11 2-4 2-9-1-13 2-5 0-10-3-14Z",
        color,
      );
      const cruces = [
        cierre("M21 60c3-3 6-3 9 0l-2 4c-3-2-5-2-8 0Z", claro),
        cierre("M20 73c3-3 7-3 9 1l-2 4c-3-2-5-2-8 0Z", oscuro),
        cierre("M21 85c3-3 6-3 8 0l-2 4c-2-2-5-2-7 0Z", claro),
        cierre("M66 61c3-3 6-3 9 0l-1 4c-3-2-6-2-8 0Z", oscuro),
        cierre("M67 74c2-3 6-3 9 0l-1 4c-3-2-5-2-8 0Z", claro),
        cierre("M67 86c3-3 6-3 8 0l-1 4c-2-2-5-2-7 0Z", oscuro),
      ].join("");
      return `${izquierda}${derecha}${cruces}`;
    }
    case "coleta-baja":
      return cierre("M65 47c13 4 15 20 4 29-6-1-10-8-10-16Z", color);
    case "flequillo-media-melena":
      return cierre(
        "M23 41c-4 14-1 33 6 41h11l2-8 6 4 6-4 2 8h11c7-8 10-27 6-41-8 9-16 12-25 12S31 50 23 41Z",
        color,
      );
    default:
      return "";
  }
}

function peloDelante(peinado: Peinado, color: string): string {
  const casquete = cierre("M27 42c1-16 9-25 21-25s20 9 21 25c-6-5-13-7-21-7s-15 2-21 7Z", color);
  switch (peinado) {
    case "rapado":
      return cierre("M30 35c3-11 10-17 18-17s15 6 18 17c-5-3-11-4-18-4s-13 1-18 4Z", color, 0.84);
    case "corto-con-raya":
      return `${casquete}${cierre("M28 39c8-9 17-13 31-10l10 8v7c-9-5-21-6-41 2Z", color)}${trazo("M41 19.5c0 7-2 12-8 17", mezclar(color, "#000000", 0.4), 1.8)}${trazo("M45 18c3 4 9 8 22 12", mezclar(color, "#000000", 0.25), 1.6)}`;
    case "corto-texturizado":
      return cierre("M27 42c0-12 7-24 21-24 12 0 19 8 21 23l-8-4-3 4-6-6-5 6-7-6-5 7Z", color);
    case "fade-tupe":
      return `${cierre("M27 38c2-10 7-16 13-18v18Z", color)}${cierre("M56 20c7 3 11 10 13 20l-8-3V24Z", color)}${cierre("M33 37c2-14 10-22 18-22 9 0 15 6 18 19-11-5-21-5-36 3Z", color)}`;
    case "flat-top":
      return cierre("M28 43V27l7-9h25l8 9v16c-11-5-28-5-40 0Z", color);
    case "mohicano":
      // La cresta acaba por encima de las cejas, incluso en miniatura.
      return cierre("M40 36V21l8-10 8 10v15c-4-2-12-2-16 0Z", color);
    case "bob":
      return `${casquete}${cierre("M28 40c9-8 24-9 40-2v8c-10-6-29-6-40 2Z", color)}`;
    case "largo-liso":
      return `${casquete}${cierre("M27 40c8-9 26-10 42-2v8c-10-6-31-7-42 2Z", color)}`;
    case "ondulado-largo":
      return `${casquete}${cierre("M26 42c6-10 14-14 22-14s16 4 22 14v4c-11-6-33-6-44 0Z", color)}${trazo("M44 22c-2 6-6 11-13 15", mezclar(color, "#000000", 0.3), 1.8)}`;
    case "rizado-corto": {
      const sombra = mezclar(color, "#000000", 0.3);
      const luz = mezclar(color, "#FFFFFF", 0.2);
      return [
        // Una sola masa de pelo con borde rizado, no discos independientes.
        cierre(
          "M27 46c-2-4-1-9 2-12-1-5 2-9 7-10 2-5 8-6 12-3 4-3 10-1 12 3 5-1 10 3 10 8 4 4 2 9 0 13-5-6-13-9-21-9s-16 3-21 9Z",
          color,
        ),
        cierre("M28 43c5-5 12-7 20-7s15 2 20 7v4c-11-5-29-5-40 0Z", sombra),
        trazo("M32 34c2-3 5-3 7 0M42 27c2-3 5-3 7 0M53 28c2-3 5-3 7 0M61 35c2-3 4-2 5 1", luz, 1.5),
        trazo("M35 39c2-2 4-2 6 0M47 34c2-2 5-2 7 0M57 39c2-2 4-2 6 0", sombra, 1.6),
      ].join("");
    }
    case "afro": {
      const sombra = mezclar(color, "#000000", 0.3);
      const luz = mezclar(color, "#FFFFFF", 0.2);
      return [
        // Volumen continuo, con apenas unos rizos sugeridos dentro de la masa.
        cierre(
          "M25 47c-3-4-3-10 0-14-2-5 2-10 7-11 1-6 7-10 13-7 5-5 12-2 14 3 6-1 12 4 12 10 4 5 3 11 0 16-5-6-13-9-22-9s-17 3-22 9Z",
          color,
        ),
        cierre("M27 42c4-8 12-11 21-11s17 3 21 11v5c-11-5-31-5-42 0Z", sombra),
        trazo("M31 30c2-4 6-4 8 0M41 20c3-4 7-4 9 0M53 20c3-4 7-3 9 1M62 30c2-3 5-3 7 0", luz, 1.6),
        trazo("M31 38c2-3 5-3 7 0M43 30c2-3 6-3 8 0M56 31c2-3 5-3 7 0", sombra, 1.7),
      ].join("");
    }
    case "trenzas":
      return `${casquete}${cierre("M27 40c8-8 25-9 42-2v8c-11-6-29-6-42 2Z", color)}`;
    case "mono-alto":
      return `${circulo(58, 16, 11, color)}${casquete}${cierre("M27 40c8-8 25-9 42-2v8c-11-6-29-6-42 2Z", color)}`;
    case "coleta-baja":
      return `${casquete}${cierre("M28 40c8-8 25-9 41-2v8c-10-6-29-6-41 2Z", color)}`;
    case "calvo-barba":
      return "";
    case "flequillo-media-melena":
      return `${casquete}${cierre("M27 42c0-11 8-18 21-18s21 7 21 18c-14-4-28-4-42 0Z", color)}${trazo("M36 27c-2 5-4 9-7 12M48 25v13M60 27c2 5 4 9 7 12", mezclar(color, "#000000", 0.3), 1.8)}`;
  }
}

function barba(peinado: Peinado, color: string): string {
  return peinado === "calvo-barba"
    ? cierre("M33 57c2 12 7 18 15 18s13-6 15-18c-5 2-10 3-15 3s-10-1-15-3Z", color)
    : "";
}

function mezclar(color: string, con: string, t: number): string {
  const c = (hex: string, i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(c(color, i) * (1 - t) + c(con, i) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Línea curva sin relleno, siempre redondeada y con grosor mínimo de 1,5. */
const trazo = (d: string, color: string, ancho: number, opacity?: number) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${Math.max(ancho, 1.5)}" stroke-linecap="round" stroke-linejoin="round"${opacity ? ` opacity="${opacity}"` : ""}/>`;

function rasgos(piel: Piel, simple: boolean, colorPelo: string): string {
  const r = RASGOS_POR_PIEL[piel];
  const claro = Boolean(r.pupila);
  const brillo = "#FFFFFF";
  const tintaOjo = claro ? r.pupila! : r.ojo;
  const cejas = `${trazo("M34.8 42.5q4-1.8 7.8-.1", colorPelo, 1.5)}${trazo(
    "M53.4 42.4q3.8-1.7 7.8.1",
    colorPelo,
    1.5,
  )}`;
  if (simple) {
    // A 24/28 px, puntos con un brillo se leen como ojos; los óvalos grandes
    // formaban el aspecto de gafas, sobre todo en pieles profundas.
    const ojos = `${circulo(38.5, 49, 3, tintaOjo)}${circulo(57.5, 49, 3, tintaOjo)}${circulo(39.35, 48.15, 0.82, brillo)}${circulo(58.35, 48.15, 0.82, brillo)}`;
    return `${cejas}${ojos}${trazo("M38.5 61.2q9.5 8.5 19 0", r.boca, 3.8)}`;
  }
  // En tonos profundos no hay un aro de esclerótica claro alrededor de la
  // pupila: solo tinta y un brillo independiente, para que no parezca gafa.
  const ojos = claro
    ? `${ovalo(39, 49, 3.8, 2.9, tintaOjo)}${ovalo(57, 49, 3.8, 2.9, tintaOjo)}${circulo(40.2, 48.1, 1.15, brillo)}${circulo(58.2, 48.1, 1.15, brillo)}`
    : `${circulo(39, 49, 3.5, r.ojo)}${circulo(57, 49, 3.5, r.ojo)}${circulo(40.2, 47.8, 1.1, brillo)}${circulo(58.2, 47.8, 1.1, brillo)}`;
  const nariz = trazo("M45.5 55c-1.5 3-1 5.5 2 6 2 .3 3.3-.6 3.6-1.6", r.nariz, 1.9);
  const boca = trazo("M41 64.5q7 6 14 0", r.boca, claro ? 2.6 : 2.3);
  return `${cejas}${ojos}${nariz}${boca}`;
}

function detalleMayor(edad: EdadAvatar, piel: Piel, simple: boolean): string {
  if (edad !== "mayor" || simple) return "";
  const base = opcion(PIELES, piel).color;
  const color = RASGOS_POR_PIEL[piel].pupila ? mezclar(base, "#FFFFFF", 0.22) : mezclar(base, "#3A1F10", 0.3);
  return [
    trazo("M33.5 47c-2 1.800-2.200 4-1.400 5.600", color, 1.5),
    trazo("M62.5 47c2 1.800 2.200 4 1.400 5.600", color, 1.5),
    trazo("M40 57c-2.500 3-2.500 6-1 8", color, 1.5),
    trazo("M56 57c2.500 3 2.500 6 1 8", color, 1.5),
  ].join("");
}

/** SVG original y plano para una composición ya validada. */
export function svgDeComposicion(
  composicion: AvatarComposicion,
  opciones: { simple?: boolean } = {},
): string {
  const simple = opciones.simple === true;
  if (!composicionValida(composicion)) throw new Error("Composición de avatar no válida");
  const piel = opcion(PIELES, composicion.piel);
  const pelo = opcion(COLORES_PELO, composicion.colorPelo);
  const fondo = opcion(FONDOS_AVATAR, composicion.fondo);
  const cabeza = simple
    ? `<ellipse cx="48" cy="46.5" rx="22" ry="25" fill="${piel.color}"/><ellipse cx="26" cy="48" rx="3.5" ry="5" fill="${piel.color}"/><ellipse cx="70" cy="48" rx="3.5" ry="5" fill="${piel.color}"/>`
    : `<ellipse cx="48" cy="47" rx="20" ry="24" fill="${piel.color}"/><ellipse cx="28" cy="48" rx="3.5" ry="5" fill="${piel.color}"/><ellipse cx="68" cy="48" rx="3.5" ry="5" fill="${piel.color}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img"><circle cx="48" cy="48" r="48" fill="${fondo.color}"/><path d="M0 96c2-19 18-30 48-30s46 11 48 30Z" fill="${COLOR_CAMISETA}"/><path d="M35 68h26v12c-4 6-9 8-13 8s-9-2-13-8Z" fill="${piel.color}"/>${peloDetras(composicion.peinado, pelo.color)}${cabeza}${peloDelante(composicion.peinado, pelo.color)}${rasgos(composicion.piel, simple, pelo.color)}${barba(composicion.peinado, pelo.color)}${detalleMayor(composicion.edad, composicion.piel, simple)}</svg>`;
}

const cache = new Map<string, string>();

/** SVG propio como data URI; se memoriza para listas largas. */
export function uriDeAvatar(clave: AvatarClave | string, px?: number): string {
  const simple = px !== undefined && px <= 28;
  const llave = simple ? `s:${clave}` : clave;
  const guardada = cache.get(llave);
  if (guardada) return guardada;
  const composicion = composicionDeAvatar(clave);
  if (!composicion) throw new Error(`Avatar desconocido: ${clave}`);
  const uri = `data:image/svg+xml,${encodeURIComponent(svgDeComposicion(composicion, { simple }))}`;
  cache.set(llave, uri);
  return uri;
}
