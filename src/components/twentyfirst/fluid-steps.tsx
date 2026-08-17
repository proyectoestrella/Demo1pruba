/**
 * FluidSteps — adaptado de 21st.dev (@anurag-mishra22/progress-indicator, id 20),
 * traído con la cuenta de pago vía su MCP.
 *
 * La idea original: en vez de una barra que se rellena, una píldora que crece
 * por detrás de los puntos y va engullendo los pasos ya completados.
 *
 * El original está cableado a 3 pasos, con colores fijos (verde y azul) y
 * anchos a ojo en píxeles (24/60/96). Aquí va generalizado a N pasos y con los
 * tokens del tema. Para que el ancho de la píldora cuadre siempre con los
 * puntos, la medida del punto, el hueco y el margen se declaran UNA vez como
 * variables y se usan tanto en el layout como en el cálculo: si se tocan a
 * mano en las clases, la píldora se descuadra.
 */
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const DOT = 8; // px — tamaño del punto
const GAP = 12; // px — hueco entre puntos
const PAD = 6; // px — cuánto sobresale la píldora por cada lado

/** Ancho que debe tener la píldora para cubrir `count` puntos. */
function pillWidth(count: number) {
  if (count <= 0) return 0;
  return count * DOT + (count - 1) * GAP + PAD * 2;
}

export interface FluidStepsProps {
  /** Paso actual, empezando en 1. */
  step: number;
  /** Total de pasos. */
  total: number;
  className?: string;
}

export function FluidSteps({ step, total, className }: FluidStepsProps) {
  const reduced = useReducedMotion();
  const clamped = Math.min(Math.max(step, 1), total);

  return (
    <div
      className={cn("relative flex items-center", className)}
      style={{ gap: `${GAP}px` }}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={clamped}
      aria-label={`Paso ${clamped} de ${total}`}
    >
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full bg-primary"
        style={{ left: -PAD, height: DOT + PAD * 2 }}
        initial={false}
        animate={{ width: pillWidth(clamped) }}
        transition={
          reduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 20, mass: 0.8 }
        }
      />
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "relative z-10 rounded-full transition-colors duration-300",
            i < clamped ? "bg-primary-foreground" : "bg-muted-foreground/40",
          )}
          style={{ width: DOT, height: DOT }}
        />
      ))}
    </div>
  );
}
