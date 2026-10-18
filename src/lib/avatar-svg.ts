/**
 * Avatares propios de Trimly.
 *
 * No son imágenes ni una colección externa: cada retrato se compone con cinco
 * decisiones pequeñas y se dibuja como SVG plano. El formato `v2:01234` vive
 * en el mismo campo que usaba v1, para que siga siendo cómodo de guardar.
 */
export const PIELES = [
  { id: "muy-clara", nombre: "Muy clara", color: "#F5D5C0" },
  { id: "clara", nombre: "Clara", color: "#E8BFA4" },
  { id: "miel", nombre: "Miel", color: "#CD936D" },
  { id: "canela", nombre: "Canela", color: "#A96E4D" },
  { id: "castana", nombre: "Castaña", color: "#754B39" },
  { id: "oscura", nombre: "Oscura", color: "#4E332B" },
] as const;

export const PEINADOS = [
  { id: "corto", nombre: "Corto" },
  { id: "largo-liso", nombre: "Largo liso" },
  { id: "ondas", nombre: "Ondulado" },
  { id: "rizos", nombre: "Rizado" },
  { id: "afro", nombre: "Afro" },
  { id: "mono", nombre: "Moño" },
  { id: "coleta", nombre: "Coleta" },
  { id: "coletas", nombre: "Coletas" },
  { id: "rapado", nombre: "Rapado" },
  { id: "flequillo", nombre: "Flequillo" },
  { id: "bob", nombre: "Melena corta" },
  { id: "trenzas", nombre: "Trenzas" },
  { id: "barba", nombre: "Barba corta" },
  { id: "bigote", nombre: "Bigote" },
] as const;

export const EDADES = [
  { id: "joven", nombre: "Joven" },
  { id: "adulta", nombre: "Adulta" },
  { id: "mayor", nombre: "Mayor" },
] as const;

export const COLORES_PELO = [
  { id: "negro", nombre: "Negro", color: "#2F2928" },
  { id: "castano-oscuro", nombre: "Castaño oscuro", color: "#4A342E" },
  { id: "castano", nombre: "Castaño", color: "#714A37" },
  { id: "rubio", nombre: "Rubio oscuro", color: "#A77A43" },
  { id: "pelirrojo", nombre: "Pelirrojo", color: "#9D563D" },
  { id: "gris", nombre: "Gris", color: "#8D8A87" },
  { id: "blanco", nombre: "Blanco", color: "#D9D6D1" },
] as const;

export const FONDOS_AVATAR = [
  { id: "melocoton", nombre: "Melocotón", color: "#F2D8C6", ropa: "#8A6446" },
  { id: "salvia", nombre: "Salvia", color: "#D5E4D2", ropa: "#4F6F58" },
  { id: "lavanda", nombre: "Lavanda", color: "#E3DAEE", ropa: "#76638A" },
  { id: "azul", nombre: "Azul suave", color: "#D6E4EF", ropa: "#57748A" },
  { id: "arena", nombre: "Arena", color: "#E9DFD1", ropa: "#7A5539" },
  { id: "rosa", nombre: "Rosa suave", color: "#F1D9C8", ropa: "#925F55" },
] as const;

export type Piel = (typeof PIELES)[number]["id"];
export type Peinado = (typeof PEINADOS)[number]["id"];
export type EdadAvatar = (typeof EDADES)[number]["id"];
export type ColorPelo = (typeof COLORES_PELO)[number]["id"];
export type FondoAvatar = (typeof FONDOS_AVATAR)[number]["id"];

/** Las cinco piezas que forman un avatar. No se guarda ropa ni rasgos ocultos. */
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

/**
 * Las claves que ya se guardaron con la versión 1. Se mantienen completas y
 * se traducen a la receta equivalente, aunque el selector nuevo no las cree.
 */
