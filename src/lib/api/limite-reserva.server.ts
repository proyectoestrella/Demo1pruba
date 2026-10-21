import { createHash } from "node:crypto";
import { getRequestHeader } from "@tanstack/react-start/server";

const VENTANA_MS = 10 * 60_000;
const MAX_INTENTOS = 12;
const MAX_CLAVES = 10_000;

type Ventana = { desde: number; intentos: number };
const ventanas = new Map<string, Ventana>();

/**
 * Toma la IP añadida por el proxy, nunca un valor enviado dentro del payload.
 * En una cadena X-Forwarded-For usamos el último salto: es el que añade la
 * infraestructura más cercana al servidor y evita fiarse del primer valor.
 */
export function ipDeCabeceras(cabecera: (nombre: string) => string | undefined): string | null {
  const vercel = cabecera("x-vercel-forwarded-for")?.split(",").at(-1)?.trim();
  const forwarded = cabecera("x-forwarded-for")?.split(",").at(-1)?.trim();
  const real = cabecera("x-real-ip")?.trim();
  const ip = vercel || forwarded || real;
  return ip && ip.length <= 64 ? ip : null;
}

/**
 * Límite de ráfaga por IP y salón. La IP se conserva solo como hash en
 * memoria y nunca se escribe ni se registra. En serverless es defensa por
 * instancia; los topes persistentes por salón/teléfono siguen aplicándose.
 */
export function admiteIntentoReserva(
  salonSlug: string,
  ip: string | null,
  ahora = Date.now(),
): boolean {
  if (!ip) return true;
  const huella = createHash("sha256").update(ip).digest("base64url");
  const clave = `${salonSlug}:${huella}`;
  const previa = ventanas.get(clave);
  if (!previa || ahora - previa.desde >= VENTANA_MS) {
    ventanas.set(clave, { desde: ahora, intentos: 1 });
  } else {
    previa.intentos += 1;
    if (previa.intentos > MAX_INTENTOS) return false;
  }

  if (ventanas.size > MAX_CLAVES) {
    for (const [k, v] of ventanas) {
      if (ahora - v.desde >= VENTANA_MS) ventanas.delete(k);
      if (ventanas.size <= MAX_CLAVES) break;
    }
    while (ventanas.size > MAX_CLAVES) ventanas.delete(ventanas.keys().next().value as string);
  }
  return true;
}

export function admiteReservaPublicaPorIp(salonSlug: string): boolean {
  const ip = ipDeCabeceras((nombre) => getRequestHeader(nombre) ?? undefined);
  return admiteIntentoReserva(salonSlug, ip);
}

