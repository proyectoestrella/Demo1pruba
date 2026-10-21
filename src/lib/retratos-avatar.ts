import { avatarValido, elegirAvatar, type AvatarElegido } from "@/lib/avatar";

export const PEINADOS_RETRATO = [
  { id: "pixie", nombre: "Pixie", grupo: "corto" },
  { id: "corto-raya", nombre: "Corto con raya", grupo: "corto" },
  { id: "bob-corto", nombre: "Bob corto", grupo: "corto" },
  { id: "largo-liso", nombre: "Largo liso", grupo: "largo" },
  { id: "largo-flequillo", nombre: "Largo con flequillo", grupo: "largo" },
  { id: "ondas-largas", nombre: "Ondas largas", grupo: "largo" },
  { id: "rizos-largos", nombre: "Rizos largos", grupo: "largo" },
  { id: "media-melena", nombre: "Media melena", grupo: "largo" },
  { id: "coleta-alta", nombre: "Coleta alta", grupo: "largo" },
  { id: "coleta-baja", nombre: "Coleta baja", grupo: "largo" },
  { id: "mono-alto", nombre: "Moño alto", grupo: "largo" },
  { id: "mono-bajo", nombre: "Moño bajo", grupo: "largo" },
  { id: "trenza-lateral", nombre: "Trenza lateral", grupo: "largo" },
  { id: "afro-rizado", nombre: "Afro rizado", grupo: "afro" },
  { id: "trenzas-largas", nombre: "Trenzas largas", grupo: "afro" },
] as const;

export const EXPRESIONES_RETRATO = [
  { id: "suave", nombre: "Suave" },
  { id: "amable", nombre: "Amable" },
  { id: "alegre", nombre: "Alegre" },
] as const;

export type PeinadoRetrato = (typeof PEINADOS_RETRATO)[number]["id"];
export type ExpresionRetrato = (typeof EXPRESIONES_RETRATO)[number]["id"];
export type TipoRetratoLegado = "mujer" | "hombre";

export type Retrato = {
  version: 2;
  peinado: PeinadoRetrato;
  expresion: ExpresionRetrato;
};

export type RetratoLegado = {
  version: 1;
  tipo: TipoRetratoLegado;
  peinado: number;
};

type AvatarConRetrato = AvatarElegido & { retrato: Retrato | RetratoLegado };

/**
 * Correspondencias del selector Notionists anterior. Las claves son los dos
 * campos que se guardaban (`tipo` e índice); los valores ya no dependen del
 * orden del catálogo nuevo.
 */
export const CORRESPONDENCIAS_PEINADOS_LEGADOS = {
  "mujer:0": "largo-liso",
  "mujer:1": "largo-flequillo",
  "mujer:2": "ondas-largas",
  "mujer:3": "rizos-largos",
  "mujer:4": "media-melena",
  "mujer:5": "mono-alto",
  "mujer:6": "coleta-baja",
  "mujer:7": "trenzas-largas",
  "hombre:0": "corto-raya",
  "hombre:1": "pixie",
  "hombre:2": "corto-raya",
  "hombre:3": "pixie",
  "hombre:4": "bob-corto",
  "hombre:5": "corto-raya",
  "hombre:6": "pixie",
  "hombre:7": "bob-corto",
} as const satisfies Record<`${TipoRetratoLegado}:${number}`, PeinadoRetrato>;

const IDS_PEINADO = new Set<string>(PEINADOS_RETRATO.map(({ id }) => id));
const IDS_EXPRESION = new Set<string>(EXPRESIONES_RETRATO.map(({ id }) => id));

function esRetratoV2(valor: unknown): valor is Retrato {
  if (!valor || typeof valor !== "object") return false;
  const retrato = valor as Partial<Retrato>;
  return (
    retrato.version === 2 &&
    IDS_PEINADO.has(String(retrato.peinado)) &&
    IDS_EXPRESION.has(String(retrato.expresion))
  );
}

export function migrarRetratoLegado(valor: unknown): Retrato | undefined {
  if (!valor || typeof valor !== "object") return undefined;
  const retrato = valor as Partial<RetratoLegado>;
  if (
    retrato.version !== 1 ||
    (retrato.tipo !== "mujer" && retrato.tipo !== "hombre") ||
    !Number.isInteger(retrato.peinado)
  )
    return undefined;
  const peinado =
    CORRESPONDENCIAS_PEINADOS_LEGADOS[
      `${retrato.tipo}:${retrato.peinado}` as keyof typeof CORRESPONDENCIAS_PEINADOS_LEGADOS
    ];
  return peinado ? { version: 2, peinado, expresion: "amable" } : undefined;
}

/** Lee tanto la receta actual como todos los retratos guardados por el selector anterior. */
export function retratoGuardado(actual: unknown): Retrato | undefined {
  if (!avatarValido(actual) || !("retrato" in actual)) return undefined;
  const valor = (actual as AvatarConRetrato).retrato;
  return esRetratoV2(valor) ? { ...valor } : migrarRetratoLegado(valor);
}

