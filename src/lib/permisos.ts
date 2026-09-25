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
  "ajustes", "ajustes.accesos", "ajustes.historial", "analitica", "marketing", "asistente", "demos",
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
  "accesos.gestionar", "historial.ver", "historial.deshacer-ajeno", "plan.gestionar", "datos.borrar",
] as const;
export type AccionId = (typeof ACCIONES)[number];

export type Alcance = "propio" | "todo";

export interface Permisos {
  rol: Rol;
  paginas: ReadonlySet<PaginaId>;
  /** Acción → alcance. Ausente = no permitida. */
  acciones: ReadonlyMap<AccionId, Alcance>;
  /** ¿Recibe las notas y avisos de las fichas? */
  notasClienta: boolean;
}

const TODAS_LAS_ACCIONES: AccionId[] = [...ACCIONES];

/** Acciones de agenda que una estilista tiene sobre SUS citas. */
const AGENDA_PROPIA: AccionId[] = [
  "cita.crear", "cita.editar", "cita.mover", "cita.cancelar", "cita.confirmar-solicitud", "cita.rechazar-solicitud",
  "cita.marcar-asistencia", "cita.cobrar", "cita.recordar", "senal.gestionar", "dinero.ver-propio",
];

type Definicion = { paginas: PaginaId[]; todo: AccionId[]; propio?: AccionId[]; notasClienta: boolean };

const MATRIZ: Record<Rol, Definicion> = {
  gerente: {
    paginas: PAGINAS.filter((p) => p !== "demos"),
    todo: [...TODAS_LAS_ACCIONES],
    notasClienta: true,
  },
  subencargado: {
    paginas: PAGINAS.filter((p) => p !== "demos" && p !== "ajustes.accesos"),
    // Todo salvo dinero global, plan, accesos, borrar datos y deshacer lo ajeno.
    todo: TODAS_LAS_ACCIONES.filter(
      (a) => !["dinero.ver-global", "plan.gestionar", "accesos.gestionar", "datos.borrar", "historial.deshacer-ajeno", "web.publicar", "clienta.borrar"].includes(a),
    ),
    notasClienta: true,
  },
  recepcion: {
    paginas: ["hoy", "calendario", "citas", "lista-espera", "clientas", "hoja", "asistente"],
    todo: [
      "cita.ver-todas", "cita.crear", "cita.crear-para-otra", "cita.editar", "cita.mover", "cita.cancelar",
      "cita.confirmar-solicitud", "cita.rechazar-solicitud", "cita.marcar-asistencia", "cita.recordar",
      "clienta.ver", "clienta.ver-todas", "clienta.crear", "clienta.editar", "lista-espera.gestionar", "senal.gestionar",
    ],
    notasClienta: true,
  },
  estilista: {
    paginas: ["hoy", "calendario", "citas", "clientas", "hoja", "asistente"],
    todo: ["clienta.ver", "clienta.crear", "clienta.editar"],
    propio: AGENDA_PROPIA,
    notasClienta: true,
  },
};

const CACHE = new Map<Rol, Permisos>();

export function permisosDe(rol: Rol): Permisos {
  let p = CACHE.get(rol);
  if (!p) {
    const d = MATRIZ[rol];
    const acciones = new Map<AccionId, Alcance>();
    for (const a of d.propio ?? []) acciones.set(a, "propio");
    for (const a of d.todo) acciones.set(a, "todo");
    p = { rol, paginas: new Set(d.paginas), acciones, notasClienta: d.notasClienta };
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
