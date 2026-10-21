import type { ReactNode } from "react";
import { useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CalendarDays, ChevronLeft, PanelRight, PinOff, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { devolverFocoA } from "@/lib/foco-de-vuelta";
import { fijarModoFicha, type TipoFicha } from "@/lib/ficha-preferencia";
import { usePresentacionFicha } from "@/hooks/use-presentacion-ficha";
import { ApuntarFoco } from "@/components/ui/apuntar-foco";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const ETIQUETA: Record<TipoFicha, { texto: string; panel: string }> = {
  clienta: { texto: "Clienta", panel: "ficha" },
  cita: { texto: "Cita", panel: "detalle-cita" },
};

export interface FichaContenedorProps {
  tipo: TipoFicha;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nombre accesible de la ventana («Ficha de María», «Cita de María»). */
  titulo: string;
  descripcion?: string;
  /** Viene de otra ficha: enseña «Volver» a la izquierda. */
  onVolver?: () => void;
  children: ReactNode;
}

/**
 * La pieza común de las fichas de clienta y de cita.
 *
 * - En escritorio abre CENTRADA, como pop-up (hasta 800 px, fondo atenuado,
 *   Esc y clic fuera cierran, el foco queda dentro). Arriba a la derecha, el
 *   icono «Anclar» la pasa al lateral derecho de siempre; se recuerda por
 *   tipo de ficha, y con el mismo icono se vuelve al centro.
 * - En móvil es siempre una hoja a pantalla completa; por debajo de 1024 px
 *   la agenda no cabe al lado, así que no se ofrece anclar.
 * - La barra de arriba dice QUÉ es: círculo + «Clienta» para una persona,
 *   cuadrado + «Cita» para un evento (guía de diseño §4: nunca la misma
 *   cabecera para las dos).
 */
export function FichaContenedor({
  tipo,
  open,
  onOpenChange,
  titulo,
  descripcion,
  onVolver,
  children,
}: FichaContenedorProps) {
  const { presentacion, modo, puedeAnclar } = usePresentacionFicha(tipo);
  const antes = useRef<HTMLElement | null>(null);
  const meta = ETIQUETA[tipo];
  const Icono = tipo === "clienta" ? User : CalendarDays;

  const barra = (
    <div
      className="flex h-[66px] shrink-0 items-center gap-2 border-b border-border bg-perla pr-[124px] pl-5"
      data-ficha-barra={tipo}
    >
      {onVolver && (
        <button
          type="button"
          onClick={onVolver}
          className="-ml-2 inline-flex h-9 items-center gap-0.5 rounded-full pr-3 pl-1.5 text-[13px] font-bold text-cafe-medio hover:bg-nata focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" strokeWidth={1.8} aria-hidden="true" />
          Volver
        </button>
      )}
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center bg-arena text-cafe-medio",
          tipo === "clienta" ? "rounded-full" : "rounded-lg",
        )}
        aria-hidden="true"
      >
        <Icono className="size-4" strokeWidth={1.7} />
      </span>
      <span className="text-[12px] font-extrabold tracking-[0.08em] text-cafe-medio uppercase">
        {meta.texto}
      </span>
    </div>
  );

  const anclar = puedeAnclar && (
    <button
      type="button"
      onClick={() => fijarModoFicha(tipo, modo === "lateral" ? "centrada" : "lateral")}
      aria-label={modo === "lateral" ? "Volver al centro" : "Anclar a la derecha"}
      title={
        modo === "lateral" ? "Volver al centro" : "Anclar a la derecha: la agenda queda a la vista"
      }
      className="absolute top-3.5 right-[66px] z-10 grid size-[42px] cursor-pointer place-items-center rounded-full border border-input bg-card text-cafe-medio transition-colors hover:bg-nata focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {modo === "lateral" ? (
        <PinOff className="size-[18px]" strokeWidth={1.6} />
      ) : (
        <PanelRight className="size-[18px]" strokeWidth={1.6} />
      )}
    </button>
  );

  const textos = (
    <>
      <DialogPrimitive.Title className="sr-only">{titulo}</DialogPrimitive.Title>
      <DialogPrimitive.Description className="sr-only">
        {descripcion ?? titulo}
      </DialogPrimitive.Description>
    </>
  );

  if (presentacion === "centrada") {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-cafe/35 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            data-ficha={tipo}
            data-presentacion="centrada"
            onCloseAutoFocus={devolverFocoA(antes)}
            // El foco entra en la ventana (para que Tab empiece dentro) sin caer en un botón.
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
            }}
            tabIndex={-1}
            className="outline-none fixed top-1/2 left-1/2 z-50 flex max-h-[min(94dvh,960px)] w-[min(800px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden contenedor-flotante bg-background duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <ApuntarFoco destino={antes} />
            {textos}
            {barra}
            {anclar}
            <DialogPrimitive.Close className="absolute top-3.5 right-4 z-10 grid size-[42px] cursor-pointer place-items-center rounded-full border border-input bg-card text-cafe-medio transition-colors hover:bg-nata focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <X className="size-[18px]" strokeWidth={1.6} />
              <span className="sr-only">Cerrar</span>
            </DialogPrimitive.Close>
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        panel={meta.panel}
        data-ficha={tipo}
        data-presentacion={presentacion}
        className="flex w-full flex-col gap-0 overflow-hidden p-0"
      >
        {textos}
        {barra}
        {anclar}
        {children}
      </SheetContent>
    </Sheet>
  );
}
