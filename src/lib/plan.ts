/**
 * Qué incluye cada plan de siShow (lote 13). Tabla ÚNICA: la usan las
 * pantallas para abrir o cerrar cada función, y el asistente para decir «eso
 * llega con el plan…» (BACKEND: `planMinimo` de intenciones.ts debe leer de
 * aquí para no contradecirse).
 *
 * Decisión de Tomás (26-sep): Todo incluido = roles más allá de gerente y
 * estilista, historial y restaurar sin límite (estándar: el aviso de 10 s y
 * las últimas 24 h), campañas ampliadas (estándar: solo la reseña de Google;
 * cumpleaños no existe todavía), analítica avanzada e importación asistida
 * mensual. El asistente, desde Reservas + Asistente. El resto, en Reservas.
 * Profesionales (Tomás, 22-oct, decisión que sustituye a la anterior): «El tope
 * de 3 estilistas es solo de peluchic, para los demás es hasta 6 salvo en
 * embajador». Básico y Estándar, hasta seis; Embajador, sin límite comercial
 * (conserva el máximo técnico `MAX_SALON_TEAM_ENTRIES`); y el salón con slug
 * `peluchic`, hasta tres en cualquier plan (`TOPE_POR_SALON`, único sitio donde
 * se aplica; lo usan la pantalla Equipo, la store y el servidor).
 *
 * Decisión de Tomás (27-sep), alineado con el presupuesto: exportar tus citas
 * y tu analítica a Excel va en TODOS los planes, no solo en Todo incluido
 * (el presupuesto que ve María ya lo incluye así). No confundir con
 * `caja-exportar` (el fichero de cobros para la gestoría), que sigue solo en
 * Todo incluido.
 *
 * Plan definitivo del 27-sep (`plan-final.md`): «si la señal no llega a
 * tiempo, el hueco se libera solo» pasa a TODOS los planes — ya funciona así
 * en el código, activado por defecto (`senal.ts`), y es justo lo que pidió
 * María. No prometer «dominio propio» ni «segunda página de reservas» en
 * ningún plan (no existen): son desarrollo a tu medida. Igual el WhatsApp o
 * los recordatorios totalmente automáticos, sin que la dueña toque nada
 * (requieren dar de alta el número en Meta): a tu medida, sin plan ni fecha.
 *
 * Decisión de Tomás (28-sep, `plan-final-v2.md`): los planes cambian de
 * nombre — Reservas → Básico, Reservas + Asistente → Estándar, Todo
 * incluido → Embajador — sin tocar los ids internos. Y de reparto: el
 * historial completo y la analítica avanzada bajan de Embajador a Estándar
 * (`historial-completo`, `analitica-avanzada`). El resto de funciones no
 * se mueve.
 *
 * Corrección de Tomás (28-sep, venta de las 9:30): `campanas-ampliadas`
 * vuelve a Embajador (`todo-incluido`) — no baja a Estándar. Y el cierre y
 * la exportación de caja (`caja-cierre`, `caja-exportar`) bajan de Embajador
 * a Estándar (`reservas-asistente`): Caja entera queda en el plan Estándar.
 */
export type PlanSishow = "reservas" | "reservas-asistente" | "todo-incluido";

export const PLANES: readonly PlanSishow[] = ["reservas", "reservas-asistente", "todo-incluido"];

export const NOMBRE_PLAN: Record<PlanSishow, string> = {
  reservas: "Básico",
  "reservas-asistente": "Estándar",
  "todo-incluido": "Embajador",
};

export type FuncionPlan =
  | "asistente"
  | "roles-ampliados"
  | "historial-completo"
  | "campanas-ampliadas"
  | "analitica-avanzada"
  | "exportar"
  | "senal-liberacion-automatica"
  | "importacion-mensual"
  | "caja-exportar"
  | "caja-cierre";

export const FUNCIONES_POR_PLAN: Record<FuncionPlan, PlanSishow> = {
  asistente: "reservas-asistente",
  "roles-ampliados": "todo-incluido",
  "historial-completo": "reservas-asistente",
  "campanas-ampliadas": "todo-incluido",
  "analitica-avanzada": "reservas-asistente",
  exportar: "reservas",
  "senal-liberacion-automatica": "reservas",
  "importacion-mensual": "todo-incluido",
  // 14b: cobrar cada cita va en todos los planes; exportar y guardar el cierre, en Estándar.
  "caja-exportar": "reservas-asistente",
  "caja-cierre": "reservas-asistente",
};

