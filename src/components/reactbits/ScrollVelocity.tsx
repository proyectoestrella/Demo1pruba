/**
 * ScrollVelocity — adaptado de React Bits (https://github.com/DavidHDev/react-bits, MIT).
 * Cinta de texto en bucle que acelera y cambia de sentido según la velocidad
 * del scroll. Simplificado a una sola fila (el original acepta varias).
 *
 * Con `prefers-reduced-motion` no se anima: se muestra una fila estática.
 */
import { useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { cn } from "@/lib/utils";

export interface ScrollVelocityProps {
  /** Trozos de texto que se repiten a lo largo de la cinta. */
  items: string[];
  /** Velocidad base en px/s. Negativa para ir hacia la derecha. */
  velocity?: number;
  /** Cuántas copias se renderizan para cubrir pantallas anchas. */
  numCopies?: number;
  className?: string;
  separator?: string;
}

function useElementWidth<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const update = () => ref.current && setWidth(ref.current.offsetWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ref]);
  return width;
}

/** Envuelve `value` dentro de [min, max) — el truco del bucle infinito del original. */
function wrap(min: number, max: number, value: number) {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

export function ScrollVelocity({
  items,
  velocity = 40,
  numCopies = 4,
  className,
  separator = "·",
}: ScrollVelocityProps) {
  const baseX = useMotionValue(0);
  const copyRef = useRef<HTMLSpanElement>(null);
  const copyWidth = useElementWidth(copyRef);
  const directionFactor = useRef(1);
  const reduced = useReducedMotion();

  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], { clamp: false });

  const x = useTransform(baseX, (v) => (copyWidth === 0 ? "0px" : `${wrap(-copyWidth, 0, v)}px`));

  useAnimationFrame((_t, delta) => {
    if (reduced) return;
    let moveBy = directionFactor.current * velocity * (delta / 1000);
    const factor = velocityFactor.get();
    if (factor < 0) directionFactor.current = -1;
    else if (factor > 0) directionFactor.current = 1;
    moveBy += directionFactor.current * moveBy * factor;
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div className={cn("relative w-full overflow-hidden", className)} aria-hidden="true">
      <motion.div className="flex w-max flex-nowrap" style={reduced ? undefined : { x }}>
        {Array.from({ length: numCopies }).map((_, copy) => (
          <span
            key={copy}
            // Solo la primera copia se mide: define el punto de reinicio del bucle.
            ref={copy === 0 ? copyRef : undefined}
            className="flex shrink-0 items-center gap-6 pr-6"
          >
            {items.map((item, i) => (
              <span key={`${item}-${i}`} className="flex items-center gap-6">
                {item}
                <span className="text-primary/60">{separator}</span>
              </span>
            ))}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