export function guardarRetrato(retrato: Retrato): AvatarConRetrato {
  if (!esRetratoV2(retrato)) throw new Error("Retrato no válido");
  // La clave histórica queda como red de seguridad para clientes antiguos; la
  // receta `retrato` es la fuente de verdad en esta versión.
  return { ...elegirAvatar("vera-largo"), retrato: { ...retrato } };
}

const linea = (d: string, extra = "") =>
  `<path d="${d}" ${extra}fill="none" stroke="#171717" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
const forma = (d: string, extra = "") =>
  `<path d="${d}" fill="#fff" stroke="#171717" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const rizo = (cx: number, cy: number, r = 4) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="#171717" stroke-width="2.2"/>`;

function peloDetras(peinado: PeinadoRetrato): string {
  switch (peinado) {
    case "bob-corto":
      return forma(
        "M33 46C29 53 29 69 33 80l9-4h36l9 4c4-12 4-26-2-35-7-12-17-17-25-17S40 34 33 46Z",
      );
    case "largo-liso":
      return `${forma("M31 43c-8 14-7 42-5 62h68c2-20 3-48-5-62-6-11-17-17-29-17S37 32 31 43Z")}${linea("M33 59c-2 14-1 29 1 41M87 59c2 14 1 29-1 41")}`;
    case "largo-flequillo":
      return `${forma("M30 43c-8 17-6 45-3 62h66c3-18 5-46-3-62-6-12-17-18-30-18S36 31 30 43Z")}${linea("M34 66v34M86 66v34")}`;
    case "ondas-largas":
      return `${forma("M31 42c-7 9-8 19-4 29-5 8-3 16 3 20-4 6-1 12 5 14h50c6-2 9-8 5-14 6-4 8-12 3-20 4-10 3-20-4-29-7-10-17-16-29-16S38 32 31 42Z")}${linea("M31 58c8 7-7 13 0 21s-5 14 2 21M89 58c-8 7 7 13 0 21s5 14-2 21")}`;
    case "rizos-largos":
      return `${forma("M31 43c-8 7-9 18-5 27-5 7-3 14 2 18-4 7 1 14 8 17h48c7-3 12-10 8-17 5-4 7-11 2-18 4-9 3-20-5-27-7-11-17-17-29-17S38 32 31 43Z")}${[30, 42, 54, 66, 78, 90].map((x, i) => rizo(x, 94 + (i % 2) * 5, 5)).join("")}`;
    case "media-melena":
      return `${forma("M31 44c-7 13-5 35 1 48l11-5h34l11 5c6-13 8-35 1-48-6-12-17-18-29-18S37 32 31 44Z")}${linea("M34 62c-1 10 1 19 5 27M86 62c1 10-1 19-5 27")}`;
    case "coleta-alta":
      return `${forma("M84 35c17 1 24 12 20 25-4 12-15 15-25 9l2-23Z")}${linea("M88 40c8 4 11 12 8 22")}`;
    case "coleta-baja":
      return `${forma("M83 58c17 1 22 13 16 24-6 10-17 9-24 1l4-21Z")}${linea("M86 64c5 5 6 11 3 17")}`;
    case "mono-alto":
      return `${rizo(75, 24, 14)}${linea("M65 17c5-7 13-7 19-2")}`;
    case "mono-bajo":
      return `${rizo(88, 62, 13)}${linea("M84 52c8 2 12 8 11 16")}`;
    case "trenza-lateral":
      return `${forma("M84 56c13 8 12 22 4 31 7 8 3 18-5 23-8-3-11-11-6-18-7-8-8-19 1-32Z")}${linea("M84 64l10 8-12 8 9 9-11 7 7 9")}`;
    case "afro-rizado":
      return forma(
        "M28 54c-8-4-9-14-3-20-2-9 6-16 14-14 4-9 15-12 22-6 8-6 19-3 22 6 10-2 18 7 15 17 7 6 6 17-2 22-6 9-17 12-27 7-9 5-21 5-30-1-10 5-21 2-26-6Z",
      );
    case "trenzas-largas":
      return `${forma("M31 43c-7 13-4 25 2 31h54c6-6 9-18 2-31-6-11-17-17-29-17S37 32 31 43Z")}${linea("M34 55c-6 17-6 34 0 50M42 57c-5 17-4 33 1 48M78 57c5 17 4 33-1 48M86 55c6 17 6 34 0 50")}${linea("M30 70l8 7-9 7 9 8-7 8M90 70l-8 7 9 7-9 8 7 8")}`;
    default:
      return "";
  }
}

function peloDelante(peinado: PeinadoRetrato): string {
  const casco = forma("M34 46c2-15 12-24 26-24s24 9 26 24c-8-6-17-9-26-9s-18 3-26 9Z");
  switch (peinado) {
    case "pixie":
      return `${forma("M35 47c0-14 9-25 24-25 12 0 21 7 25 18l-11-5-4 6-8-7-7 7-8-6-11 6Z")}${linea("M43 31c8-6 18-7 28-3")}`;
    case "corto-raya":
      return `${casco}${linea("M51 23c-1 7-5 13-13 19M55 24c8 1 17 6 27 15")}`;
    case "bob-corto":
      return `${casco}${linea("M37 43c8-8 18-11 31-10M84 45c-7-5-13-8-20-10")}`;
    case "largo-liso":
      return `${casco}${linea("M60 23c-2 8-10 15-23 21M61 23c4 8 11 14 22 20")}`;
    case "largo-flequillo":
      return `${casco}${forma("M36 43c4-11 13-17 24-17s20 6 24 17c-7-4-11-8-14-13-2 7-5 11-10 13-4-3-7-8-9-13-4 6-9 10-15 13Z")}`;
    case "ondas-largas":
      return `${casco}${linea("M58 23c-3 9-10 15-20 20M62 24c5 7 12 13 21 18")}`;
    case "rizos-largos":
      return `${casco}${linea("M41 34c4-5 8-5 12 0M54 27c4-5 9-5 13 0M68 33c4-4 8-3 11 1")}`;
    case "media-melena":
      return `${casco}${linea("M47 26c2 7 7 12 14 16M48 26c-3 8-8 13-13 18")}`;
    case "coleta-alta":
    case "coleta-baja":
    case "mono-alto":
    case "mono-bajo":
    case "trenza-lateral":
      return `${casco}${linea("M59 23c3 9 11 15 24 20M58 23c-3 8-10 14-21 20")}`;
    case "afro-rizado":
      return `${forma("M31 49c-5-6-4-14 2-18 1-8 10-12 17-8 6-6 16-5 21 1 8-2 17 4 16 13 6 4 7 12 2 18-7-6-17-9-28-9s-22 3-28 9Z")}${linea("M40 31c3-5 8-5 11 0M54 24c3-5 8-4 11 1M69 31c3-4 7-3 9 1")}`;
    case "trenzas-largas":
      return `${casco}${linea("M58 23c-3 8-10 14-21 20M62 23c3 8 10 14 21 20")}`;
  }
}

function expresion(id: ExpresionRetrato): string {
  const cejas = `${linea("M45 55c3-2 7-2 10 0")}${linea("M65 55c3-2 7-2 10 0")}`;
  const nariz = linea("M60 59c-2 4-2 8 1 10 2 1 4 0 5-1");
  if (id === "alegre")
    return `${cejas}${linea("M46 61c3 3 7 3 10 0")}${linea("M65 61c3 3 7 3 10 0")}${nariz}${linea("M50 74c6 9 15 9 21 0", 'data-sonrisa="alegre" ')}`;
  const ojos = `${linea("M47 61h7")}${linea("M66 61h7")}`;
  if (id === "suave")
    return `${cejas}${ojos}${nariz}${linea("M52 75c5 5 11 5 16 0", 'data-sonrisa="suave" ')}`;
  return `${cejas}${ojos}${nariz}${linea("M50 74c6 7 15 7 21 0", 'data-sonrisa="amable" ')}`;
}

/** SVG de línea en blanco y negro, sin fuentes, filtros ni recursos externos. */
export function svgRetrato(retrato: Retrato): string {
  if (!esRetratoV2(retrato)) throw new Error("Retrato no válido");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Retrato con ${PEINADOS_RETRATO.find((p) => p.id === retrato.peinado)!.nombre.toLowerCase()} y sonrisa ${retrato.expresion}"><circle cx="60" cy="60" r="58.5" fill="#fff" stroke="#171717" stroke-width="2.2"/>${linea("M20 120c2-19 17-29 40-29s38 10 40 29")}${peloDetras(retrato.peinado)}${forma("M48 82v13c3 5 7 7 12 7s9-2 12-7V82")}${forma("M35 48c0-17 10-27 25-27s25 10 25 27v16c0 18-10 29-25 29S35 82 35 64Z")}${forma("M35 57c-5-2-8 2-7 7 1 6 4 9 9 8M85 57c5-2 8 2 7 7-1 6-4 9-9 8")}${peloDelante(retrato.peinado)}${expresion(retrato.expresion)}</svg>`;
}

const cache = new Map<string, string>();

export function uriRetrato(retrato: Retrato, size = 128): string {
  const clave = `${retrato.peinado}:${retrato.expresion}:${Math.max(24, Math.round(size))}`;
  const guardada = cache.get(clave);
  if (guardada) return guardada;
  const uri = `data:image/svg+xml,${encodeURIComponent(svgRetrato(retrato))}`;
  cache.set(clave, uri);
  return uri;
}
