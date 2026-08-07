/**
 * SpotlightCard — adaptado de React Bits (https://github.com/DavidHDev/react-bits, MIT).
 * Un halo radial sigue al cursor dentro de la tarjeta.
 *
 * Cambios respecto al original: el color por defecto sale del token `--primary`
 * del tema en vez de un rgba fijo, para que funcione en claro y en oscuro.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Color del halo. Cualquier valor CSS válido. */
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className,
  spotlightColor = "color-mix(in oklab, var(--color-primary) 22%, transparent)",
  ...props
}: SpotlightCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = React.useState(0);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spotlight-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spotlight-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-500 motion-reduce:hidden"
        style={{
          opacity,
          background: `radial-gradient(circle 220px at var(--spotlight-x, 50%) var(--spotlight-y, 50%), ${spotlightColor}, transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
}
