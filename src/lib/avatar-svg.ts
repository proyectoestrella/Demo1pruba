/**
 * La familia de avatares propia de Trimly: SVG redondeados, cara amarillo
 * emoji constante y peinados distinguibles incluso a 24 px.
 */
export type GrupoAvatar = "Primeros años" | "Adultas" | "Maduras" | "Mayores";

export interface AvatarPropio {
  id: string;
  nombre: string;
  grupo: GrupoAvatar;
  pelo: Pelo;
  colorPelo: string;
  fondo: string;
  ropa: string;
  gafas?: boolean;
  arrugas?: boolean;
}

type Pelo =
  | "coletas"
  | "rizos"
  | "flequillo"
  | "corto"
  | "largo"
  | "mono"
  | "rapado"
  | "ondas"
  | "coleta"
  | "bob"
  | "canas-corto"
  | "canas-mono"
  | "plateado";

export const AVATARES: readonly AvatarPropio[] = [
  {
    id: "alma-coletas",
    nombre: "Alma, coletas",
    grupo: "Primeros años",
    pelo: "coletas",
    colorPelo: "#704738",
    fondo: "#F2D8C6",
    ropa: "#9D6E57",
  },
  {
    id: "nico-rizos",
    nombre: "Nico, rizos",
    grupo: "Primeros años",
    pelo: "rizos",
    colorPelo: "#4E382E",
    fondo: "#D5E4D2",
    ropa: "#5B7B62",
  },
  {
    id: "luna-flequillo",
    nombre: "Luna, flequillo",
    grupo: "Primeros años",
    pelo: "flequillo",
    colorPelo: "#B36A42",
    fondo: "#E3DAEE",
    ropa: "#76668B",
  },
  {
    id: "leo-corto",
    nombre: "Leo, pelo corto",
    grupo: "Primeros años",
    pelo: "corto",
    colorPelo: "#6A4A33",
    fondo: "#D6E4EF",
    ropa: "#57748A",
  },
  {
    id: "vera-largo",
    nombre: "Vera, pelo largo",
    grupo: "Adultas",
    pelo: "largo",
    colorPelo: "#5D3D32",
    fondo: "#F1D9C8",
    ropa: "#9A5F51",
  },
  {
    id: "dani-corto",
    nombre: "Dani, pelo corto",
    grupo: "Adultas",
    pelo: "corto",
    colorPelo: "#3F3632",
    fondo: "#DCE7DA",
    ropa: "#4F6F58",
  },
  {
    id: "ines-mono",
    nombre: "Inés, moño",
    grupo: "Adultas",
    pelo: "mono",
    colorPelo: "#A45B3E",
    fondo: "#E9DFD1",
    ropa: "#8A6446",
  },
  {
    id: "alex-rapado",
    nombre: "Alex, rapado",
    grupo: "Adultas",
    pelo: "rapado",
    colorPelo: "#59433A",
    fondo: "#D6E4EF",
    ropa: "#5E7181",
  },
  {
    id: "marina-ondas",
    nombre: "Marina, ondas",
    grupo: "Maduras",
    pelo: "ondas",
    colorPelo: "#704938",
    fondo: "#E3DAEE",
    ropa: "#76628A",
    arrugas: true,
  },
  {
    id: "sam-coleta",
    nombre: "Sam, coleta",
    grupo: "Maduras",
    pelo: "coleta",
    colorPelo: "#4E3A32",
    fondo: "#D5E4D2",
    ropa: "#5A7660",
    arrugas: true,
  },
  {
    id: "cora-bob",
    nombre: "Cora, melena corta",
    grupo: "Maduras",
    pelo: "bob",
    colorPelo: "#B06A42",
    fondo: "#F2D8C6",
    ropa: "#9B6650",
    arrugas: true,
  },
  {
    id: "rui-rizado",
    nombre: "Rui, rizado",
    grupo: "Maduras",
    pelo: "rizos",
    colorPelo: "#453631",
    fondo: "#E9DFD1",
    ropa: "#706051",
    gafas: true,
    arrugas: true,
  },
  {
    id: "elia-canas",
    nombre: "Elia, canas y gafas",
    grupo: "Mayores",
    pelo: "canas-corto",
    colorPelo: "#B8B4AA",
    fondo: "#D6E4EF",
    ropa: "#587286",
    gafas: true,
    arrugas: true,
  },
  {
    id: "tomas-canoso",
    nombre: "Tomás, canoso",
    grupo: "Mayores",
    pelo: "canas-corto",
    colorPelo: "#9B9A94",
    fondo: "#DCE7DA",
    ropa: "#55725C",
    gafas: true,
    arrugas: true,
  },
  {
    id: "nora-mono-gris",
    nombre: "Nora, moño gris",
    grupo: "Mayores",
    pelo: "canas-mono",
    colorPelo: "#B7B0AB",
    fondo: "#E3DAEE",
    ropa: "#766387",
    gafas: true,
    arrugas: true,
  },
  {
    id: "paz-plateado",
    nombre: "Paz, pelo plateado",
    grupo: "Mayores",
    pelo: "plateado",
    colorPelo: "#C4C0BC",
    fondo: "#F2D8C6",
    ropa: "#956653",
    gafas: true,
    arrugas: true,
  },
] as const;

