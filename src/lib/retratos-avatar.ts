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

function peloDetras(peinado: PeinadoRetrato): string {
  switch (peinado) {
    case "bob-corto":
      return forma("M30 47c0-17 12-28 30-28s30 11 30 28v30l-10 10-6-8H46l-6 8-10-10Z");
    case "largo-liso":
      return `${forma("M29 43c-5 15-4 42-3 66l17-5h34l17 5c1-24 2-51-3-66-5-16-17-25-31-25S34 27 29 43Z")}${linea("M32 55v49M88 55v49")}`;
    case "largo-flequillo":
      return `${forma("M28 43c-5 17-3 43-1 66l16-4h34l16 4c2-23 4-49-1-66-5-17-18-26-32-26S33 26 28 43Z")}${linea("M32 58l-1 46M88 58l1 46")}`;
    case "ondas-largas":
      return `${forma("M29 43c-7 10 1 17-4 27-5 9 5 15 0 24-3 6 2 13 10 15l11-5h28l11 5c8-2 13-9 10-15-5-9 5-15 0-24-5-10 3-17-4-27-6-16-18-24-31-24S35 27 29 43Z")}${linea("M31 54c9 8-7 14 0 22s-6 15 1 23M89 54c-9 8 7 14 0 22s6 15-1 23")}`;
    case "rizos-largos":
      return `${forma("M29 47c-8-5-7-15 0-20 0-9 10-14 18-9 6-7 18-7 25 0 9-4 20 2 20 12 8 5 9 15 1 21 6 7 3 17-5 22 1 9-8 16-17 12-6 7-17 7-23 0-7 7-18 7-24 0-9 4-18-3-17-12-8-5-7-15 1-21-7-5-8-15 0-20Z")}${linea("M28 58c8-7 14 5 6 10s-5 15 4 17M92 58c-8-7-14 5-6 10s5 15-4 17M31 96c6-8 14-2 12 7M89 96c-6-8-14-2-12 7")}`;
    case "media-melena":
      return `${forma("M29 44c-4 14-2 35 4 48l12-6h30l12 6c6-13 8-34 4-48-5-16-17-24-31-24s-26 8-31 24Z")}${linea("M33 59c0 15 4 25 10 29M87 59c0 15-4 25-10 29")}`;
    case "coleta-alta":
      return `${forma("M82 32c17-5 27 6 24 20-2 13-13 23-27 21l-5-12 8-29Z")}${linea("M88 37c10 5 12 17 5 27")}`;
    case "coleta-baja":
      return `${forma("M83 60c17 0 24 13 18 27-5 13-19 16-29 7l7-31Z")}${linea("M88 65c8 6 8 17 1 25")}`;
    case "mono-alto":
      return `${forma("M45 24c-2-10 5-19 15-19s17 9 15 19c-1 7-7 11-15 11S46 31 45 24Z")}${linea("M49 18c7-7 16-7 23 0")}`;
    case "mono-bajo":
      return `${forma("M78 63c2-10 12-16 21-10 8 6 7 18-1 24-9 6-20-2-20-14Z")}${linea("M84 59c7-4 14 0 16 7")}`;
    case "trenza-lateral":
      return `${forma("M80 55c12 3 17 12 11 21 10 5 10 15 1 21 7 7 2 16-7 18-8-4-10-12-4-19-9-5-10-15-2-21-7-8-5-18 3-24Z")}${linea("M82 65l10 8-11 8 10 8-10 8 8 8-7 7")}`;
    case "afro-rizado":
      return `${forma("M24 72c-10-4-12-15-5-23-5-9 0-19 10-21 1-11 11-17 21-12 6-9 18-11 26-4 9-6 22-2 25 9 11 0 19 9 15 19 7 7 5 19-5 24-3 10-14 14-23 9-8 7-21 7-29 0-10 5-22 1-27-8Z")}${linea("M25 37c5 5 10 4 13-2M43 22c3 6 9 7 14 2M64 21c4 6 10 6 14 1M83 29c2 6 7 9 13 7M19 55c6 3 9 8 7 14M101 52c-6 4-8 9-5 14M30 79c5-5 11-4 14 2M76 81c4-6 11-7 16-2")}`;
    case "trenzas-largas":
      return `${forma("M29 45c-3 10 0 22 7 28h48c7-6 10-18 7-28-4-16-16-25-31-25S33 29 29 45Z")}${linea("M34 57l-5 10 9 7-9 8 9 8-8 9 8 9-5 9M43 61l-3 12 7 8-7 9 7 9-3 10M86 57l5 10-9 7 9 8-9 8 8 9-8 9 5 9M77 61l3 12-7 8 7 9-7 9 3 10")}`;
    default:
      return "";
  }
}