export const AVATARES = [
  {
    id: "alma-coletas",
    nombre: "Alma, coletas",
    piel: "miel",
    peinado: "coletas",
    edad: "joven",
    colorPelo: "castano",
    fondo: "melocoton",
  },
  {
    id: "nico-rizos",
    nombre: "Nico, rizos",
    piel: "castana",
    peinado: "rizos",
    edad: "joven",
    colorPelo: "negro",
    fondo: "salvia",
  },
  {
    id: "luna-flequillo",
    nombre: "Luna, flequillo",
    piel: "clara",
    peinado: "flequillo",
    edad: "joven",
    colorPelo: "pelirrojo",
    fondo: "lavanda",
  },
  {
    id: "leo-corto",
    nombre: "Leo, pelo corto",
    piel: "miel",
    peinado: "corto",
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
    peinado: "corto",
    edad: "adulta",
    colorPelo: "negro",
    fondo: "salvia",
  },
  {
    id: "ines-mono",
    nombre: "Inés, moño",
    piel: "clara",
    peinado: "mono",
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
    peinado: "ondas",
    edad: "adulta",
    colorPelo: "castano",
    fondo: "lavanda",
  },
  {
    id: "sam-coleta",
    nombre: "Sam, coleta",
    piel: "canela",
    peinado: "coleta",
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
    nombre: "Rui, rizado",
    piel: "oscura",
    peinado: "afro",
    edad: "adulta",
    colorPelo: "negro",
    fondo: "arena",
  },
  {
    id: "elia-canas",
    nombre: "Elia, canas y gafas",
    piel: "muy-clara",
    peinado: "corto",
    edad: "mayor",
    colorPelo: "gris",
    fondo: "azul",
  },
  {
    id: "tomas-canoso",
    nombre: "Tomás, canoso",
    piel: "miel",
    peinado: "bigote",
    edad: "mayor",
    colorPelo: "gris",
    fondo: "salvia",
  },
  {
    id: "nora-mono-gris",
    nombre: "Nora, moño gris",
    piel: "castana",
    peinado: "mono",
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

/** Doce combinaciones listas para usar, no una limitación de la composición. */
export const SUGERIDOS_AVATAR = [
  {
    id: "sol",
    nombre: "Pelo corto",
    piel: "muy-clara",
    peinado: "corto",
    edad: "joven",
    colorPelo: "rubio",
    fondo: "salvia",
  },
  {
    id: "nora",
    nombre: "Ondas",
    piel: "clara",
    peinado: "ondas",
    edad: "adulta",
    colorPelo: "castano",
    fondo: "rosa",
  },
  {
    id: "luz",
    nombre: "Rizos",
    piel: "miel",
    peinado: "rizos",
    edad: "joven",
    colorPelo: "negro",
    fondo: "azul",
  },
  {
    id: "ari",
    nombre: "Afro",
    piel: "canela",
    peinado: "afro",
    edad: "adulta",
    colorPelo: "negro",
    fondo: "melocoton",
  },
  {
    id: "mar",
    nombre: "Moño",
    piel: "castana",
    peinado: "mono",
    edad: "mayor",
    colorPelo: "gris",
    fondo: "lavanda",
  },
  {
    id: "dani",
    nombre: "Rapado",
    piel: "oscura",
    peinado: "rapado",
    edad: "adulta",
    colorPelo: "negro",
    fondo: "arena",
  },
  {
    id: "alma",
    nombre: "Coletas",
    piel: "miel",
    peinado: "coletas",
    edad: "joven",
    colorPelo: "pelirrojo",
    fondo: "salvia",
  },
  {
    id: "leo",
    nombre: "Bigote suave",
    piel: "canela",
    peinado: "bigote",
    edad: "mayor",
    colorPelo: "gris",
    fondo: "azul",
  },
  {
    id: "vera",
    nombre: "Largo liso",
    piel: "muy-clara",
    peinado: "largo-liso",
    edad: "adulta",
    colorPelo: "castano-oscuro",
    fondo: "melocoton",
  },
  {
    id: "sam",
    nombre: "Coleta",
    piel: "oscura",
    peinado: "coleta",
    edad: "joven",
    colorPelo: "negro",
    fondo: "lavanda",
  },
  {
    id: "cora",
    nombre: "Melena corta",
    piel: "clara",
    peinado: "bob",
    edad: "adulta",
    colorPelo: "pelirrojo",
    fondo: "arena",
  },
  {
    id: "rui",
    nombre: "Trenzas",
    piel: "castana",
    peinado: "trenzas",
    edad: "mayor",
    colorPelo: "blanco",
    fondo: "rosa",
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

/** Cinco índices base 36, siempre en el mismo orden: piel, pelo, edad, color, fondo. */
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

export function deserializarAvatar(clave: unknown): AvatarComposicion | undefined {
  if (typeof clave !== "string") return undefined;
  const partes = /^v2:([0-9a-z])([0-9a-z])([0-9a-z])([0-9a-z])([0-9a-z])$/.exec(clave);
  if (!partes) return undefined;
  const indices = partes.slice(1).map((parte) => Number.parseInt(parte, 36));
  const [piel, peinado, edad, colorPelo, fondo] = indices;
  const composicion = {
    piel: PIELES[piel]?.id,
    peinado: PEINADOS[peinado]?.id,
    edad: EDADES[edad]?.id,
    colorPelo: COLORES_PELO[colorPelo]?.id,
    fondo: FONDOS_AVATAR[fondo]?.id,
  };
  return composicionValida(composicion) ? composicion : undefined;
}

/** Una clave actual, una clave de v1 o nada si no hay nada que se pueda pintar. */
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

/** Tres grupos conservados para quien aún consuma el catálogo de v1. */
export const GRUPOS_AVATAR = EDADES.map(({ id, nombre }) => ({
  titulo: nombre,
  avatares: AVATARES.filter((avatar) => avatar.edad === id),
})) as readonly { titulo: string; avatares: readonly AvatarLegado[] }[];

const TINTA = "#3B2F2A";
const ARRUGA = "#8E6251";

function opcion<T extends { id: string }>(coleccion: readonly T[], id: string): T {
  const encontrada = coleccion.find((item) => item.id === id);
  if (!encontrada) throw new Error(`Opción de avatar desconocida: ${id}`);
  return encontrada;
}

function peloDetras(peinado: Peinado, color: string): string {
  switch (peinado) {
    case "largo-liso":
      return `<path d="M25 47c-3 11-2 31 3 40h40c5-11 6-29 3-40-6 7-13 10-23 10s-17-3-23-10Z" fill="${color}"/>`;
    case "ondas":
      return `<path d="M24 47c-4 13-2 31 4 40h10l5-7 5 7 5-7 6 7h9c5-10 7-28 3-40-7 8-13 10-22 10s-15-2-25-10Z" fill="${color}"/>`;
    case "bob":
      return `<path d="M24 43v31l7 8 7-5 10 5 10-5 7 5 7-8V43c-6 8-14 11-24 11s-18-3-24-11Z" fill="${color}"/>`;
    case "coleta":
      return `<path d="M65 35c15 3 15 23 1 29-4-6-6-13-5-20Z" fill="${color}"/>`;
    case "coletas":
      return `<path d="M28 37c-13-1-16 16-4 22 4-5 6-11 6-17Zm40 0c13-1 16 16 4 22-4-5-6-11-6-17Z" fill="${color}"/>`;
    case "trenzas":
      return `<path d="M29 49c-7 13-5 26 1 37m37-37c7 13 5 26-1 37" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="3 4"/>`;
    default:
      return "";
  }
}

function peloDelante(peinado: Peinado, color: string): string {
  const cap = `<path d="M28 43c0-16 9-25 20-25s20 9 20 25c-6-5-12-7-20-7s-14 2-20 7Z" fill="${color}"/>`;
  switch (peinado) {
    case "corto":
      return `${cap}<path d="M29 37c7-8 19-10 37-2v7c-8-4-19-5-37 2Z" fill="${color}"/>`;
    case "largo-liso":
      return `${cap}<path d="M29 38c8-8 22-9 38-2v8c-7-5-12-7-19-7s-12 2-19 7Z" fill="${color}"/>`;
    case "ondas":
      return `${cap}<path d="M28 40c5-6 10 3 15-2s10 4 15-1 7 1 10 3v7c-8-6-13-7-20-7s-13 2-20 7Z" fill="${color}"/>`;
    case "rizos":
      return `<g fill="${color}"><circle cx="31" cy="32" r="8"/><circle cx="39" cy="25" r="9"/><circle cx="49" cy="24" r="10"/><circle cx="59" cy="27" r="9"/><circle cx="66" cy="35" r="7"/><path d="M30 43c5-6 11-8 18-8s13 2 18 8v5H30Z"/></g>`;
    case "afro":
      return `<g fill="${color}"><circle cx="28" cy="35" r="9"/><circle cx="32" cy="25" r="10"/><circle cx="41" cy="20" r="11"/><circle cx="52" cy="20" r="11"/><circle cx="62" cy="25" r="10"/><circle cx="68" cy="35" r="9"/><path d="M29 42c5-6 11-8 19-8s14 2 19 8v7H29Z"/></g>`;
    case "mono":
      return `<circle cx="63" cy="19" r="10" fill="${color}"/>${cap}<path d="M29 40c7-6 20-8 38-1v7c-9-6-29-6-38 1Z" fill="${color}"/>`;
    case "coleta":
      return `${cap}<path d="M29 39c8-7 20-8 38-1v8c-9-6-29-6-38 1Z" fill="${color}"/>`;
    case "coletas":
      return `${cap}<path d="M29 39c7-7 21-8 38-1v8c-10-6-28-6-38 1Z" fill="${color}"/>`;
    case "rapado":
      return `<path d="M31 35c3-12 10-17 17-17s14 5 17 17c-6-3-11-4-17-4s-11 1-17 4Z" fill="${color}" opacity=".88"/>`;
    case "flequillo":
      return `${cap}<path d="M29 38c5-9 12-12 20-12 7 0 13 3 18 11l-7 8-5-7-7 7-7-7-6 7Z" fill="${color}"/>`;
    case "bob":
      return `${cap}<path d="M29 39c9-8 22-8 38-1v8c-9-6-29-6-38 1Z" fill="${color}"/>`;
    case "trenzas":
      return `${cap}<path d="M29 39c8-7 21-8 38-1v7c-9-5-29-5-38 1Z" fill="${color}"/>`;
    case "barba":
    case "bigote":
      return cap;
  }
}

function velloFacial(peinado: Peinado, color: string): string {
  if (peinado === "barba") {
    return `<path d="M34 56c3 11 7 15 14 15s11-4 14-15c-4 2-9 3-14 3s-10-1-14-3Z" fill="${color}" opacity=".94"/>`;
  }
  if (peinado === "bigote") {
    return `<path d="M47 55c-5-5-11-4-13-1 4 6 10 6 14 2 4 4 10 4 14-2-2-3-8-4-13 1h-2Z" fill="${color}"/>`;
  }
  return "";
}

function rasgosDeMayor(edad: EdadAvatar, colorPelo: string): string {
  if (edad !== "mayor") return "";
  return `<g fill="none" stroke="${ARRUGA}" stroke-width="1.1" stroke-linecap="round" opacity=".52"><path d="M31 51h5m29 0h-5"/><path d="M35 63c4 2 18 2 26 0"/></g><g fill="none" stroke="${TINTA}" stroke-width="1.25" opacity=".72"><rect x="28" y="43" width="15" height="10" rx="5"/><rect x="53" y="43" width="15" height="10" rx="5"/><path d="M43 48h10"/></g><path d="M37 25c4-3 18-3 22 0" fill="none" stroke="${colorPelo}" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>`;
}

/** SVG original y plano para una composición ya validada. */
export function svgDeComposicion(composicion: AvatarComposicion): string {
  if (!composicionValida(composicion)) throw new Error("Composición de avatar no válida");
  const piel = opcion(PIELES, composicion.piel);
  const pelo = opcion(COLORES_PELO, composicion.colorPelo);
  const fondo = opcion(FONDOS_AVATAR, composicion.fondo);
  const mayor = rasgosDeMayor(composicion.edad, pelo.color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="48" fill="${fondo.color}"/><path d="M7 96c2-18 16-29 41-29s39 11 41 29Z" fill="${fondo.ropa}"/><path d="M35 69h26v10c-4 6-9 8-13 8s-9-2-13-8Z" fill="${piel.color}"/>${peloDetras(composicion.peinado, pelo.color)}<ellipse cx="48" cy="47" rx="19" ry="23" fill="${piel.color}"/><ellipse cx="29" cy="48" rx="3" ry="5" fill="${piel.color}"/><ellipse cx="67" cy="48" rx="3" ry="5" fill="${piel.color}"/>${peloDelante(composicion.peinado, pelo.color)}<path d="M36 43c2-1 4-1 6 0m12 0c2-1 4-1 6 0" fill="none" stroke="${TINTA}" stroke-width="1.7" stroke-linecap="round"/><circle cx="39" cy="48" r="1.45" fill="${TINTA}"/><circle cx="57" cy="48" r="1.45" fill="${TINTA}"/><path d="M48 49v5l2 1" fill="none" stroke="${TINTA}" stroke-width="1.25" stroke-linecap="round"/><path d="M42 60c3 2 9 2 12 0" fill="none" stroke="${TINTA}" stroke-width="1.7" stroke-linecap="round"/>${velloFacial(composicion.peinado, pelo.color)}${mayor}</svg>`;
}

const cache = new Map<string, string>();

/** SVG propio como data URI; se memoriza para listas largas. */
export function uriDeAvatar(clave: AvatarClave | string): string {
  const guardada = cache.get(clave);
  if (guardada) return guardada;
  const composicion = composicionDeAvatar(clave);
  if (!composicion) throw new Error(`Avatar desconocido: ${clave}`);
  const uri = `data:image/svg+xml,${encodeURIComponent(svgDeComposicion(composicion))}`;
  cache.set(clave, uri);
  return uri;
}
