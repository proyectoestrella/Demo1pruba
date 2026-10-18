/** Lee el plan de un salón real antes de exponer una función de pago. */
import type { FuncionPlan } from "../plan";
import { getSupabaseServerClient } from "../supabase.server";
import type { Acceso } from "./autorizacion";
import { exigirFuncionDePlan } from "./plan-guardas";

/**
 * Se llama después de `exigirAcceso`. Así un slug que no existe en `salons`
 * sigue siendo demo y conserva el comportamiento de venta sin restricciones.
 */
export async function exigirFuncionPlanEn(slug: string, funcion: FuncionPlan, acceso: Acceso): Promise<void> {
  if (acceso.tipo === "demo") return;
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("No se ha podido comprobar el plan de este salón.");
  const { data, error } = await supabase.from("salons").select("profile").eq("slug", slug).maybeSingle();
  if (error || !data) throw new Error("No se ha podido comprobar el plan de este salón.");
  exigirFuncionDePlan((data.profile ?? {}) as { plan?: string | null }, funcion, false);
}
