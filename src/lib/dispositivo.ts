/**
 * Identidad del aparato desde el que se hace un cambio (historial de cambios).
 *
 * - `dispositivoId`: un uuid estable guardado en localStorage. Sirve para el
 *   filtro «Solo este dispositivo». Si el almacenamiento no está disponible
 *   (navegación privada, SSR), se usa uno de la sesión: nunca lanza.
 * - `nombreDeDispositivo`: «iPhone · Safari», «Windows · Chrome»… a partir del
 *   user-agent. Es una etiqueta legible, no una huella: no distingue dos
 *   iPhone entre sí (para eso está el id).
 */
const CLAVE = "peluchic.dispositivo-id";
let enMemoria: string | null = null;

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `disp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function dispositivoId(): string {
  if (enMemoria) return enMemoria;
  try {
    const guardado = globalThis.localStorage?.getItem(CLAVE);
    if (guardado && guardado.length >= 8) return (enMemoria = guardado);
    const nuevo = uuid();
    globalThis.localStorage?.setItem(CLAVE, nuevo);
    return (enMemoria = nuevo);
  } catch {
    return (enMemoria = uuid());
  }
}

/** Solo para pruebas. */
export function olvidarDispositivoEnMemoria() {
  enMemoria = null;
}

export function nombreLegibleDeDispositivo(ua: string | undefined | null): string {
  const s = ua ?? "";
  if (!s) return "Dispositivo";
  const aparato = /iPhone/i.test(s)
    ? "iPhone"
    : /iPad/i.test(s)
      ? "iPad"
      : /Android/i.test(s)
        ? /Mobile/i.test(s) ? "Android" : "Tablet Android"
        : /Windows/i.test(s)
          ? "Windows"
          : /Macintosh|Mac OS X/i.test(s)
            ? "Mac"
            : /CrOS/i.test(s)
              ? "Chromebook"
              : /Linux/i.test(s)
                ? "Linux"
                : "Dispositivo";
  // Orden importa: Edge/Opera/Samsung/Chrome iOS se anuncian también como Chrome o Safari.
  const navegador = /EdgA?\/|Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /SamsungBrowser/.test(s)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(s)
          ? "Firefox"
          : /CriOS|Chrome\//.test(s)
            ? "Chrome"
            : /Safari\//.test(s)
              ? "Safari"
              : "";
  return navegador ? `${aparato} · ${navegador}` : aparato;
}

export function dispositivoActual(): { id: string; nombre: string } {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return { id: dispositivoId(), nombre: nombreLegibleDeDispositivo(ua) };
}
