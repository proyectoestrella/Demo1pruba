import { avatarValido, elegirAvatar, hashTexto, type AvatarElegido } from "@/lib/avatar";

/**
 * Retratos DiceBear «Notionists» (los de antes de la noche del 21-oct), con
 * sonrisa suave y más pelo largo. Este módulo es ligero: solo el catálogo, la
 * lectura de lo guardado y el cargador. El dibujo (DiceBear, ~118 KB gzip)
 * vive en `retratos-dicebear.ts` y se carga bajo demanda con `cargarRetratos`.
 *
 * Variantes elegidas mirando la hoja de contacto de las 63 de Notionists 9.4.2.
 */
export const PEINADOS_RETRATO = [
  { id: "variant23", nombre: "Largo liso", grupo: "largo" },
  { id: "variant28", nombre: "Largo suelto", grupo: "largo" },
  { id: "variant41", nombre: "Largo con flequillo", grupo: "largo" },
  { id: "variant10", nombre: "Melena con flequillo", grupo: "largo" },
  { id: "variant02", nombre: "Media melena ondulada", grupo: "largo" },
  { id: "variant36", nombre: "Ondas", grupo: "largo" },
  { id: "variant08", nombre: "Ondas con diadema", grupo: "largo" },
  { id: "variant39", nombre: "Coleta lateral", grupo: "largo" },
  { id: "variant47", nombre: "Coleta alta", grupo: "largo" },
  { id: "variant57", nombre: "Moño alto", grupo: "largo" },
  { id: "variant20", nombre: "Rizos con volumen", grupo: "afro" },
  { id: "variant59", nombre: "Afro con dos moños", grupo: "afro" },
  { id: "variant01", nombre: "Corto con tupé", grupo: "corto" },
  { id: "variant06", nombre: "Corto clásico", grupo: "corto" },
  { id: "variant22", nombre: "Corto rizado", grupo: "corto" },
] as const;

/** Labios Notionists con una sonrisa cerrada y discreta. Igual para todos. */
export const LABIOS_RETRATO = "variant22";

export type PeinadoRetrato = (typeof PEINADOS_RETRATO)[number]["id"];
export type TipoRetratoLegado = "mujer" | "hombre";

export type Retrato = { version: 3; peinado: PeinadoRetrato };

/** Retrato automático estable: reparte los ids por el catálogo completo. */
/**
 * Retrato automático: solo pelo largo o afro. El automático no sabe quién es la
 * persona y en un salón la mayoría son mujeres: un corto «de chico» para María
 * chirría (22-oct). Los 3 cortos quedan para quien los elija a mano.
 */
const PEINADOS_POR_DEFECTO = PEINADOS_RETRATO.filter(({ grupo }) => grupo !== "corto");
export function retratoPorDefecto(id: string): Retrato {
  return {
    version: 3,
    peinado: PEINADOS_POR_DEFECTO[hashTexto(id) % PEINADOS_POR_DEFECTO.length].id,
  };
}

/** Selector Notionists hasta el 21-oct: tipo + índice en su lista de 8. */
export type RetratoV1 = { version: 1; tipo: TipoRetratoLegado; peinado: number };
/** Retratos de línea propios de la noche del 21-oct (Codex). */
export type RetratoV2 = { version: 2; peinado: string; expresion?: string };

type AvatarConRetrato = AvatarElegido & { retrato: Retrato | RetratoV1 | RetratoV2 };

const IDS_PEINADO = new Set<string>(PEINADOS_RETRATO.map(({ id }) => id));
export const PEINADO_POR_DEFECTO: Record<TipoRetratoLegado, PeinadoRetrato> = {
  mujer: "variant23",
  hombre: "variant06",
};

/** Las 8 + 8 variantes Notionists del selector anterior, en su orden original. */
export const PEINADOS_V1 = {
  mujer: [
    "variant23",
    "variant02",
    "variant28",
    "variant41",
    "variant45",
    "variant29",
    "variant39",
    "variant57",
  ],
  hombre: [
    "variant01",
    "variant06",
    "variant12",
    "variant22",
    "variant32",
    "variant42",
    "variant44",
    "variant49",
  ],
} as const;