/** Qué es cada función, para la tarjeta «llega con el plan…». */
export interface EjemploFuncionPlan {
  /** Título del bloque estático. Nunca se rellena con datos del salón. */
  titulo: string;
  filas: ReadonlyArray<{ etiqueta: string; valor: string }>;
}

export interface DescripcionFuncionPlan {
  titulo: string;
  texto: string;
  plural?: boolean;
  /** Una miniatura legible y explícitamente ficticia para las tarjetas del panel. */
  ejemplo: EjemploFuncionPlan;
}

/**
 * Texto, beneficio y miniatura de cada función. Mantenerlo junto a la tabla
 * de planes evita que una tarjeta, el asistente y el servidor vendan cosas
 * distintas. Las filas de `ejemplo` son deliberadamente inventadas.
 */
export const QUE_ES: Record<FuncionPlan, DescripcionFuncionPlan> = {
  asistente: {
    titulo: "El asistente",
    texto: "Pregúntale por tu salón como hablas y obtiene una respuesta clara sobre agenda, cobros o fichas.",
    ejemplo: { titulo: "Respuesta del asistente", filas: [{ etiqueta: "Huecos esta tarde", valor: "3 libres" }, { etiqueta: "Siguiente cita", valor: "16:30 · Corte" }] },
  },
  "roles-ampliados": {
    titulo: "Más tipos de acceso",
    plural: true,
    texto: "Da a recepción y a una subencargada justo el acceso que necesitan, sin compartirlo todo.",
    ejemplo: { titulo: "Accesos del equipo", filas: [{ etiqueta: "Laura", valor: "Recepción · confirma citas" }, { etiqueta: "Marta", valor: "Subencargada · organiza el día" }] },
  },
  "historial-completo": {
    titulo: "El historial completo",
    texto: "Consulta lo cambiado durante 90 días, quién lo hizo y vuelve a una versión anterior si lo necesitas.",
    ejemplo: { titulo: "Cambios recientes", filas: [{ etiqueta: "Ayer, 18:10", valor: "Precio de mechas actualizado" }, { etiqueta: "Lunes, 09:25", valor: "Horario de Sara ajustado" }] },
  },
  "campanas-ampliadas": {
    titulo: "Todas las campañas",
    plural: true,
    texto: "Recupera clientas, llena horas flojas y propone una segunda visita con la lista y el mensaje preparados.",
    ejemplo: { titulo: "Campaña preparada", filas: [{ etiqueta: "Clientas que no vuelven", valor: "18 personas" }, { etiqueta: "Mensaje", valor: "Listo para revisar" }] },
  },
  "analitica-avanzada": {
    titulo: "La analítica completa",
    texto: "Mira cualquier periodo y descubre patrones de tu histórico: horas flojas, servicios y clientas que repiten.",
    ejemplo: { titulo: "Patrón del mes", filas: [{ etiqueta: "Franja más floja", valor: "Martes · 16:00" }, { etiqueta: "Servicio estrella", valor: "Mechas · 24 citas" }] },
  },
  exportar: {
    titulo: "Exportar a Excel",
    texto: "Lleva tus citas y tu analítica a un fichero para la gestoría o para revisarlo como quieras.",
    ejemplo: { titulo: "Fichero preparado", filas: [{ etiqueta: "Periodo", valor: "1–30 septiembre" }, { etiqueta: "Formato", valor: "Excel · 126 citas" }] },
  },
  "senal-liberacion-automatica": {
    titulo: "La señal que se libera sola",
    texto: "Si no llega la señal a tiempo, el hueco se libera sin que tengas que estar pendiente.",
    ejemplo: { titulo: "Regla de señal", filas: [{ etiqueta: "Plazo", valor: "2 horas" }, { etiqueta: "Al vencer", valor: "Hueco liberado" }] },
  },
  "importacion-mensual": {
    titulo: "Importación mensual",
    texto: "Traemos cada mes tus clientas y ventas de TPV 123 para que siShow esté al día.",
    ejemplo: { titulo: "Importación de ejemplo", filas: [{ etiqueta: "Octubre", valor: "42 ventas revisadas" }, { etiqueta: "Duplicados", valor: "2 unificados" }] },
  },
  "caja-exportar": {
    titulo: "Exportar para la gestoría",
    texto: "Prepara los cobros del periodo con fecha, concepto, forma de pago, importe y quién cobró.",
    ejemplo: { titulo: "CSV para gestoría", filas: [{ etiqueta: "Periodo", valor: "1–30 septiembre" }, { etiqueta: "Cobros", valor: "84 líneas" }] },
  },
  "caja-cierre": {
    titulo: "El cierre de caja guardado",
    texto: "Cuenta el efectivo al cerrar, calcula el descuadre y guarda cada cierre para revisarlo después.",
    ejemplo: { titulo: "Cierre de ejemplo", filas: [{ etiqueta: "Efectivo esperado", valor: "186,00 €" }, { etiqueta: "Descuadre", valor: "0,00 €" }] },
  },
};

