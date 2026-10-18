/** Guardas puras de plan para funciones de servidor. */
import { NOMBRE_PLAN, FUNCIONES_POR_PLAN, planDe, tienePlan, type FuncionPlan } from "../plan";

export class PlanInsuficiente extends Error {
  readonly code = "PLAN_INSUFICIENTE";
  constructor(funcion: FuncionPlan, planActual: string) {
    const planNecesario = FUNCIONES_POR_PLAN[funcion];
    super(`Tu plan ${NOMBRE_PLAN[planActual as keyof typeof NOMBRE_PLAN] ?? "Básico"} no incluye esta función. Está disponible con el plan ${NOMBRE_PLAN[planNecesario]}.`);
    this.name = "PlanInsuficiente";
  }
}

/**
 * Una demo nunca se bloquea en servidor. Un salón real sin plan guardado es
 * Básico por prudencia, igual que `planDe` en toda la aplicación.
 */
export function exigirFuncionDePlan(
  perfil: { plan?: string | null },
  funcion: FuncionPlan,
  esDemo: boolean,
): void {
  if (esDemo) return;
  const plan = planDe(perfil, false);
  if (!tienePlan(plan, funcion)) throw new PlanInsuficiente(funcion, plan);
}
