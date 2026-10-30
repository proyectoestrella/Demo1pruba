/**
 * «¿Puedo entrar?» sin confundir un fallo pasajero con una baja.
 *
 * Al abrir el portátil tras horas, el token de acceso (1 h) está caducado y la
 * red puede tardar en volver. En ese instante el servidor puede contestar
 * `permitido: false` solo porque no ha podido verificar quién llama. Eso NO es
 * una revocación y jamás debe borrar la sesión del navegador.
 *
 * Regla: solo `motivo === "revocado"` (el servidor verificó la identidad y el
 * salón ya no la reconoce) es una baja. Cualquier otra negativa se reintenta
 * UNA vez tras forzar `refreshSession()`; si sigue sin ser una baja, se lanza
 * `AccesoNoVerificable` y quien llama decide no tocar la sesión.
 *
 * Excepción: `sin_sesion` tras el reintento SIN sesión guardada en el
 * navegador es una negativa firme (nunca entró, o auth-js ya la descartó):
 * se devuelve para que se vaya a /login. No hay nada que perder.
 */
export type RespuestaAcceso = { real: boolean; permitido: boolean; motivo?: string };

export class AccesoNoVerificable extends Error {
  constructor() {
    super("No se pudo verificar el acceso (sesión sin renovar o servidor sin respuesta).");
    this.name = "AccesoNoVerificable";
  }
}

/** ¿Esta respuesta es una baja explícita y verificada? */
export function esRevocacion(r: RespuestaAcceso): boolean {
  return r.real && !r.permitido && r.motivo === "revocado";
}

export async function accesoConReintento<T extends RespuestaAcceso>(
  preguntar: () => Promise<T>,
  refrescar: () => Promise<unknown>,
  haySesionLocal: () => boolean = () => true,
): Promise<T> {
  const noEsNegativaDudosa = (r: T) => !r.real || r.permitido || r.motivo === "revocado";
  let primera: T | null = null;
  try {
    primera = await preguntar();
    if (noEsNegativaDudosa(primera)) return primera;
  } catch {
    /* red caída o 5xx al despertar: se reintenta igual tras refrescar */
  }
  try {
    await refrescar();
  } catch {
    /* el refresco falla offline: se reintenta de todos modos */
  }
  const segunda = await preguntar().catch(() => null);
  if (segunda && noEsNegativaDudosa(segunda)) return segunda;
  if (segunda && segunda.motivo === "sin_sesion" && !haySesionLocal()) return segunda;
  throw new AccesoNoVerificable();
}
