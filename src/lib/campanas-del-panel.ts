import type { Campana } from "./campanas";

/**
 * Las demos se calculan enteras en el navegador porque no tienen servidor.
 * En un salón real, en cambio, la pantalla solo pinta la lista que el
 * servidor ya recortó según el plan: `null` nunca se sustituye por un cálculo
 * local que pudiera reconstruir campañas no contratadas.
 */
export function campanasDelPanel(
  esSalonReal: boolean,
  campanasDelServidor: Campana[] | null,
  campanasDemo: Campana[],
): Campana[] {
  return esSalonReal ? (campanasDelServidor ?? []) : campanasDemo;
}
