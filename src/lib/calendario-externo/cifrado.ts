/**
 * Cifrado en reposo de las credenciales de calendario (refresh token de
 * Google, contraseña de aplicación de iCloud). AES-256-GCM: autenticado, así
 * que un blob manipulado falla al descifrar en vez de devolver basura.
 *
 * La clave viene de `CALENDARIO_CLAVE_CIFRADO` (32 bytes en base64 — se
 * genera una vez con `openssl rand -base64 32` y se pone en el entorno,
 * nunca en un fichero versionado). Sin ella, cifrar y descifrar lanzan: no
 * hay una "clave de desarrollo" hardcodeada por la que se pueda colar un
 * despliegue real sin la variable puesta.
 *
 * El blob de salida es un único string, para que quepa en una sola columna:
 * `v1.<iv en base64>.<tag en base64>.<ciphertext en base64>`.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITMO = "aes-256-gcm";
const VERSION = "v1";
const IV_BYTES = 12;

function clave(claveBase64?: string): Buffer {
  const b64 = claveBase64 ?? process.env.CALENDARIO_CLAVE_CIFRADO;
  if (!b64) throw new Error("Falta CALENDARIO_CLAVE_CIFRADO: no se puede cifrar ni descifrar ninguna credencial.");
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) {
    throw new Error(`CALENDARIO_CLAVE_CIFRADO debe decodificar a 32 bytes (AES-256); tiene ${buf.length}.`);
  }
  return buf;
}

export function cifrar(texto: string, claveBase64?: string): string {
  const k = clave(claveBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITMO, k, iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), cifrado.toString("base64")].join(".");
}

export function descifrar(blob: string, claveBase64?: string): string {
  const partes = blob.split(".");
  if (partes.length !== 4 || partes[0] !== VERSION) {
    throw new Error("Blob cifrado con formato desconocido.");
  }
  const [, ivB64, tagB64, ciphertextB64] = partes;
  const k = clave(claveBase64);
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(ALGORITMO, k, iv);
  decipher.setAuthTag(tag);
  const claro = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return claro.toString("utf8");
}

/** Cifra un objeto de credencial (se serializa a JSON antes). */
export function cifrarCredencial(credencial: object, claveBase64?: string): string {
  return cifrar(JSON.stringify(credencial), claveBase64);
}

/** Descifra y valida que el JSON tiene la forma de una credencial (`tipo`). */
export function descifrarCredencial<T extends { tipo: string }>(blob: string, claveBase64?: string): T {
  const json = JSON.parse(descifrar(blob, claveBase64));
  if (!json || typeof json !== "object" || typeof json.tipo !== "string") {
    throw new Error("La credencial descifrada no tiene la forma esperada.");
  }
  return json as T;
}

/** Genera una clave válida nueva (para desarrollo/tests, o para dársela a Tomás). */
export function generarClave(): string {
  return randomBytes(32).toString("base64");
}
