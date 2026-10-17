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
 * Básico y Estándar admiten hasta seis profesionales, según la decisión del
 * 9-oct. Embajador conserva el máximo técnico actual
 * de seis mientras no se implemente el «sin límite» de su ficha comercial.
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
export const QUE_ES: Record<FuncionPlan, { titulo: string; texto: string; plural?: boolean }> = {
  asistente: { titulo: "El asistente", texto: "Pregúntale por tu salón como hablas: cuántas citas, huecos, cobrado, el color de una clienta. Responde con tus datos." },
  "roles-ampliados": { titulo: "Más tipos de acceso", plural: true, texto: "Además de gerente y estilista, una subencargada y recepción, cada una con lo suyo." },
  "historial-completo": { titulo: "El historial completo", texto: "Todo lo cambiado en los últimos 90 días, con quién y cuándo, y deshacerlo o volver a una versión anterior de tu web." },
  "campanas-ampliadas": { titulo: "Todas las campañas", plural: true, texto: "Recupera a las que no vuelven, llena tus horas flojas, segunda visita y ofrece otros servicios, con la lista y el mensaje preparados." },
  "analitica-avanzada": { titulo: "La analítica completa", texto: "Cualquier periodo que elijas y los patrones de todo tu histórico: la franja más floja, el servicio estrella, quién repite más." },
  exportar: { titulo: "Exportar a Excel", texto: "Tus citas y tu analítica en un fichero para tu gestoría o para lo que quieras." },
  "senal-liberacion-automatica": { titulo: "La señal que se libera sola", texto: "Si no llega la señal a tiempo, el hueco se libera sin que tengas que estar pendiente." },
  "importacion-mensual": { titulo: "Importación mensual", texto: "Traemos cada mes tus clientas de TPV 123 para que siShow esté al día." },
  "caja-exportar": { titulo: "Exportar para la gestoría", texto: "Todos los cobros del periodo que elijas en un fichero listo para tu gestoría: fecha, concepto, forma de pago, importe y quién cobró." },
  "caja-cierre": { titulo: "El cierre de caja guardado", texto: "Cuenta el efectivo al cerrar, siShow calcula el descuadre y guarda cada cierre para que puedas revisarlo después." },
};

const RANGO: Record<PlanSishow, number> = { reservas: 0, "reservas-asistente": 1, "todo-incluido": 2 };

export function tienePlan(plan: PlanSishow, funcion: FuncionPlan): boolean {
  return RANGO[plan] >= RANGO[FUNCIONES_POR_PLAN[funcion]];
}

/** Límite operativo vigente. Embajador aún conserva el máximo técnico de seis. */
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

/** Evita que la UI y el servidor apliquen topes distintos al mismo perfil. */
export function equipoCabeEnPlan(plan: PlanSishow, team: unknown): boolean {
  return cantidadProfesionales(team) <= LIMITE_PROFESIONALES[plan];
}

/** Lo que incluye cada plan, en orden, para «Qué incluye cada plan». */
export function incluye(plan: PlanSishow): FuncionPlan[] {
  return (Object.keys(FUNCIONES_POR_PLAN) as FuncionPlan[]).filter((f) => FUNCIONES_POR_PLAN[f] === plan);
}

/** Horas del historial fuera de Todo incluido. */
export const HORAS_HISTORIAL_ESTANDAR = 24;

/**
 * Profesionales con agenda propia por plan (tabla de precios del 2-oct):
 * Básico y Estándar hasta 6, Embajador sin límite (`null`). Es un
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
}): boolean {
  if (estado.realSalonSlug) return false;
  return !!estado.resolucion && estado.resolucion.slug === estado.slug && estado.resolucion.status === "demo";
}
