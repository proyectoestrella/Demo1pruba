"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ANCHO_PANEL_LATERAL, anchoDesdeBorde, anchoGuardado, aplicarAncho, guardarAncho, registrarPanelLateral } from "@/lib/panel-lateral";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-cafe/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

/**
 * Se monta solo con el panel abierto: así el armazón sabe que tiene que
 * dejarle sitio, y el panel toma el ancho que tenía la última vez.
 */
function RegistroPanelLateral({ panel }: { panel?: string }) {
  React.useEffect(() => {
    aplicarAncho(panel ? anchoGuardado(panel, window.innerWidth) : ANCHO_PANEL_LATERAL);
    return registrarPanelLateral();
  }, [panel]);
  return null;
}

/**
 * Asa del borde izquierdo (lote 9e): se arrastra para ensanchar o estrechar el
 * panel, de 360 px al 70 % de la ventana. Pointer events y requestAnimationFrame
 * escribiendo una variable CSS: React no se vuelve a pintar por cada píxel.
 * Doble clic: vuelve al ancho por defecto. Al soltar, se recuerda por panel.
 */
function AsaAncho({ panel }: { panel: string }) {
  const marco = React.useRef(0);
  const ultimo = React.useRef(ANCHO_PANEL_LATERAL);
  const raiz = () => document.documentElement;
  const mover = (x: number) => {
    ultimo.current = anchoDesdeBorde(x, window.innerWidth);
    if (marco.current) return;
    marco.current = requestAnimationFrame(() => {
      marco.current = 0;
      aplicarAncho(ultimo.current);
    });
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Arrastra para cambiar el ancho del panel. Doble clic: ancho por defecto"
      title="Arrastra para cambiar el ancho · doble clic para volver al de siempre"
      tabIndex={0}
      className="group/asa absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize touch-none outline-none sm:block"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        raiz().dataset.arrastrandoPanel = "1";
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) mover(e.clientX);
      }}
      onPointerUp={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        delete raiz().dataset.arrastrandoPanel;
        guardarAncho(panel, ultimo.current);
      }}
      onDoubleClick={() => {
        aplicarAncho(ANCHO_PANEL_LATERAL);
        guardarAncho(panel, null);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const actual = parseFloat(getComputedStyle(raiz()).getPropertyValue("--ancho-panel")) || ANCHO_PANEL_LATERAL;
        const nuevo = anchoDesdeBorde(window.innerWidth - actual + (e.key === "ArrowLeft" ? -24 : 24), window.innerWidth);
        aplicarAncho(nuevo);
        guardarAncho(panel, nuevo);
      }}
    >
      <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-transparent transition-colors group-hover/asa:bg-salvia group-focus-visible/asa:bg-salvia group-active/asa:bg-hoja" />
    </div>
  );
}

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        // Paneles laterales «Arena»: opacos, borde lino, sombra suave en café
        // y 440 px en PC, donde empujan el contenido (sin sombra).
        right:
          "inset-y-0 right-0 h-full w-full border-l border-border shadow-[var(--sombra-panel)] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-[var(--ancho-panel,440px)] lg:shadow-none",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Nombre del panel lateral: con él se puede redimensionar y recuerda su ancho. */
  panel?: string;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, panel, ...props }, ref) => (
  <SheetPortal>
    {/* Sin velo en los paneles laterales: lo de detrás se queda a la vista tal
        cual (o se estrecha, en PC). Se cierran con la X, Esc o un clic fuera. */}
    <SheetOverlay className={side === "right" ? "bg-transparent" : "bg-cafe/30"} />
    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      {side === "right" && <RegistroPanelLateral panel={panel} />}
      {side === "right" && panel && <AsaAncho panel={panel} />}
      <SheetPrimitive.Close className="absolute top-3.5 right-4 grid size-[42px] place-items-center rounded-full border border-input bg-card text-cafe-medio cursor-pointer transition-colors hover:bg-nata focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none">
        <X className="size-[18px]" strokeWidth={1.6} />
        <span className="sr-only">Cerrar</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
