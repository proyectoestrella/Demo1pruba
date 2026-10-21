import { notionists } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { avatarValido, elegirAvatar, type AvatarElegido } from "@/lib/avatar";

export type TipoRetrato = "mujer" | "hombre";
const PEINADOS_RETRATO = {
  mujer: ["variant23", "variant02", "variant28", "variant41", "variant45", "variant29", "variant39", "variant57"],
  hombre: ["variant01", "variant06", "variant12", "variant22", "variant32", "variant42", "variant44", "variant49"],
} as const;
export type Retrato = { version: 1; tipo: TipoRetrato; peinado: number };
type AvatarConRetrato = AvatarElegido & { retrato: Retrato };

export function retratoGuardado(actual: unknown): Retrato | undefined {
  if (!avatarValido(actual) || !("retrato" in actual)) return undefined;
  const valor = actual.retrato as Partial<Retrato> | null;
  if (!valor || valor.version !== 1 || (valor.tipo !== "mujer" && valor.tipo !== "hombre") ||
      !Number.isInteger(valor.peinado) || Number(valor.peinado) < 0 || Number(valor.peinado) >= PEINADOS_RETRATO[valor.tipo].length) return undefined;
  return valor as Retrato;
}

export function guardarRetrato(retrato: Retrato): AvatarConRetrato {
  return { ...elegirAvatar(retrato.tipo === "mujer" ? "vera-largo" : "leo-corto"), retrato: { ...retrato } };
}

const cache = new Map<string, string>();
export function uriRetrato(retrato: Retrato, size = 128): string {
  const clave = `${retrato.tipo}:${retrato.peinado}:${size}`;
  const guardada = cache.get(clave);
  if (guardada) return guardada;
  const uri = createAvatar(notionists, {
    seed: [`sishow-${retrato.tipo}`], size, radius: 50,
    backgroundColor: ["ffffff"],
    hair: [PEINADOS_RETRATO[retrato.tipo][retrato.peinado] ?? PEINADOS_RETRATO[retrato.tipo][0]],
    beardProbability: 0, glassesProbability: 0, gestureProbability: 0, bodyIconProbability: 0,
    body: ["variant01"], eyes: ["variant01"], brows: ["variant01"], lips: ["variant01"], nose: ["variant01"],
  }).toDataUri();
  cache.set(clave, uri);
  return uri;
}

export const peinadosRetrato = (tipo: TipoRetrato) => PEINADOS_RETRATO[tipo].map((_, indice) => indice);
