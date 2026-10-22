import { useReveal } from "@/hooks/use-reveal";
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
 * La nota del salón (4,5), fija desde el primer pintado. Antes subía desde 0
 * al entrar en pantalla y, en móvil y en ordenador, se veía aparecer y
 * desaparecer (22-oct, PeluChic): ahora se enseña el valor final y nada más.
 */
export function NotaQueSube({ valor, className }: { valor: number; className?: string }) {
  return <span className={className}>{notaEs(valor)}</span>;
}
