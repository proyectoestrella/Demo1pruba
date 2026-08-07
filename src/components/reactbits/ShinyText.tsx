/**
 * ShinyText — adaptado de React Bits (https://github.com/DavidHDev/react-bits, MIT).
 * Pasa un brillo por encima del texto en bucle. Inerte con
 * `prefers-reduced-motion` (ver `.rb-shiny-text` en src/styles.css).
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export interface ShinyTextProps {
  text: string;
  /** Segundos por pasada del brillo. */
  speed?: number;
  /**
   * Color del texto por debajo del brillo. Hay que pasarlo explícitamente
   * sobre fondos oscuros: el efecto vuelve el texto transparente, así que
   * `currentColor` no serviría de nada. Por defecto, el color de texto del tema.
   */
  baseColor?: string;
  className?: string;
}

export function ShinyText({ text, speed = 4, baseColor, className }: ShinyTextProps) {
  return (
    <span
      className={cn("rb-shiny-text", className)}
      style={
        {
          animationDuration: `${speed}s`,
          ...(baseColor ? { "--rb-shiny-base": baseColor } : {}),
        } as CSSProperties
      }
    >
      {text}
    </span>
  );
}
