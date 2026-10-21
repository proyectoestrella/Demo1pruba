import { History } from "lucide-react";
import { useState } from "react";
import { HistorialCambios } from "@/components/HistorialCambios";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePermisos } from "@/lib/accesos-panel";
import { puede } from "@/lib/permisos";
import { cn } from "@/lib/utils";

/**
 * «Historial de cambios» al alcance de TODAS las personas del salón (cada una
 * ve y deshace lo suyo; la gerente, lo de todas), sin pasar por Ajustes, que
 * una estilista no tiene. Botón en la cabecera + hoja lateral (a pantalla
 * completa en el móvil).
 */
export function BotonHistorial({ className }: { className?: string }) {
  const [abierto, setAbierto] = useState(false);
  const permisos = usePermisos();
  if (!puede(permisos, "historial.ver")) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Historial de cambios"
        aria-label="Historial de cambios"
        data-testid="abrir-historial"
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full border border-input/70 bg-card/70 text-cafe-medio hover:bg-nata",
          className,
        )}
      >
        <History className="size-[18px]" strokeWidth={1.6} />
      </button>
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent side="right" panel="historial" className="flex w-full flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border/60 px-4 py-4 text-left">
            <SheetTitle className="text-lg font-extrabold">Historial de cambios</SheetTitle>
            <SheetDescription>Quién cambió qué, cuándo y desde qué aparato. Puedes deshacerlo aquí.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(24px+var(--seguro-abajo))]">{abierto && <HistorialCambios />}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