function peloDelante(peinado: PeinadoRetrato): string {
  switch (peinado) {
    case "pixie":
      return `${forma("M39 46c0-16 8-27 23-27 11 0 19 6 22 16l-10-3-4 7-8-7-6 7-7-6-8 5Z")}${linea("M43 29c8-7 19-8 29-3")}`;
    case "corto-raya":
      return `${forma("M38 45c1-18 11-27 25-27 12 0 20 7 22 21-9-7-19-10-30-9-4 7-9 12-17 15Z")}${linea("M55 21c0 5 0 8-1 11M59 20c10 1 18 6 23 14")}`;
    case "bob-corto":
      return `${forma("M34 48c1-19 11-29 27-29 15 0 25 11 26 29-9-6-18-9-27-9s-18 3-26 9Z")}${linea("M59 21c-3 9-10 15-21 21M62 21c5 8 12 14 22 20")}`;
    case "largo-liso":
      return `${forma("M34 48c1-20 11-30 26-30s25 10 26 30c-8-7-17-10-26-10s-18 3-26 10Z")}${linea("M59 20c-3 9-11 16-22 23M62 20c4 9 11 16 21 22")}`;
    case "largo-flequillo":
      return forma(
        "M34 48c1-20 11-30 26-30s25 10 26 30c-5-4-9-10-11-17-3 8-8 12-15 15-7-3-12-8-15-15-2 7-6 13-11 17Z",
      );
    case "ondas-largas":
      return `${forma("M33 49c1-20 12-31 27-31s26 11 27 31c-8-8-17-11-27-11S41 41 33 49Z")}${linea("M57 20c1 8-7 14-18 22M63 21c-1 7 8 13 18 20")}`;
    case "rizos-largos":
      return `${forma("M33 49c-4-6-1-14 5-16-1-8 8-13 15-9 6-7 17-6 22 2 8-1 16 6 13 15-8-6-17-9-27-9s-19 3-27 9Z")}${linea("M40 34c3-6 9-6 12 0M53 25c4-6 10-5 13 1M68 32c4-5 9-3 11 2")}`;
    case "media-melena":
      return `${forma("M34 48c1-19 11-29 26-29s25 10 26 29c-8-7-17-10-26-10s-18 3-26 10Z")}${linea("M48 24c1 8 5 14 12 18M48 24c-3 8-7 14-12 19")}`;
    case "coleta-alta":
    case "coleta-baja":
    case "mono-alto":
    case "mono-bajo":
    case "trenza-lateral":
      return `${forma("M35 47c2-19 11-28 25-28s24 9 25 28c-8-7-16-10-25-10s-17 3-25 10Z")}${linea("M59 21c3 9 11 16 23 22M58 21c-3 9-10 16-20 22")}`;
    case "afro-rizado":
      return `${forma("M31 50c-5-5-3-13 3-16 0-8 9-12 16-8 6-6 16-5 21 1 8-2 16 4 15 12 6 4 7 12 2 17-8-5-17-8-27-8S39 45 31 50Z")}${linea("M38 37c4-6 9-6 13-1M51 27c4-6 10-5 13 1M66 29c4-4 9-2 11 2")}`;
    case "trenzas-largas":
      return `${forma("M34 48c1-20 11-30 26-30s25 10 26 30c-8-7-17-10-26-10s-18 3-26 10Z")}${linea("M60 20v17M60 20L38 43M60 20l22 23M49 23l-7 17M71 23l7 17")}`;
  }
}

function expresion(id: ExpresionRetrato): string {
  const cejas = `${linea("M46 56c3-2 6-2 9-1")}${linea("M65 55c3-1 6-1 9 1")}`;
  const nariz = linea("M60 61l-1 6 3 1");
  if (id === "alegre")
    return `${cejas}${linea("M47 62c2 2 5 2 7 0")}${linea("M66 62c2 2 5 2 7 0")}${nariz}${linea("M51 75c5 7 13 7 18 0", 'data-sonrisa="alegre" ')}`;
  const ojos = `${linea("M47 62c2-1 5-1 7 0")}${linea("M66 62c2-1 5-1 7 0")}`;
  if (id === "suave")
    return `${cejas}${ojos}${nariz}${linea("M53 76c4 3 10 3 14 0", 'data-sonrisa="suave" ')}`;
  return `${cejas}${ojos}${nariz}${linea("M51 75c5 5 13 5 18 0", 'data-sonrisa="amable" ')}`;
}

/** SVG de línea en blanco y negro, sin fuentes, filtros ni recursos externos. */
export function svgRetrato(retrato: Retrato): string {
  if (!esRetratoV2(retrato)) throw new Error("Retrato no válido");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Retrato con ${PEINADOS_RETRATO.find((p) => p.id === retrato.peinado)!.nombre.toLowerCase()} y sonrisa ${retrato.expresion}"><circle cx="60" cy="60" r="58.5" fill="#fff" stroke="#171717" stroke-width="2.2"/>${linea("M19 120c3-18 18-28 41-28s38 10 41 28")}${peloDetras(retrato.peinado)}${forma("M49 83v12c2 4 6 6 11 6s9-2 11-6V83")}${forma("M39 45c0-17 8-27 21-27s21 10 21 27v20c0 16-8 26-21 26S39 81 39 65Z")}${forma("M39 58c-4-2-7 1-6 6 1 5 3 8 7 7M81 58c4-2 7 1 6 6-1 5-3 8-7 7")}${peloDelante(retrato.peinado)}${expresion(retrato.expresion)}</svg>`;
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
