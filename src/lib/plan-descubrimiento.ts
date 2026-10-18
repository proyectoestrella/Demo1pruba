/**
 * Estado efímero de las tarjetas de plan. Va en sessionStorage, no en el
 * perfil: una dueña puede cerrar el aviso durante esta visita sin que nadie
 * cambie su plan ni que se conserve como dato de su salón.
 */
import { FUNCIONES_POR_PLAN, tienePlan, type FuncionPlan, type PlanSishow } from "./plan";

export const CLAVE_DESCUBRIMIENTO_PLAN = "sishow-descubrimiento-plan-v1";

export interface EstadoDescubrimientoPlan {
  /** Solo una tarjeta puede llamar la atención durante una sesión. */
  destacada: FuncionPlan | null;
  /** Conserva que ya hubo un aviso incluso después de cerrarlo. */
  haDestacado: boolean;
  /** «Ahora no» impide que esa función vuelva a llamar la atención. */
  descartadas: FuncionPlan[];
}

const VACIO: EstadoDescubrimientoPlan = { destacada: null, haDestacado: false, descartadas: [] };
const FUNCIONES = new Set(Object.keys(FUNCIONES_POR_PLAN) as FuncionPlan[]);

function esFuncionPlan(valor: unknown): valor is FuncionPlan {
  return typeof valor === "string" && FUNCIONES.has(valor as FuncionPlan);
}

export function leerDescubrimientoPlan(almacen?: Pick<Storage, "getItem"> | null): EstadoDescubrimientoPlan {
  try {
    const bruto = almacen?.getItem(CLAVE_DESCUBRIMIENTO_PLAN);
    if (!bruto) return VACIO;
    const valor = JSON.parse(bruto) as Partial<EstadoDescubrimientoPlan>;
    return {
      destacada: esFuncionPlan(valor.destacada) ? valor.destacada : null,
      haDestacado: valor.haDestacado === true || esFuncionPlan(valor.destacada),
      descartadas: Array.isArray(valor.descartadas) ? valor.descartadas.filter(esFuncionPlan) : [],
    };
  } catch {
    return VACIO;
  }
}

function guardar(estado: EstadoDescubrimientoPlan, almacen?: Pick<Storage, "setItem"> | null) {
  try {
    almacen?.setItem(CLAVE_DESCUBRIMIENTO_PLAN, JSON.stringify(estado));
  } catch {
    // Navegación privada o almacenamiento lleno: la tarjeta sigue siendo útil.
  }
}

/** Tras «Ahora no», esa función no vuelve a destacarse durante estos días. */
export const DIAS_SIN_DESTACAR = 30;
export const CLAVE_DESCARTES_PLAN = "sishow-descartes-plan-v1";
const MS_DIA = 24 * 60 * 60 * 1000;

function leerDescartes(almacen?: Pick<Storage, "getItem"> | null): Partial<Record<FuncionPlan, number>> {
  try {
    const bruto = almacen?.getItem(CLAVE_DESCARTES_PLAN);
    const valor = bruto ? (JSON.parse(bruto) as Record<string, unknown>) : {};
    const limpio: Partial<Record<FuncionPlan, number>> = {};
    for (const [k, v] of Object.entries(valor)) if (esFuncionPlan(k) && typeof v === "number") limpio[k] = v;
    return limpio;
  } catch {
    return {};
  }
}

/** ¿Dijo «Ahora no» a esta función hace menos de 30 días? (almacén duradero, p. ej. localStorage) */
export function descartadaRecientemente(funcion: FuncionPlan, duradero?: Pick<Storage, "getItem"> | null, ahora = Date.now()): boolean {
  const cuando = leerDescartes(duradero)[funcion];
  return cuando !== undefined && ahora - cuando < DIAS_SIN_DESTACAR * MS_DIA;
}

/** ¿Se le puede ofrecer esta función? No si ya la tiene su plan ni si la rechazó en la sesión. */
export function puedeOfrecerFuncion(funcion: FuncionPlan, plan: PlanSishow, rechazadas: readonly FuncionPlan[]): boolean {
  return !tienePlan(plan, funcion) && !rechazadas.includes(funcion);
}

/** Marca la primera tarjeta visible, si la sesión aún no destacó otra. */
export function destacarFuncionPlan(funcion: FuncionPlan, almacen?: Storage | null, duradero?: Pick<Storage, "getItem"> | null, ahora = Date.now()): boolean {
  const actual = leerDescubrimientoPlan(almacen);
  if (actual.haDestacado || actual.destacada || actual.descartadas.includes(funcion) || descartadaRecientemente(funcion, duradero, ahora)) return false;
  guardar({ ...actual, destacada: funcion, haDestacado: true }, almacen);
  return true;
}

/** La tarjeta permanece disponible, pero deja de destacarse durante esta sesión. */
export function descartarFuncionPlan(funcion: FuncionPlan, almacen?: Storage | null, duradero?: Pick<Storage, "getItem" | "setItem"> | null, ahora = Date.now()): void {
  if (duradero) {
    try {
      duradero.setItem(CLAVE_DESCARTES_PLAN, JSON.stringify({ ...leerDescartes(duradero), [funcion]: ahora }));
    } catch {
      // Sin almacenamiento duradero, solo vale para esta sesión.
    }
  }
  const actual = leerDescubrimientoPlan(almacen);
  guardar(
    {
      destacada: actual.destacada === funcion ? null : actual.destacada,
      haDestacado: actual.haDestacado,
      descartadas: actual.descartadas.includes(funcion) ? actual.descartadas : [...actual.descartadas, funcion],
    },
    almacen,
  );
}
