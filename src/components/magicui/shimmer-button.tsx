/**
 * shimmer-button — de MagicUI (https://magicui.design, MIT), el mismo
 * catálogo que sirve de origen a buena parte de 21st.dev.
 *
 * Único cambio de fondo respecto al original: soporta `asChild`, para poder
 * usarlo como enlace. Un <button> dentro de un <a> es HTML inválido, y este
 * botón es el CTA principal del sitio, que tiene que seguir siendo un enlace
 * de verdad (clic con rueda, abrir en pestaña nueva, lectores de pantalla).
 *
 * Ojo con la implementación: NO vale un `Comp = asChild ? Slot : "button"`.
 * El botón pinta cuatro capas (chispa, contenido, brillo y fondo) y `Slot`
 * exige un hijo único, así que eso peta en cuanto se usa. Lo que se hace es
 * clonar el hijo metiéndole las capas dentro.
 */
import React, { type ComponentPropsWithoutRef, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  /** Renderiza el elemento hijo (un <Link>, típicamente) en vez de un <button>. */
  asChild?: boolean;
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

const ROOT_CLASSES = [
  "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden [border-radius:var(--radius)] border border-white/10 px-6 py-3 whitespace-nowrap text-white [background:var(--bg)]",
  "transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px",
];

/** La chispa que gira por detrás del borde. */
function Spark() {
  return (
    <div className={cn("-z-30 blur-[2px]", "@container-[size] absolute inset-0 overflow-visible")}>
      <div className="animate-shimmer-slide absolute inset-0 aspect-[1] h-[100cqh] rounded-none [mask:none]">
        <div className="animate-spin-around absolute -inset-full w-auto [translate:0_0] rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
      </div>
    </div>
  );
}

/** Brillo interior y fondo recortado, que van por encima y por debajo del texto. */
function Layers() {
  return (
    <>
      <div
        className={cn(
          "absolute inset-0 size-full",
          "rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f]",
          "transform-gpu transition-all duration-300 ease-in-out",
          "group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]",
          "group-active:shadow-[inset_0_-10px_10px_#ffffff3f]",
        )}
      />
      <div
        className={cn(
          "absolute inset-(--cut) -z-20 [border-radius:var(--radius)] [background:var(--bg)]",
        )}
      />
    </>
  );
}

export const ShimmerButton = React.forwardRef<HTMLElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "#ffffff",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "100px",
      background = "rgba(0, 0, 0, 1)",
      asChild = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const style = {
      "--spread": "90deg",
      "--shimmer-color": shimmerColor,
      "--radius": borderRadius,
      "--speed": shimmerDuration,
      "--cut": shimmerSize,
      "--bg": background,
    } as CSSProperties;

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{
        className?: string;
        style?: CSSProperties;
        children?: React.ReactNode;
      }>;
      return React.cloneElement(
        child,
        {
          ...props,
          ref,
          style: { ...style, ...child.props.style },
          className: cn(ROOT_CLASSES, className, child.props.className),
        } as never,
        // Con varios hijos, cloneElement los trata como lista: llevan key.
        <Spark key="spark" />,
        <React.Fragment key="content">{child.props.children}</React.Fragment>,
        <Layers key="layers" />,
      );
    }

    return (
      <button
        style={style}
        className={cn(ROOT_CLASSES, className)}
        ref={ref as React.Ref<HTMLButtonElement>}
        {...props}
      >
        <Spark />
        {children}
        <Layers />
      </button>
    );
  },
);

ShimmerButton.displayName = "ShimmerButton";
