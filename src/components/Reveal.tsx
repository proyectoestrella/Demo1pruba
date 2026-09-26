import * as React from "react";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

export interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Retraso escalonado en ms (máximo 180), solo cuando el bloque entra. */
  delay?: number;
}

/**
 * Envoltorio de entrada suave (lote 17): fundido desde 12 px más abajo, 480 ms
 * con curva de salida, una sola vez. El contenido nace VISIBLE (ver useReveal):
 * solo se oculta, para entrar, lo que empieza por debajo de la pantalla.
 */
export function Reveal({ className, style, delay = 0, ...props }: RevealProps) {
  const { ref, visible, armado } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        armado &&
          "transition-[opacity,transform] duration-[480ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        className,
      )}
      style={{ transitionDelay: visible && armado ? `${Math.min(delay, 180)}ms` : "0ms", ...style }}
      {...props}
    />
  );
}
