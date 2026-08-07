/**
 * AnimatedGroup — primitiva de motion usada por los bloques de Tailark
 * (https://github.com/tailark/blocks, MIT). Anima a sus hijos en cascada.
 */
import * as React from "react";
import { motion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

const DEFAULT: { container: Variants; item: Variants } = {
  container: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  },
};

export interface AnimatedGroupProps {
  children: React.ReactNode;
  className?: string;
  variants?: { container?: Variants; item?: Variants };
  /** `false` anima al montar; `true` espera a que entre en pantalla. */
  whenInView?: boolean;
  as?: React.ElementType;
}

export function AnimatedGroup({
  children,
  className,
  variants,
  whenInView = false,
  as: Tag = "div",
}: AnimatedGroupProps) {
  const container = variants?.container ?? DEFAULT.container;
  const item = variants?.item ?? DEFAULT.item;
  const MotionTag = motion.create(Tag as React.ElementType);

  const animation = whenInView
    ? { whileInView: "visible", viewport: { once: true, amount: 0.2 } }
    : { animate: "visible" };

  return (
    <MotionTag initial="hidden" {...animation} variants={container} className={cn(className)}>
      {React.Children.map(children, (child, i) => (
        <motion.div key={i} variants={item}>
          {child}
        </motion.div>
      ))}
    </MotionTag>
  );
}
