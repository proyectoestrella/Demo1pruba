import * as React from "react";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

export interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stagger delay in ms, applied only once the element becomes visible. */
  delay?: number;
}

/**
 * Reusable scroll-reveal wrapper: fades and lifts its children into place the
 * first time they enter the viewport. Discreet by design (short distance,
 * moderate duration) and fully inert under `prefers-reduced-motion: reduce`
 * (see useReveal — reduced-motion users get content shown immediately).
 */
export function Reveal({ className, style, delay = 0, ...props }: RevealProps) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
        visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        className,
      )}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms", ...style }}
      {...props}
    />
  );
}
