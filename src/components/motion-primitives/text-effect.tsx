/**
 * TextEffect — primitiva de motion usada por los bloques de Tailark
 * (https://github.com/tailark/blocks, MIT). Anima un texto entrando por
 * caracteres, palabras o líneas.
 *
 * Reducido a los presets que realmente usamos aquí (`fade-in-blur`, `fade`,
 * `slide`); el original trae unos cuantos más.
 */
import * as React from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";

type PerType = "word" | "char" | "line";
type PresetType = "fade-in-blur" | "fade" | "slide";

const PRESETS: Record<PresetType, { container: Variants; item: Variants }> = {
  "fade-in-blur": {
    container: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
    },
    item: {
      hidden: { opacity: 0, y: 20, filter: "blur(12px)" },
      visible: { opacity: 1, y: 0, filter: "blur(0px)" },
    },
  },
  fade: {
    container: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
    },
    item: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  },
  slide: {
    container: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
    },
    item: { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } },
  },
};

function splitText(text: string, per: PerType) {
  if (per === "line") return text.split("\n");
  if (per === "char") return text.split("");
  // Conserva el espacio final de cada palabra para no perder el interletrado.
  return text.split(/(\s+)/).filter((s) => s.length > 0);
}

export interface TextEffectProps {
  children: string;
  per?: PerType;
  as?: React.ElementType;
  preset?: PresetType;
  /** Retardo inicial en segundos. */
  delay?: number;
  /** Escala la separación entre segmentos (1 = la del preset). */
  speedSegment?: number;
  className?: string;
}

export function TextEffect({
  children,
  per = "word",
  as: Tag = "p",
  preset = "fade-in-blur",
  delay = 0,
  speedSegment = 1,
  className,
}: TextEffectProps) {
  const segments = splitText(children, per);
  const { container, item } = PRESETS[preset];
  const MotionTag = motion.create(Tag as React.ElementType);

  const containerVariants: Variants = {
    ...container,
    visible: {
      ...(container.visible as object),
      transition: { staggerChildren: 0.05 / speedSegment, delayChildren: delay },
    },
  };

  return (
    <AnimatePresence>
      <MotionTag
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className={className}
      >
        {/* El texto completo queda accesible; los segmentos animados son decorativos. */}
        <span className="sr-only">{children}</span>
        <span aria-hidden="true">
          {segments.map((segment, i) => (
            <motion.span
              key={`${segment}-${i}`}
              variants={item}
              transition={{ duration: 0.3 }}
              className={per === "line" ? "block" : "inline-block whitespace-pre"}
            >
              {segment}
            </motion.span>
          ))}
        </span>
      </MotionTag>
    </AnimatePresence>
  );
}
