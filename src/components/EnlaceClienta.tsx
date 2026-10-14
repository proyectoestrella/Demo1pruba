import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFichas } from "@/lib/use-fichas";

/**
 * El nombre (o el avatar) de una clienta que abre su ficha desde donde esté.
 * Para sitios donde la fila entera ya es clicable (abre la cita): detiene el
 * clic para que no abra las dos cosas.
 */
export function EnlaceClienta({ clientId, children, className }: { clientId: string; children: ReactNode; className?: string }) {
  const { abrirClienta } = useFichas();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        abrirClienta(clientId);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn("rounded-sm text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary", className)}
    >
      {children}
    </button>
  );
}
