import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LlegaConPlan } from "@/components/LlegaConPlan";
import { useTienePlan } from "@/lib/accesos-panel";
import type { FuncionPlan } from "@/lib/plan";

/**
 * Un botón suelto de una función que el plan no incluye (lote 13): se queda
 * con su nombre y, al pulsarlo, explica con qué plan llega. Nunca
 * deshabilitado sin decir por qué.
 */
export function BotonConPlan({ funcion, etiqueta, children }: { funcion: FuncionPlan; etiqueta: string; children: ReactNode }) {
  const incluida = useTienePlan(funcion);
  const [abierto, setAbierto] = useState(false);
  if (incluida) return <>{children}</>;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
        {etiqueta}
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-md border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{etiqueta}</DialogTitle>
          <DialogDescription className="sr-only">Esta función llega con otro plan.</DialogDescription>
          <LlegaConPlan funcion={funcion} className="bg-card" />
        </DialogContent>
      </Dialog>
    </>
  );
}
