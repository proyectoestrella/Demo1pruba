import type { SalonProfile } from "./mock/types";
import type { DemoProfile } from "./demo-profile";

export type PerfilGuardado = SalonProfile & Partial<Pick<DemoProfile, "modulosOcultos">>;

/**
 * Puente para que las cabeceras y puertas de las rutas lean el perfil guardado
 * SIN importar la store (1700 líneas + demos + mock) en el chunk inicial de la
 * landing. La store se registra aquí al cargarse; mientras no esté cargada (SSR,
 * landing pública) devuelve `undefined`.
 */
let lector: (() => PerfilGuardado) | undefined;

export function registrarPerfilGuardado(fn: () => PerfilGuardado) {
  lector = fn;
}

export function perfilGuardado(): PerfilGuardado | undefined {
  return lector?.();
}
