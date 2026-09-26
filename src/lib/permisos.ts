/**
 * Quién puede ver y hacer qué dentro de un salón: la matriz declarativa de
 * roles (lote 8). La usan el SERVIDOR (guardas y recorte de datos) y la
 * PANTALLA (ocultar lo que no toca), así que no importa nada de ninguno de los
 * dos: es pura.
 *
 * Los ids de páginas y acciones son la lista ÚNICA acordada con FRONTEND
 * (docs/contrato-accesos.md). No se renombran: se añaden.
 *
 * Alcance por permiso: una estilista tiene `cita.*` y `dinero.ver-propio`
 * con alcance «propio», que solo vale para las citas de SU profesional
 * vinculada (employeeId). No hay ids duplicados para «lo mío».
 */

export type Rol = "gerente" | "subencargado" | "recepcion" | "estilista";
export const ROLES: readonly Rol[] = ["gerente", "subencargado", "recepcion", "estilista"];

export const PAGINAS = [
  "hoy", "calendario", "citas", "lista-espera", "clientas", "hoja", "equipo", "servicios", "mi-pagina",
  "caja", "ajustes", "ajustes.accesos", "ajustes.historial", "analitica", "marketing", "asistente", "demos",
] as const;
export type PaginaId = (typeof PAGINAS)[number];

export const ACCIONES = [
  "cita.ver-todas", "cita.crear", "cita.crear-para-otra", "cita.editar", "cita.mover", "cita.cancelar",
  "cita.confirmar-solicitud", "cita.rechazar-solicitud", "cita.marcar-asistencia", "cita.cobrar", "cita.recordar",
  "clienta.ver", "clienta.ver-todas", "clienta.crear", "clienta.editar", "clienta.borrar", "clienta.bloquear",
  "clienta.importar", "clienta.exportar",
  "senal.gestionar", "recargo.gestionar", "lista-espera.gestionar",
  "servicio.editar", "equipo.editar", "salon.editar", "web.editar", "web.publicar", "web.restaurar-version",
  "dinero.ver-propio", "dinero.ver-global", "analitica.ver", "marketing.usar", "exportar.excel",
  // Caja (lote 11): crear/cerrar/exportar/importar es solo gerente y
  // subencargado. La estilista sigue viendo lo suyo por `dinero.ver-propio`
  // (que ya existía), no por estas cuatro.
  "dinero.crear", "dinero.cerrar", "dinero.exportar", "dinero.importar",
  "accesos.gestionar", "historial.ver", "historial.deshacer-ajeno", "plan.gestionar", "datos.borrar",
] as const;
export type AccionId = (typeof ACCIONES)[number];

export type Alcance = "propio" | "todo";

/** Quién ha entrado al panel de un salón real: lo devuelve `accesoAlPanel`. */
export interface MiembroActual {
  /** Id del usuario: autoría del historial de cambios (lote 9). */
  userId: string;
  rol: Rol;
  employeeId: string | null;
  displayName: string | null;
}

export interface Permisos {
  rol: Rol;
  paginas: ReadonlySet<PaginaId>;
  /** Acción → alcance. Ausente = no permitida. */
  acciones: ReadonlyMap<AccionId, Alcance>;
  /** ¿Recibe las notas y avisos de las fichas? */
  notasClienta: boolean;
}


/**
 * La matriz, fila a fila, copiada de la acordada con FRONTEND
 * (AlmacenExterno › sishow-diseno › ux-accesos-y-roles.md §2.1 y §2.2).
 * «T» = alcance todo, «P» = propio, ausente = no.
 */
