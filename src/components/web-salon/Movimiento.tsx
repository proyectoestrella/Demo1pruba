import { useEffect, useState } from "react";
import { useReveal } from "@/hooks/use-reveal";
import { salidaSuave } from "@/lib/movimiento-panel";
import { cn } from "@/lib/utils";
import { notaEs } from "@/lib/web-publica";

/**
 * Movimiento de la web del salón (lote 18.6). Calma, una sola vez y solo lo
 * que entra desde abajo: lo que ya se ve al cargar (y todo con «menos
 * movimiento») nace en su estado final, sin parpadeos. Ver `useReveal`.
 */

/** Trazo de pincel en caramelo bajo un título: se dibuja al entrar en pantalla. */
export function TrazoTitulo({ className, centrado }: { className?: string; centrado?: boolean }) {
  const { ref, visible, armado } = useReveal<HTMLSpanElement>();
  return (
    <span ref={ref} aria-hidden="true" className={cn("block", centrado && "flex justify-center", className)}>
      <svg viewBox="0 0 160 14" className="ws-trazo h-3 w-24 md:w-32" data-dibujado={!armado || visible}>
        <path d="M3 9.5C38 3.8 80 3 157 7.2" pathLength={1} />
      </svg>
    </span>
  );
}

/**
 * La nota (4,5) sube desde 0 en 700 ms cuando la sección entra en pantalla.
 * El lector de pantalla oye solo el valor final.
 */
export function NotaQueSube({ valor, className }: { valor: number; className?: string }) {
  const { ref, visible, armado } = useReveal<HTMLSpanElement>();
  const [n, setN] = useState(valor);
  useEffect(() => {
    if (!armado) {
      setN(valor);
      return;
    }
    if (!visible) {
      setN(0);
      return;
    }
    const ini = performance.now();
    let id = 0;
    const paso = (t: number) => {
      const k = salidaSuave((t - ini) / 700);
      setN(k >= 1 ? valor : valor * k);
      if (k < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [armado, visible, valor]);
  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">{notaEs(Math.round(n * 10) / 10)}</span>
      <span className="sr-only">{notaEs(valor)}</span>
    </span>
  );
}
