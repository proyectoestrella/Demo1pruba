import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import { LABIOS_RETRATO, type Retrato } from "./retratos-avatar";

/**
 * Dibujo DiceBear «Notionists». Módulo pesado: se importa SOLO de forma
 * dinámica (`cargarRetratos` en `retratos-avatar.ts`), nunca estáticamente.
 *
 * DiceBear se distribuye bajo MIT; el diseño Notionists es CC0 1.0 (véase la
 * LICENSE instalada). El SVG se genera en el navegador, sin red.
 */
const cache = new Map<string, string>();

/** Retrato elegido o automático: fondo blanco, sin barba y sonrisa suave. */
export function uriRetrato(retrato: Retrato, size = 128, semilla?: string): string {
  const px = Math.max(24, Math.round(size));
  const clave = `${retrato.peinado}:${semilla ?? "elegido"}:${px}`;
  const guardada = cache.get(clave);
  if (guardada) return guardada;
  const uri = createAvatar(notionists, {
    seed: semilla || "sishow-retrato",
    size: px,
    radius: 50,
    backgroundColor: ["ffffff"],
    hair: [retrato.peinado],
    beardProbability: 0,
    glassesProbability: 0,
    gestureProbability: 0,
    bodyIconProbability: 0,
    body: ["variant01"],
    // Las elecciones conservan la cara conocida. La semilla automática deja
    // variar ojos y cejas para no repetir la misma cara con distinto pelo.
    ...(semilla ? {} : { eyes: ["variant01"], brows: ["variant01"] }),
    lips: [LABIOS_RETRATO],
    nose: ["variant01"],
  }).toDataUri();
  cache.set(clave, uri);
  return uri;
}

const FONDOS_ARENA = ["ede2d6", "dde8dd", "f1e4cf", "eadfd2"];

/** Avatares elegidos antes de existir los retratos: misma semilla, misma cara, paleta Arena. */
export function avatarDiceBearUri(seed: string, px = 64): string {
  const size = Math.max(24, Math.round(px));
  const clave = `legado:${seed || "persona"}:${size}`;
  const guardada = cache.get(clave);
  if (guardada) return guardada;
  const uri = createAvatar(notionists, {
    seed: seed || "persona",
    size,
    backgroundColor: FONDOS_ARENA,
    radius: 50,
  }).toDataUri();
  cache.set(clave, uri);
  return uri;
}