/** Variante antigua que ya no está en el catálogo → la más parecida que sí está. */
export const EQUIVALENTES_NOTIONISTS: Record<string, PeinadoRetrato> = {
  variant45: "variant47", // coletas con flequillo → coleta alta
  variant29: "variant57", // recogido arriba → moño alto
  variant12: "variant01", // corto despeinado → corto con tupé
  variant32: "variant06", // corto con lateral rapado → corto clásico
  variant42: "variant01", // corto ondulado claro → corto con tupé
  variant44: "variant06", // cresta lisa → corto clásico
  variant49: "variant06", // corto recto → corto clásico
};

/** Ids de los retratos de línea de Codex (v2) → variante Notionists. */
export const CORRESPONDENCIAS_V2: Record<string, PeinadoRetrato> = {
  pixie: "variant01",
  "corto-raya": "variant06",
  "bob-corto": "variant10",
  "largo-liso": "variant23",
  "largo-flequillo": "variant41",
  "ondas-largas": "variant36",
  "rizos-largos": "variant20",
  "media-melena": "variant02",
  "coleta-alta": "variant47",
  "coleta-baja": "variant39",
  "mono-alto": "variant57",
  "mono-bajo": "variant57",
  "trenza-lateral": "variant39",
  "afro-rizado": "variant20",
  "trenzas-largas": "variant59",
};

const esPeinado = (valor: unknown): valor is PeinadoRetrato => IDS_PEINADO.has(String(valor));

/** Convierte cualquier receta guardada (v1, v2, v3) en una v3 válida, o undefined si no es un retrato. */
export function normalizarRetrato(valor: unknown): Retrato | undefined {
  if (!valor || typeof valor !== "object") return undefined;
  const r = valor as { version?: unknown; tipo?: unknown; peinado?: unknown };
  if (r.version === 3)
    return { version: 3, peinado: esPeinado(r.peinado) ? r.peinado : "variant23" };
  if (r.version === 2) {
    const id = String(r.peinado);
    return { version: 3, peinado: CORRESPONDENCIAS_V2[id] ?? (esPeinado(id) ? id : "variant23") };
  }
  if (r.version === 1) {
    const tipo: TipoRetratoLegado = r.tipo === "hombre" ? "hombre" : "mujer";
    const indice = Number(r.peinado);
    const antigua: string | undefined = Number.isInteger(indice)
      ? PEINADOS_V1[tipo][indice]
      : undefined;
    if (!antigua) return { version: 3, peinado: PEINADO_POR_DEFECTO[tipo] };
    return {
      version: 3,
      peinado: esPeinado(antigua)
        ? antigua
        : (EQUIVALENTES_NOTIONISTS[antigua] ?? PEINADO_POR_DEFECTO[tipo]),
    };
  }
  return undefined;
}

/** Lee la receta actual y todas las anteriores. */
export function retratoGuardado(actual: unknown): Retrato | undefined {
  if (!avatarValido(actual) || !("retrato" in actual)) return undefined;
  return normalizarRetrato((actual as AvatarConRetrato).retrato);
}

export function guardarRetrato(retrato: Retrato): AvatarConRetrato {
  if (!esPeinado(retrato.peinado)) throw new Error("Retrato no válido");
  // La clave histórica queda como red de seguridad para clientes antiguos.
  return { ...elegirAvatar("vera-largo"), retrato: { version: 3, peinado: retrato.peinado } };
}

/* ------------------------------------------------------------------------ */
/* Carga diferida del dibujo                                                 */
/* ------------------------------------------------------------------------ */

export type DibujoRetratos = typeof import("./retratos-dicebear");
let dibujo: DibujoRetratos | undefined;
let promesa: Promise<DibujoRetratos> | undefined;

/** Carga DiceBear una sola vez; las llamadas siguientes reutilizan la promesa. */
export function cargarRetratos(): Promise<DibujoRetratos> {
  promesa ??= import("./retratos-dicebear").then(
    (m) => (dibujo = m),
    (error: unknown) => {
      promesa = undefined; // permite reintentar en el siguiente montaje
      throw error;
    },
  );
  return promesa;
}

/** El dibujo si ya está cargado (para pintar sin parpadeo en montajes posteriores). */
export function retratosCargados(): DibujoRetratos | undefined {
  return dibujo;
}
