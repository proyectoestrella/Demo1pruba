/**
 * scroll-progress — de MagicUI (https://magicui.design, MIT), el mismo
 * catálogo que sirve de origen a buena parte de 21st.dev.
 * Copiado del registro shadcn tal cual; los retoques del tema van en el uso.
 */
"use client";

import { motion, useScroll, type MotionProps } from "motion/react";

import { cn } from "@/lib/utils";

interface ScrollProgressProps extends Omit<React.HTMLAttributes<HTMLElement>, keyof MotionProps> {
  ref?: React.Ref<HTMLDivElement>;
}

export function ScrollProgress({ className, ref, ...props }: ScrollProgressProps) {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      ref={ref}
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-px origin-left bg-linear-to-r from-[#A97CF8] via-[#F38CB8] to-[#FDCC92]",
        className,
      )}
      style={{
        scaleX: scrollYProgress,
      }}
      {...props}
    />
  );
}