const RANGO: Record<PlanSishow, number> = { reservas: 0, "reservas-asistente": 1, "todo-incluido": 2 };

export function tienePlan(plan: PlanSishow, funcion: FuncionPlan): boolean {
  return RANGO[plan] >= RANGO[FUNCIONES_POR_PLAN[funcion]];
}

/** Catálogo que puede ver un salón sin mezclarlo con datos de su cuenta. */
export function funcionesNoIncluidas(plan: PlanSishow): FuncionPlan[] {
  return (Object.keys(FUNCIONES_POR_PLAN) as FuncionPlan[]).filter((funcion) => !tienePlan(plan, funcion));
}

/** Nombre, beneficio y plan de una función, siempre derivados de esta tabla. */
export function catalogoFuncion(funcion: FuncionPlan) {
  return { funcion, ...QUE_ES[funcion], plan: FUNCIONES_POR_PLAN[funcion], nombrePlan: NOMBRE_PLAN[FUNCIONES_POR_PLAN[funcion]] };
}

/**
 * Señales concretas para que el asistente abra la misma ficha contextual. No
 * son respuestas ni datos: solo reconocen que alguien ha pedido una función
 * del catálogo anterior. Se mantienen aquí para no duplicar planes en el
 * motor del asistente.
 */
export function funcionDePlanMencionada(texto: string): FuncionPlan | null {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(subencargad|recepcion|tipos? de acceso)\b/.test(t)) return "roles-ampliados";
  if (/\bhistorial completo\b|\b90 dias\b|\bversion(?:es)? anterior(?:es)?\b/.test(t)) return "historial-completo";
  if (/\b(campanas? ampliadas?|todas las campanas?)\b/.test(t)) return "campanas-ampliadas";
  if (/\b(analitica completa|patrones? del historico|franja mas floja)\b/.test(t)) return "analitica-avanzada";
  if (/\b(importacion mensual|importar(?:me|nos)? cada mes|traer(?:me|nos)? cada mes)\b/.test(t)) return "importacion-mensual";
  if (/\b(cierre de caja guardado|cierres de caja)\b/.test(t)) return "caja-cierre";
  if (/\b(exportar (?:la )?caja|gestoria)\b/.test(t)) return "caja-exportar";
  if (/\basistente\b/.test(t)) return "asistente";
  return null;
}

/** Límite operativo por plan. Embajador conserva el máximo técnico de seis. */
export const LIMITE_PROFESIONALES: Record<PlanSishow, number> = {
  reservas: 6,
  "reservas-asistente": 6,
  "todo-incluido": 6,
};

/** El plan de un salón: el guardado; si falta, el más conservador para un salón real. */
export function planDe(perfil: { plan?: string | null }, esDemo: boolean): PlanSishow {
  const p = perfil.plan;
  if (p === "reservas" || p === "reservas-asistente" || p === "todo-incluido") return p;
  return esDemo ? "todo-incluido" : "reservas";
}

/** Cuenta nombres válidos sin depender de que la pantalla haya normalizado el perfil. */
export function cantidadProfesionales(team: unknown): number {
  if (!Array.isArray(team)) return 0;
  return team.filter((entrada) => typeof entrada === "string" && entrada.split("~", 1)[0].trim()).length;
}

