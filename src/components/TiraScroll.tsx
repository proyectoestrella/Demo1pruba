import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TiraScrollProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Tira horizontal que se desliza con el dedo, sin la barra de scroll gris del
 * sistema (que en la agenda del móvil salía con sus flechas justo debajo de
 * los días) y con un degradado de desvanecido en el borde que avisa de que
 * hay más a la derecha.
 *
 * El degradado solo se pinta mientras queda algo por ver: si la tira cabe
 * entera, o si ya estás al final, desaparece — así la pista significa algo en
 * vez de ser un adorno fijo.
 */
export function TiraScroll({ children, className }: TiraScrollProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hayMas, setHayMas] = useState(false);

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 2 px de holgura: el redondeo a subpíxel deja restos de 0,5 px que
    // mantendrían el degradado encendido para siempre al final de la tira.
    setHayMas(el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
  }, []);

  useEffect(() => {
    medir();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [medir, children]);

  return (
    <div className={cn("relative", className)}>
      <div ref={ref} onScroll={medir} className="sin-scrollbar flex gap-2 overflow-x-auto pb-1">
        {children}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-200",
          hayMas ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
