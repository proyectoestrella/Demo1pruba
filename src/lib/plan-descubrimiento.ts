/**
 * Estado efímero de las tarjetas de plan. Va en sessionStorage, no en el
 * perfil: una dueña puede cerrar el aviso durante esta visita sin que nadie
 * cambie su plan ni que se conserve como dato de su salón.
 */
import { FUNCIONES_POR_PLAN, type FuncionPlan } from "./plan";

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

/** Marca la primera tarjeta visible, si la sesión aún no destacó otra. */
export function destacarFuncionPlan(funcion: FuncionPlan, almacen?: Storage | null): boolean {
  const actual = leerDescubrimientoPlan(almacen);
  if (actual.haDestacado || actual.destacada || actual.descartadas.includes(funcion)) return false;
  guardar({ ...actual, destacada: funcion, haDestacado: true }, almacen);
  return true;
}

/** La tarjeta permanece disponible, pero deja de destacarse durante esta sesión. */
export function descartarFuncionPlan(funcion: FuncionPlan, almacen?: Storage | null): void {
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
