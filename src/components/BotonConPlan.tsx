import type { ReactNode } from "react";
import { LlegaConPlan } from "@/components/LlegaConPlan";
import { useTienePlan } from "@/lib/accesos-panel";
import type { FuncionPlan } from "@/lib/plan";

/**
 * Conserva la API de las acciones existentes, pero en una cuenta real enseña
 * la tarjeta contextual completa en vez de un botón que parece que falló.
 */
export function BotonConPlan({ funcion, children }: { funcion: FuncionPlan; etiqueta: string; children: ReactNode }) {
  const incluida = useTienePlan(funcion);
  return incluida ? <>{children}</> : <LlegaConPlan funcion={funcion} compacta />;
}
