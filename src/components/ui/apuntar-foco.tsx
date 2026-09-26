import { useState } from "react";

/** Ver `devolverFocoA` en lib/foco-de-vuelta: apunta quién tenía el foco al abrir. */
export function ApuntarFoco({ destino }: { destino: { current: HTMLElement | null } }) {
  useState(() => {
    const a = typeof document !== "undefined" ? document.activeElement : null;
    destino.current = a instanceof HTMLElement && a !== document.body ? a : null;
    return null;
  });
  return null;
}
