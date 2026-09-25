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

/** Ancho del panel lateral en PC; el hueco que deja el armazón es el mismo. */
export const ANCHO_PANEL_LATERAL = 440;
