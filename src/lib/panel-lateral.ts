import { useSyncExternalStore } from "react";

/**
 * ¿Hay algún panel lateral derecho abierto (ficha, detalle de cita,
 * asistente)? En PC, el armazón «Arena» deja su hueco a la derecha para que
 * el panel empuje el contenido en vez de taparlo (DESIGN.md: paneles
 * opacos, sin velo). Cada panel se apunta al abrirse y se borra al cerrarse.
 */
let abiertos = 0;
const oyentes = new Set<() => void>();

function avisar() {
  for (const o of oyentes) o();
}

export function registrarPanelLateral(): () => void {
  abiertos += 1;
  avisar();
  return () => {
    abiertos = Math.max(0, abiertos - 1);
    avisar();
  };
}

export function hayPanelLateral(): boolean {
  return abiertos > 0;
}

export function useHayPanelLateral(): boolean {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o);
      return () => oyentes.delete(o);
    },
    hayPanelLateral,
    () => false,
  );
}

/** Ancho por defecto del panel lateral en PC; el hueco que deja el armazón es el mismo. */
export const ANCHO_PANEL_LATERAL = 440;
/** Límites al arrastrar el borde (9e): ni más estrecho que esto ni más del 70 % de la ventana. */
export const ANCHO_PANEL_MINIMO = 360;
export const FRACCION_PANEL_MAXIMA = 0.7;

/** Ancho que corresponde a soltar el borde izquierdo en `x`, dentro de los límites. */
export function anchoDesdeBorde(x: number, anchoVentana: number): number {
  const maximo = Math.max(ANCHO_PANEL_MINIMO, Math.round(anchoVentana * FRACCION_PANEL_MAXIMA));
  return Math.round(Math.min(maximo, Math.max(ANCHO_PANEL_MINIMO, anchoVentana - x)));
}

const CLAVE = (panel: string) => `sishow-ancho-panel:${panel}`;

/** El ancho recordado de un panel (o el de por defecto), acotado a la ventana de ahora. */
export function anchoGuardado(panel: string, anchoVentana: number): number {
  let g = NaN;
  try {
    g = Number(window.localStorage.getItem(CLAVE(panel)));
  } catch {
    /* sin almacenamiento */
  }
  if (!Number.isFinite(g) || g <= 0) return ANCHO_PANEL_LATERAL;
  return anchoDesdeBorde(anchoVentana - g, anchoVentana);
}

export function guardarAncho(panel: string, ancho: number | null) {
  try {
    if (ancho === null) window.localStorage.removeItem(CLAVE(panel));
    else window.localStorage.setItem(CLAVE(panel), String(ancho));
  } catch {
    /* solo dura esta visita */
  }
}

/** Fija el ancho en la variable CSS que leen el panel y el hueco del armazón. */
export function aplicarAncho(ancho: number) {
  document.documentElement.style.setProperty("--ancho-panel", `${ancho}px`);
}
