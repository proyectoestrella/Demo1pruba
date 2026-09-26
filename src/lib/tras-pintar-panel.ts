import { startTransition, useEffect, useState } from "react";

/**
 * Lote 16: `false` en el primer pintado y `true` justo después, en una
 * transición. Sirve para que una pantalla pinte ya lo barato y calcule lo
 * caro (campañas, patrones) un fotograma después, sin bloquear el clic.
 */
export function useTrasPintar(): boolean {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => startTransition(() => setListo(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return listo;
}
