import { notionists } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

/**
 * Avatar local, determinista y apto para uso comercial.
 *
 * DiceBear y su implementación se distribuyen bajo MIT; el diseño
 * "Notionists" que empaqueta @dicebear/notionists es CC0 1.0 (véase su
 * LICENSE instalada). No se construye una URL: el SVG se genera dentro del
 * bundle y se sirve como data URI, también sin conexión.
 */
const FONDOS_ARENA = ["ede2d6", "dde8dd", "f1e4cf", "eadfd2"];

/** Una misma semilla siempre produce la misma cara y conserva la paleta Arena. */
export function avatarDiceBearUri(seed: string, px = 64): string {
  return createAvatar(notionists, {
    seed: [seed || "persona"],
    size: Math.max(24, Math.round(px)),
    backgroundColor: FONDOS_ARENA,
    radius: 50,
  }).toDataUri();
}
