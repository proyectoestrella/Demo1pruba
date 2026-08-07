/**
 * CountUp — adaptado de React Bits (https://github.com/DavidHDev/react-bits, MIT).
 * Anima un número desde `from` hasta `to` la primera vez que entra en pantalla.
 *
 * Cambios respecto al original:
 *  - formateo delegado a `format` (necesitamos "€1.234" y "87%", no solo dígitos)
 *  - respeta `prefers-reduced-motion`: muestra el valor final sin animar
 *  - red de seguridad: si la animación no llega a su destino a tiempo, el
 *    componente escribe el valor final igualmente. Esto NO es decorativo — el
 *    muelle de motion avanza con `requestAnimationFrame`, que el navegador
 *    detiene en pestañas en segundo plano, y sin la red un KPI se quedaría
 *    enseñando "0 €" en vez de la cifra real. Un número mal no es una
 *    animación que falta: es un dato falso.
 */
import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";

export interface CountUpProps {
  to: number;
  from?: number;
  /** Retardo antes de arrancar, en segundos. */
  delay?: number;
  /** Duración aproximada, en segundos. */
  duration?: number;
  className?: string;
  /** Formateador del valor intermedio. Por defecto, entero con separador español. */
  format?: (value: number) => string;
}

/**
 * Desde el montaje, tiempo que se le da a la animación antes de escribir el
 * valor final por las bravas. Lo bastante largo para que a un elemento visible
 * le dé tiempo a contar, y lo bastante corto para que nadie llegue a leer un
 * cero que no es cierto. Lo que quede por debajo del pliegue y se visite más
 * tarde aparecerá ya con su cifra, sin contar: es una degradación aceptable.
 */
const SETTLE_AFTER_MS = 2500;

export function CountUp({
  to,
  from = 0,
  delay = 0,
  duration = 1.6,
  className,
  format = (v) => Math.round(v).toLocaleString("es"),
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px" });
  const motionValue = useMotionValue(from);
  const [text, setText] = useState(() => format(from));
  /** Una vez fijado el valor final, se ignora lo que siga emitiendo el muelle. */
  const settled = useRef(false);

  const spring = useSpring(motionValue, {
    damping: 20 + 40 * (1 / duration),
    stiffness: 100 * (1 / duration),
  });

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const settle = () => {
    settled.current = true;
    setText(format(to));
  };

  // Arranque normal: al entrar en pantalla.
  useEffect(() => {
    if (!inView || reduced) return;
    const start = setTimeout(() => motionValue.set(to), delay * 1000);
    return () => clearTimeout(start);
  }, [inView, to, delay, motionValue, reduced]);

  // Red de seguridad, deliberadamente NO condicionada a `inView`: si el
  // navegador no entrega frames, ni IntersectionObserver ni el muelle llegan a
  // dispararse, así que el efecto de arriba no salvaría el número.
  useEffect(() => {
    // Un `to` nuevo (una cita recién creada mueve los KPIs) vuelve a abrir la
    // puerta al muelle: si no, tras el primer asentamiento la cifra se
    // quedaría congelada para siempre.
    settled.current = false;
    if (reduced) {
      settle();
      return;
    }
    const guard = setTimeout(settle, SETTLE_AFTER_MS);
    return () => clearTimeout(guard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, reduced]);

  useEffect(() => {
    if (reduced) return;
    return spring.on("change", (latest: number) => {
      if (settled.current) return;
      setText(format(latest));
    });
  }, [spring, format, reduced]);

  // Valor final accesible para lectores de pantalla; el número animado es decorativo.
  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{format(to)}</span>
    </span>
  );
}
