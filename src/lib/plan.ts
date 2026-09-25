/**
 * Qué incluye cada plan de siShow (lote 13). Tabla ÚNICA: la usan las
 * pantallas para abrir o cerrar cada función, y el asistente para decir «eso
 * llega con el plan…» (BACKEND: `planMinimo` de intenciones.ts debe leer de
 * aquí para no contradecirse).
 *
 * Decisión de Tomás (26-sep): Todo incluido = roles más allá de gerente y
 * estilista, historial y restaurar sin límite (estándar: el aviso de 10 s y
 * las últimas 24 h), campañas ampliadas (estándar: solo la reseña de Google;
 * cumpleaños no existe todavía), analítica avanzada y exportaciones, señal con
 * liberación automática e importación asistida mensual. El asistente, desde
 * Reservas + Asistente. El resto, en Reservas. «Más profesionales» NO depende
 * del plan.
 */
export type PlanSishow = "reservas" | "reservas-asistente" | "todo-incluido";

export const PLANES: readonly PlanSishow[] = ["reservas", "reservas-asistente", "todo-incluido"];

export const NOMBRE_PLAN: Record<PlanSishow, string> = {
  reservas: "Reservas",
  "reservas-asistente": "Reservas + Asistente",
  "todo-incluido": "Todo incluido",
};

export type FuncionPlan =
  | "asistente"
  | "roles-ampliados"
  | "historial-completo"
  | "campanas-ampliadas"
  | "analitica-avanzada"
  | "exportar"
  | "senal-liberacion-automatica"
  | "importacion-mensual";

export const FUNCIONES_POR_PLAN: Record<FuncionPlan, PlanSishow> = {
  asistente: "reservas-asistente",
  "roles-ampliados": "todo-incluido",
  "historial-completo": "todo-incluido",
  "campanas-ampliadas": "todo-incluido",
  "analitica-avanzada": "todo-incluido",
  exportar: "todo-incluido",
  "senal-liberacion-automatica": "todo-incluido",
  "importacion-mensual": "todo-incluido",
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
};

const RANGO: Record<PlanSishow, number> = { reservas: 0, "reservas-asistente": 1, "todo-incluido": 2 };

export function tienePlan(plan: PlanSishow, funcion: FuncionPlan): boolean {
  return RANGO[plan] >= RANGO[FUNCIONES_POR_PLAN[funcion]];
}

/** El plan de un salón: el guardado; sin él, «reservas-asistente» (como BACKEND) o «todo-incluido» en una demo. */
export function planDe(perfil: { plan?: string | null }, esDemo: boolean): PlanSishow {
  const p = perfil.plan;
  if (p === "reservas" || p === "reservas-asistente" || p === "todo-incluido") return p;
  return esDemo ? "todo-incluido" : "reservas-asistente";
}

/** Lo que incluye cada plan, en orden, para «Qué incluye cada plan». */
export function incluye(plan: PlanSishow): FuncionPlan[] {
  return (Object.keys(FUNCIONES_POR_PLAN) as FuncionPlan[]).filter((f) => FUNCIONES_POR_PLAN[f] === plan);
}

/** Horas del historial fuera de Todo incluido. */
export const HORAS_HISTORIAL_ESTANDAR = 24;