export type AvatarId = (typeof AVATARES)[number]["id"];
export const IDS_AVATAR = AVATARES.map((avatar) => avatar.id) as readonly AvatarId[];

const TRAZO = "#5E4F48";
const PIEL_EMOJI = "#F8D665";

function peloSvg(tipo: Pelo, color: string): string {
  const base = `fill="${color}" stroke="${TRAZO}" stroke-width="2" stroke-linejoin="round"`;
  switch (tipo) {
    case "coletas":
      return `<circle cx="17" cy="30" r="8" ${base}/><circle cx="63" cy="30" r="8" ${base}/><path d="M22 38V27C22 14 58 14 58 27v11" ${base}/>`;
    case "rizos":
      return `<path d="M19 38c-8-14 0-27 10-22 4-9 15-6 17-1 10-6 18 8 14 22" ${base}/><circle cx="23" cy="24" r="6" ${base}/><circle cx="34" cy="18" r="6" ${base}/><circle cx="47" cy="19" r="6" ${base}/><circle cx="57" cy="27" r="6" ${base}/>`;
    case "flequillo":
      return `<path d="M20 39V27c2-17 38-18 40 0v13l-7-9-6 6-7-7-7 7-6-6z" ${base}/>`;
    case "corto":
      return `<path d="M21 37V27c3-17 35-17 38 0v10l-8-8c-10 5-19 3-30 8z" ${base}/>`;
    case "largo":
      return `<path d="M18 57V28c2-19 42-19 44 0v29l-9-9V31c-10 5-18 5-26 0v17z" ${base}/>`;
    case "mono":
      return `<circle cx="51" cy="14" r="9" ${base}/><path d="M21 41V27c2-17 36-18 39 0v14l-8-10c-9 5-20 5-31 10z" ${base}/>`;
    case "rapado":
      return `<path d="M23 30c2-16 32-16 35 0" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
    case "ondas":
      return `<path d="M18 57V29c1-17 42-18 44 0v28l-8-7-5 6-6-6-7 6-7-6-5 7z" ${base}/><path d="M24 29c5 5 9-5 14 0s9-5 14 0" fill="none" stroke="${TRAZO}" stroke-width="2" stroke-linecap="round"/>`;
    case "coleta":
      return `<path d="M58 29c13-4 13 12 3 14" ${base}/><path d="M21 42V27c2-17 36-17 39 0v15l-8-11c-10 5-20 5-31 11z" ${base}/>`;
    case "bob":
      return `<path d="M18 52V28c2-18 42-18 44 0v24l-9-5-4 7-9-5-9 5-4-7z" ${base}/><path d="M24 28c8 5 22 5 32 0" fill="none" stroke="${TRAZO}" stroke-width="2"/>`;
    case "canas-mono":
      return `<circle cx="51" cy="14" r="9" ${base}/><path d="M21 42V27c2-17 36-18 39 0v15l-8-11c-10 5-20 5-31 11z" ${base}/><path d="M27 23c8-5 17-5 25 0" fill="none" stroke="#F7F2EA" stroke-width="2"/>`;
    case "plateado":
      return `<path d="M19 55V29c2-18 40-18 42 0v26l-8-9-6 7-7-6-7 6-6-7z" ${base}/><path d="M25 25c8-5 20-5 29 0" fill="none" stroke="#F7F2EA" stroke-width="2"/>`;
    case "canas-corto":
      return `<path d="M21 37V27c3-17 35-17 38 0v10l-8-8c-10 5-19 3-30 8z" ${base}/><path d="M27 23c7-4 16-4 24 0" fill="none" stroke="#F7F2EA" stroke-width="2"/>`;
  }
}

function svgDeAvatar(avatar: AvatarPropio): string {
  const gafas = avatar.gafas
    ? `<g fill="none" stroke="${TRAZO}" stroke-width="2"><rect x="23" y="34" width="13" height="9" rx="4"/><rect x="44" y="34" width="13" height="9" rx="4"/><path d="M36 38.5h8"/></g>`
    : "";
  const arrugas = avatar.arrugas
    ? `<path d="M25 47l3 1m27-1 3-1M29 52c3 2 19 2 22 0" fill="none" stroke="#B08B58" stroke-width="1.25" stroke-linecap="round" opacity=".72"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="${avatar.fondo}"/><path d="M13 80c2-16 13-25 27-25s25 9 27 25" fill="${avatar.ropa}" stroke="${TRAZO}" stroke-width="2"/><path d="M33 55h14v9c-4 4-10 4-14 0z" fill="${PIEL_EMOJI}" stroke="${TRAZO}" stroke-width="2"/>${peloSvg(avatar.pelo, avatar.colorPelo)}<circle cx="40" cy="37" r="17" fill="${PIEL_EMOJI}" stroke="${TRAZO}" stroke-width="2"/><path d="M24 31c5-10 27-13 33 0v-3c-3-14-30-14-34 0z" fill="${avatar.colorPelo}" stroke="${TRAZO}" stroke-width="2" stroke-linejoin="round"/><circle cx="33" cy="37" r="1.8" fill="${TRAZO}"/><circle cx="47" cy="37" r="1.8" fill="${TRAZO}"/>${gafas}<path d="M33 45c4 4 10 4 14 0" fill="none" stroke="${TRAZO}" stroke-width="2.25" stroke-linecap="round"/>${arrugas}</svg>`;
}

const porId = new Map(AVATARES.map((avatar) => [avatar.id, avatar]));
const cache = new Map<AvatarId, string>();

export function avatarPorId(id: string): AvatarPropio | undefined {
  return porId.get(id);
}

/** SVG propio como data URI; se memoriza para que listas largas no lo recalculen. */
export function uriDeAvatar(id: AvatarId): string {
  const guardada = cache.get(id);
  if (guardada) return guardada;
  const avatar = avatarPorId(id);
  if (!avatar) throw new Error(`Avatar desconocido: ${id}`);
  const uri = `data:image/svg+xml,${encodeURIComponent(svgDeAvatar(avatar))}`;
  cache.set(id, uri);
  return uri;
}

/** Agrupación estable para el selector, en el orden en que se reconoce mejor. */
export const GRUPOS_AVATAR: readonly { titulo: GrupoAvatar; avatares: readonly AvatarPropio[] }[] =
  ["Primeros años", "Adultas", "Maduras", "Mayores"].map((titulo) => ({
    titulo: titulo as GrupoAvatar,
    avatares: AVATARES.filter((avatar) => avatar.grupo === titulo),
  }));