type Celda = "T" | "P" | "-";
const TABLA: Record<AccionId, [Celda, Celda, Celda, Celda]> = {
  //                            gerente subenc recepc estilista
  "cita.ver-todas":             ["T", "T", "T", "-"],
  "cita.crear":                 ["T", "T", "T", "P"],
  "cita.crear-para-otra":       ["T", "T", "T", "-"],
  "cita.editar":                ["T", "T", "T", "P"],
  "cita.mover":                 ["T", "T", "T", "P"],
  "cita.cancelar":              ["T", "T", "T", "P"],
  "cita.confirmar-solicitud":   ["T", "T", "T", "P"],
  "cita.rechazar-solicitud":    ["T", "T", "T", "P"],
  "cita.marcar-asistencia":     ["T", "T", "T", "P"],
  "cita.cobrar":                ["T", "T", "-", "P"],
  "cita.recordar":              ["T", "T", "T", "P"],
  "clienta.ver":                ["T", "T", "T", "P"],
  "clienta.ver-todas":          ["T", "T", "T", "-"],
  "clienta.crear":              ["T", "T", "T", "T"],
  "clienta.editar":             ["T", "T", "T", "P"],
  "clienta.borrar":             ["T", "-", "-", "-"],
  "clienta.bloquear":           ["T", "T", "-", "-"],
  "clienta.importar":           ["T", "T", "-", "-"],
  "clienta.exportar":           ["T", "-", "-", "-"],
  "senal.gestionar":            ["T", "T", "T", "P"],
  "recargo.gestionar":          ["T", "T", "-", "-"],
  "lista-espera.gestionar":     ["T", "T", "T", "-"],
  "servicio.editar":            ["T", "T", "-", "-"],
  "equipo.editar":              ["T", "T", "-", "-"],
  "salon.editar":               ["T", "T", "-", "-"],
  "web.editar":                 ["T", "T", "-", "-"],
  "web.publicar":               ["T", "T", "-", "-"],
  "web.restaurar-version":      ["T", "T", "-", "-"],
  "dinero.ver-propio":          ["T", "T", "-", "P"],
  "dinero.ver-global":          ["T", "-", "-", "-"],
  "dinero.crear":               ["T", "T", "-", "-"],
  "dinero.cerrar":              ["T", "T", "-", "-"],
  "dinero.exportar":            ["T", "T", "-", "-"],
  "dinero.importar":            ["T", "T", "-", "-"],
  "analitica.ver":              ["T", "T", "-", "-"],
  "marketing.usar":             ["T", "T", "-", "-"],
  "exportar.excel":             ["T", "-", "-", "-"],
  "accesos.gestionar":          ["T", "-", "-", "-"],
  "historial.ver":              ["T", "T", "-", "-"],
  "historial.deshacer-ajeno":   ["T", "T", "-", "-"],
  "plan.gestionar":             ["T", "-", "-", "-"],
  "datos.borrar":               ["T", "-", "-", "-"],
};
const COLUMNA: Record<Rol, number> = { gerente: 0, subencargado: 1, recepcion: 2, estilista: 3 };

const PAGINAS_DE: Record<Rol, PaginaId[]> = {
  gerente: PAGINAS.filter((p) => p !== "demos"),
  subencargado: PAGINAS.filter((p) => p !== "demos" && p !== "ajustes.accesos"),
  recepcion: ["hoy", "calendario", "citas", "lista-espera", "clientas", "hoja", "servicios", "asistente"],
  estilista: ["hoy", "calendario", "citas", "clientas", "hoja", "asistente"],
};

const CACHE = new Map<Rol, Permisos>();

export function permisosDe(rol: Rol): Permisos {
  let p = CACHE.get(rol);
  if (!p) {
    const acciones = new Map<AccionId, Alcance>();
    for (const a of ACCIONES) {
      const c = TABLA[a][COLUMNA[rol]];
      if (c === "T") acciones.set(a, "todo");
      else if (c === "P") acciones.set(a, "propio");
    }
    p = { rol, paginas: new Set(PAGINAS_DE[rol]), acciones, notasClienta: true };
    CACHE.set(rol, p);
  }
  return p;
}

/** Permisos de una demo por enlace: los de la gerente (no hay login). */
export const PERMISOS_DEMO: Permisos = permisosDe("gerente");

export function esRol(x: unknown): x is Rol {
  return typeof x === "string" && (ROLES as readonly string[]).includes(x);
}

/** Traduce el `rol` guardado (incluidos los valores antiguos) al rol vigente. */
export function rolVigente(guardado: string | null | undefined): Rol {
  if (esRol(guardado)) return guardado;
  // 'dueno' y 'encargado' eran los valores de antes del lote 8: mando completo.
  return "gerente";
}

export function alcance(p: Permisos, accion: AccionId): Alcance | null {
  return p.acciones.get(accion) ?? null;
}

/**
 * ¿Puede hacer esta acción? Con alcance «propio» hace falta decir sobre qué
 * profesional se hace, y solo vale si es la suya.
 */
export function puede(p: Permisos, accion: AccionId, sobre?: { employeeId?: string | null; miEmployeeId?: string | null }): boolean {
  const a = p.acciones.get(accion);
  if (!a) return false;
  if (a === "todo") return true;
  if (!sobre) return true; // pregunta genérica («¿tiene este botón?»): sí, sobre lo suyo
  return !!sobre.miEmployeeId && sobre.employeeId === sobre.miEmployeeId;
}

export function vePagina(p: Permisos, pagina: PaginaId): boolean {
  return p.paginas.has(pagina);
}

/**
 * Límite de roles distintos en uso según el plan: fuera de «Todo incluido»,
 * dos (normalmente gerente y estilista).
 */
export function rolesPermitidosPorPlan(plan: string | null | undefined): number {
  return plan === "todo-incluido" ? ROLES.length : 2;
}

/** ¿Cabe un miembro más con este rol, dados los roles ya en uso y el plan? */
export function cabeRol(rol: Rol, enUso: Rol[], plan: string | null | undefined): boolean {
  const distintos = new Set([...enUso, rol]);
  return distintos.size <= rolesPermitidosPorPlan(plan);
}