/** Topes propios de un salón concreto (22-oct): PeluChic, tres. Tienen prioridad sobre el plan. */
export const TOPE_POR_SALON: Record<string, number> = {
  peluchic: 3,
};

/**
 * Límite efectivo de profesionales de un salón: el menor entre el del plan y el
 * propio del salón (si lo tiene). ÚNICO sitio donde se aplica el override.
 */
export function limiteProfesionalesDeSalon(plan: PlanSishow, slug?: string | null): number {
  const propio = slug ? TOPE_POR_SALON[slug] : undefined;
  return propio === undefined ? LIMITE_PROFESIONALES[plan] : Math.min(propio, LIMITE_PROFESIONALES[plan]);
}

/** Evita que la UI y el servidor apliquen topes distintos al mismo perfil. */
export function equipoCabeEnPlan(plan: PlanSishow, team: unknown, slug?: string | null): boolean {
  return cantidadProfesionales(team) <= limiteProfesionalesDeSalon(plan, slug);
}

/** Lo que incluye cada plan, en orden, para «Qué incluye cada plan». */
export function incluye(plan: PlanSishow): FuncionPlan[] {
  return (Object.keys(FUNCIONES_POR_PLAN) as FuncionPlan[]).filter((f) => FUNCIONES_POR_PLAN[f] === plan);
}

/** Horas del historial fuera de Todo incluido. */
export const HORAS_HISTORIAL_ESTANDAR = 24;

/**
 * Profesionales con agenda propia por plan (tabla de precios del 2-oct):
 * Básico hasta 6, Estándar hasta 6, Embajador sin límite (`null`); desde el
 * 22-oct. El tope de PeluChic (3) va aparte, en `TOPE_POR_SALON`. Es un
 * límite COMERCIAL; el técnico sigue siendo `MAX_SALON_TEAM_ENTRIES` (6),
 * así que en Embajador el panel tampoco deja pasar de 6 hoy.
 */
export const MAX_PROFESIONALES: Record<PlanSishow, number | null> = {
  reservas: 6,
  "reservas-asistente": 6,
  "todo-incluido": null,
};

/** El plan más barato que admite `n` profesionales. */
export function planParaProfesionales(n: number): PlanSishow {
  return PLANES.find((p) => MAX_PROFESIONALES[p] === null || n <= (MAX_PROFESIONALES[p] as number)) ?? "todo-incluido";
}

/**
 * ¿Se enseña el conmutador de plan «Básico / Estándar / Embajador»? Solo en una
 * demo de venta ya identificada como tal: nunca en un salón real, ni mientras
 * aún se está comprobando si lo es (así no parpadea en el panel de un salón de pago).
 */
export function muestraConmutadorDePlan(estado: {
  realSalonSlug: string | null;
  slug: string;
  resolucion: { slug: string; status: string } | null;
  /** «cliente»: la demo se enseña como la ve su dueña, sin selector. */
  vista?: "cliente" | "prospecto";
}): boolean {
  if (estado.realSalonSlug) return false;
  if (estado.vista === "cliente") return false;
  return !!estado.resolucion && estado.resolucion.slug === estado.slug && estado.resolucion.status === "demo";
}

/** Apartados del menú que son una función de un plan superior (el resto no lleva insignia). */
export const FUNCION_DE_RUTA: Record<string, FuncionPlan> = {
  "/app/insights": "analitica-avanzada",
  "/app/marketing": "campanas-ampliadas",
};

/** La insignia de plan de un apartado: solo si ese plan NO lo tiene; nunca de un plan inferior. */
export function insigniaDeRuta(ruta: string, plan: PlanSishow): string | null {
  const funcion = FUNCION_DE_RUTA[ruta];
  return funcion && !tienePlan(plan, funcion) ? NOMBRE_PLAN[FUNCIONES_POR_PLAN[funcion]] : null;
}

/** Funciones que el resumen «Lo que añade el plan Embajador» enseña, en este orden. */
const RESUMEN_EMBAJADOR: readonly FuncionPlan[] = ["campanas-ampliadas", "roles-ampliados", "importacion-mensual"];

/** Hasta cuatro funciones del plan inmediatamente superior que el salón aún no tiene. */
export function resumenPlanSuperior(plan: PlanSishow): FuncionPlan[] {
  return RESUMEN_EMBAJADOR.filter((f) => !tienePlan(plan, f));
}
