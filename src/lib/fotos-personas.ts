/**
 * Fotos reales de personas (clientas y equipo): reglas puras, sin red.
 * Las comparten el navegador (recorte y compresión) y el servidor (validación).
 */

export const TIPOS_FOTO = ["equipo", "clienta"] as const;
export type TipoFoto = (typeof TIPOS_FOTO)[number];

/** Lado de la foto que se sube (cuadrada). */
export const LADO_FOTO_PX = 512;
/** Objetivo de peso tras comprimir en el navegador. */
export const OBJETIVO_BYTES = 150 * 1024;
/** Tope duro que acepta el servidor (el bucket admite 300 KB). */
export const MAX_BYTES_FOTO = 200 * 1024;
/** Fotos que se conservan por persona (la activa y las anteriores). */
export const MAX_FOTOS_POR_PERSONA = 10;
/** La URL firmada dura una hora; el navegador la renueva antes. */
export const VIGENCIA_URL_S = 3600;
export const CACHE_URL_MS = 50 * 60_000;

export type MimeFoto = "image/webp" | "image/jpeg" | "image/png";
const EXTENSION: Record<MimeFoto, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

export const carpetaDeTipo = (tipo: TipoFoto): string => (tipo === "equipo" ? "equipo" : "clientas");
export const claveFoto = (tipo: TipoFoto, id: string): string => `${tipo}:${id}`;

export function esTipoFoto(v: unknown): v is TipoFoto {
  return v === "equipo" || v === "clienta";
}

/** El id de persona entra en una ruta de almacenamiento: nada de `/`, `..` ni espacios raros. */
export function idPersonaValido(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,119}$/.test(v) && !v.includes("..");
}

export function slugValido(v: unknown): v is string {
  return typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/i.test(v);
}

/** Qué formato son estos bytes, mirando la firma (no se fía del nombre ni del tipo que diga el cliente). */
export function mimeDeBytes(b: Uint8Array): MimeFoto | null {
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  return null;
}

export type ValidacionFoto =
  | { ok: true; mime: MimeFoto; bytes: Uint8Array }
  | { ok: false; motivo: "vacia" | "grande" | "formato" };

export function validarBytesFoto(bytes: Uint8Array): ValidacionFoto {
  if (bytes.length === 0) return { ok: false, motivo: "vacia" };
  if (bytes.length > MAX_BYTES_FOTO) return { ok: false, motivo: "grande" };
  const mime = mimeDeBytes(bytes);
  if (!mime) return { ok: false, motivo: "formato" };
  return { ok: true, mime, bytes };
}

export const MENSAJE_VALIDACION: Record<"vacia" | "grande" | "formato", string> = {
  vacia: "La foto está vacía. Prueba con otra.",
  grande: "La foto pesa demasiado. Prueba con otra o más pequeña.",
  formato: "Ese formato no vale. Usa una foto JPG, PNG o WebP.",
};

export function rutaFoto(slug: string, tipo: TipoFoto, personaId: string, uuid: string, mime: MimeFoto): string {
  return `${slug}/${carpetaDeTipo(tipo)}/${personaId}/${uuid}.${EXTENSION[mime]}`;
}

export function bytesDeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function base64DeBytes(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Recorte cuadrado centrado de una imagen w×h: origen y lado. */
export function recorteCuadrado(w: number, h: number): { sx: number; sy: number; lado: number } {
  const lado = Math.min(w, h);
  return { sx: Math.floor((w - lado) / 2), sy: Math.floor((h - lado) / 2), lado };
}
