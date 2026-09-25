/**
 * Catálogo de intenciones del asistente: la especificación de FRONTEND
 * (especificacion.ts, generada, ids exactos) más las reglas que el documento
 * no trae: qué entidades exige cada intención, el plan mínimo, ejemplos extra
 * para las familias con pocos, y el reencaminado por entidades («citas hoy»
 * con una fecha que no es hoy es «citas de un día»).
 */
import { EJEMPLOS_EXTRA } from "./ejemplos-extra";
import { ESPECIFICACION, type FamiliaEspecificacion } from "./especificacion";
import { sumarDias, type Entidades } from "./entidades";
import { FUNCIONES_POR_PLAN, type FuncionPlan, type PlanSishow } from "../plan";
import { normalizar } from "./normalizar";
import { prepararCandidatos, type CandidatoPreparado } from "./parecido";

export type Entidad = "clienta" | "profesional" | "servicio" | "fecha";

export interface Intencion extends FamiliaEspecificacion {
  /** Sin esta entidad no se responde: se pregunta por ella. */
  requiere: Entidad[];
  /** Plan con el que ya funciona; `null` = no lo hace ningún plan. Solo en grupo «plan». */
  planMinimo?: PlanSishow | null;
  /** Pregunta tal y como se ofrece en las sugerencias. */
  pregunta: string;
}

import { enmascarar, MARCA_CLIENTA, MARCA_PRO } from "./mascara";
export { MARCA_CLIENTA, MARCA_PRO };

/** Nombres que usan los ejemplos del documento, y qué son. */
const NOMBRES_EJEMPLO: Record<string, string> = {
  maria: MARCA_PRO,
  sara: MARCA_PRO,
  noelia: MARCA_PRO,
  cristina: MARCA_CLIENTA,
  elena: MARCA_CLIENTA,
  lucia: MARCA_CLIENTA,
  marta: MARCA_CLIENTA,
  paula: MARCA_CLIENTA,
};

const REQUIERE: Record<string, Entidad[]> = {
  "citas-hoy-profesional": ["profesional"],
  "hueco-profesional": ["profesional"],
  "horario-profesional": ["profesional"],
  "ocupacion-profesional": ["profesional"],
  "dinero-profesional": ["profesional"],
  "lo-que-mas-hace": ["profesional"],
  "citas-profesional-periodo": ["profesional"],
  "proxima-cita-clienta": ["clienta"],
  "ultima-visita-clienta": ["clienta"],
  "ultimo-color-clienta": ["clienta"],
  "frecuencia-clienta": ["clienta"],
  "gasto-clienta": ["clienta"],
  "datos-clienta": ["clienta"],
  "notas-clienta": ["clienta"],
  "clienta-bloqueada": ["clienta"],
  "profesional-habitual": ["clienta"],
  "buscar-clienta": ["clienta"],
  "senal-cita": ["clienta"],
  "precio-servicio": ["servicio"],
  "duracion-servicio": ["servicio"],
  "primer-hueco-servicio": ["servicio"],
  "veces-servicio": ["servicio"],
  "dinero-servicio": ["servicio"],
};

/** Ejemplos añadidos: familias con pocos en el documento y formulaciones de la sonda. */
const EXTRA: Record<string, string[]> = {
  "citas-hoy": ["espera un momento cuantas citas hay", "cuantas citas hay"],
  "citas-profesional-periodo": ["como va sara", "que tal va noelia", "como lo lleva maria"],
  "citas-manana": ["q citas tengo mñn", "cuantas citas hay mañana", "y mañana"],
  "citas-dia": ["quien viene el sabado", "citas del viernes", "que hay el jueves"],
  "citas-periodo": ["citas de la semana que viene", "cuantas citas este mes"],
  "cobrado-periodo": ["cuanto hemos facturado esta semana", "ingresos de septiembre"],
  "plantones": ["cuantas han faltado este mes", "quien no ha venido"],
  "ultima-visita-clienta": ["cuanto hace que no viene lucia", "cuando vino lucia", "cuando vino marta por ultima vez", "la ultima vez de elena"],
  "ultimo-color-clienta": ["color de marta", "que color lleva elena", "formula de paula"],
  "huecos-hoy": ["tengo algun hueco libre esta tarde"],
  "resumen-mes": ["que tal vamos", "como va el mes"],
  "senales-pendientes": ["cuantas señales me faltan por cobrar"],
  "tec-senal": ["como pongo la señal", "donde activo la señal", "como se configura la fianza"],
  "como-estas": ["que tal estas", "como te va", "que tal"],
  "plan-informe-mensual": ["me mandas un informe cada mes", "quiero un resumen mensual por email", "informe mensual"],
  "plan-whatsapp-automatico": ["puedes mandar los whatsapp tu sola", "whatsapp automatico", "enviar whatsapp sin tocar nada"],
  "plan-recordatorio-automatico": ["que los recordatorios se manden solos", "recordatorio automatico", "avisar solas a las clientas el dia antes"],
  "plan-asistente": ["tengo el asistente en mi plan", "que plan lleva el asistente", "por que no me responde el asistente"],
  "no-escribe-google": ["puedes contestar las reseñas de google", "responde a las reseñas", "publica en google"],
  "no-campanas-automaticas": ["manda tu la campaña", "envia la campaña automaticamente", "lanza la campaña sola"],
  "tec-confirmar": ["como confirmo una cita", "donde acepto una solicitud", "como apruebo una reserva"],
  "tec-anotar-color": ["como apunto el color", "donde anoto la formula del tinte", "guardar el color de una clienta"],
  "tec-importar-tpv": ["como importo las citas del tpv", "subir el excel del tpv", "pasar los datos del programa antiguo"],
  "tec-precios": ["como cambio un precio", "donde se edita la tarifa", "subir el precio de un servicio"],
  "tec-whatsapp-no-abre": ["no se abre el whatsapp", "el boton de whatsapp no va", "no me abre whatsapp al avisar"],
};

/** Pregunta limpia, con tildes, para botones y sugerencias. */
const PREGUNTA: Record<string, string> = {
  "citas-hoy": "¿Cuántas citas tengo hoy?",
  "citas-hoy-profesional": "¿Cuántas citas tiene hoy cada una?",
  "proxima-cita": "¿Quién viene ahora?",
  "lista-citas-hoy": "¿Qué citas me quedan hoy?",
  "huecos-hoy": "¿Qué huecos me quedan hoy?",
  "ocupacion-hoy": "¿Cómo de llena está la agenda hoy?",
  "ingresos-hoy": "¿Cuánto llevo cobrado hoy?",
  "pendiente-de-ti": "¿Qué tengo pendiente?",
  "solicitudes-pendientes": "¿Qué solicitudes tengo por confirmar?",
  "por-marcar": "¿Qué citas me faltan por marcar?",
  "abierto-ahora": "¿Estamos abiertos ahora?",
  "colores-hoy": "¿Qué colores hay hoy?",
  "citas-dia": "¿Cuántas citas hay el sábado?",
  "citas-manana": "¿Cuántas citas tengo mañana?",
  "huecos-dia": "¿Qué huecos hay el sábado?",
  "primer-hueco-servicio": "¿Cuándo cabe unas mechas?",
  "hueco-profesional": "¿Cuándo tiene hueco Sara?",
  "citas-periodo": "¿Cuántas citas llevo esta semana?",
  "ocupacion-periodo": "¿Qué ocupación llevamos este mes?",
  "proxima-cita-clienta": "¿Cuándo viene una clienta?",
  "recordatorios-manana": "¿Qué recordatorios faltan para mañana?",
  "lista-espera": "¿Quién está en lista de espera?",
  "franja-floja": "¿Cuál es mi franja más floja?",
  "dia-mas-lleno": "¿Qué día hay más citas esta semana?",
  "cancelaciones": "¿Cuántas cancelaciones llevo esta semana?",
  "plantones": "¿Quién no ha venido este mes?",
  "ultima-visita-clienta": "¿Cuándo vino por última vez una clienta?",
  "ultimo-color-clienta": "¿Qué color le pusimos a una clienta?",
  "frecuencia-clienta": "¿Cada cuánto viene una clienta?",
  "gasto-clienta": "¿Cuánto lleva gastado una clienta?",
  "datos-clienta": "¿Cuál es el teléfono de una clienta?",
  "notas-clienta": "¿Qué tengo apuntado de una clienta?",
  "clientas-total": "¿Cuántas clientas tengo?",
  "clientas-nuevas": "¿Cuántas clientas nuevas este mes?",
  "clientas-recurrentes": "¿Cuántas clientas repiten?",
  "clientas-inactivas": "¿Quién lleva tiempo sin venir?",
  "mejores-clientas": "¿Quiénes son mis mejores clientas?",
  "color-pendiente": "¿A quién le falta el color apuntado?",
  "cumpleanos": "¿Quién cumple años esta semana?",
  "clientas-con-deuda": "¿Quién me debe dinero?",
  "clienta-bloqueada": "¿Puede reservar una clienta por internet?",
  "buscar-clienta": "¿Quién es esta clienta?",
  "horario-profesional": "¿Qué horario tiene cada una?",
  "quien-trabaja": "¿Quién trabaja el sábado?",
  "citas-profesional-periodo": "¿Cuántas citas lleva cada una este mes?",
  "ocupacion-profesional": "¿Cómo de llena va cada una?",
  "dinero-profesional": "¿Cuánto lleva cobrado cada una?",
  "lo-que-mas-hace": "¿Qué es lo que más hace cada una?",
  "profesional-habitual": "¿Con quién va siempre una clienta?",
  "precio-servicio": "¿Cuánto cuesta un tinte?",
  "duracion-servicio": "¿Cuánto duran unas mechas?",
  "servicio-mas-pedido": "¿Qué es lo más pedido?",
  "servicio-mas-rentable": "¿Qué servicio deja más por hora?",
  "carta": "¿Qué servicios tengo?",
  "veces-servicio": "¿Cuántos tintes llevo este mes?",
  "cobrado-periodo": "¿Cuánto llevo cobrado este mes?",
  "previsto-periodo": "¿Cuánto tengo previsto la semana que viene?",
  "estimacion-mes": "¿Cuánto voy a hacer este mes?",
  "cobro-por-metodo": "¿Cuánto he cobrado en tarjeta, efectivo y Bizum?",
  "comparar-periodos": "¿Cómo va este mes comparado con el pasado?",
  "precio-medio": "¿Cuánto deja cada cita de media?",
  "dinero-servicio": "¿Cuánto han dejado las mechas este mes?",
  "resumen-mes": "¿Qué tal va el mes?",
  "senales-pendientes": "¿Qué señales estoy esperando?",
  "senales-vencidas": "¿Hay señales vencidas?",
  "senal-cita": "¿Ha pagado la señal una clienta?",
  "regla-senal": "¿Cuánto pido de señal?",
  "senales-recibidas": "¿Cuántas señales he recibido este mes?",
  "campanas": "¿Qué campaña me conviene?",
  "recuperables": "¿Cuántas clientas puedo recuperar?",
  "huecos-flojos": "¿Cómo lleno los huecos flojos?",
  "segunda-visita": "¿Quién vino una vez y no ha vuelto?",
  "resenas": "¿A quién pido una reseña?",
  "horario-salon": "¿Qué horario tiene el salón?",
  "enlace-reservas": "¿Cuál es mi enlace de reservas?",
  "politica-cancelacion": "¿Qué dice mi web sobre cancelar?",
  "preguntas-reserva": "¿Qué pregunto al reservar?",
  "plantones-config": "¿Cobro algo si no vienen?",
  "mensajes-whatsapp": "¿Qué dice el recordatorio de WhatsApp?",
  "duracion-flexible": "¿Fijo yo la duración al confirmar?",
  "calendario-suscrito": "¿Puedo ver las citas en mi Google Calendar?",
  "equipo-y-colores": "¿De qué color sale cada una en el calendario?",
  "saludo": "Hola",
  "gracias": "Gracias",
  "quien-eres": "¿Quién eres?",
  "que-sabes-hacer": "¿Qué sabes hacer?",
  "despedida": "Hasta luego",
  "buen-trabajo": "¡Buen trabajo!",
  "como-estas": "¿Qué tal estás?",
  "no-entiendo": "No te he entendido",
  "ayuda-humana": "Quiero hablar con una persona",
  "broma": "Cuéntame un chiste",
  "que-puedo-preguntar": "¿Qué te puedo preguntar?",
  "como-preguntar": "¿Cómo te pregunto mejor?"
};

/** Plantillas para rehacer una pregunta con la entidad elegida en un botón. */
const PLANTILLA: Record<string, string> = {
  "citas-hoy-profesional": "¿Cuántas citas tiene hoy {pro}?",
  "hueco-profesional": "¿Cuándo tiene hueco {pro}?",
  "horario-profesional": "¿Qué horario tiene {pro}?",
  "ocupacion-profesional": "¿Cómo de llena va {pro} este mes?",
  "dinero-profesional": "¿Cuánto lleva cobrado {pro} este mes?",
  "lo-que-mas-hace": "¿Qué es lo que más hace {pro}?",
  "citas-profesional-periodo": "¿Cuántas citas lleva {pro} este mes?",
  "proxima-cita-clienta": "¿Cuándo viene {clienta}?",
  "ultima-visita-clienta": "¿Cuándo vino por última vez {clienta}?",
  "ultimo-color-clienta": "¿Qué color le pusimos a {clienta}?",
  "frecuencia-clienta": "¿Cada cuánto viene {clienta}?",
  "gasto-clienta": "¿Cuánto lleva gastado {clienta}?",
  "datos-clienta": "¿Cuál es el teléfono de {clienta}?",
  "notas-clienta": "¿Qué tengo apuntado de {clienta}?",
  "clienta-bloqueada": "¿Puede reservar {clienta} por internet?",
  "profesional-habitual": "¿Con quién va siempre {clienta}?",
  "buscar-clienta": "¿Quién es {clienta}?",
  "senal-cita": "¿Ha pagado la señal {clienta}?",
  "precio-servicio": "¿Cuánto cuesta {servicio}?",
  "duracion-servicio": "¿Cuánto dura {servicio}?",
  "primer-hueco-servicio": "¿Cuándo cabe {servicio}?",
  "veces-servicio": "¿Cuántas veces he hecho {servicio} este mes?",
  "dinero-servicio": "¿Cuánto ha dejado {servicio} este mes?",
};

/** La pregunta de un botón con la entidad ya puesta («¿Cuándo viene Marta Ruiz?»). */
export function preguntaCon(id: string, v: { clienta?: string; pro?: string; servicio?: string } = {}): string {
  const t = PLANTILLA[id];
  const base = POR_ID.get(id)?.pregunta ?? id;
  if (!t) return base;
  const faltan = (t.includes("{clienta}") && !v.clienta) || (t.includes("{pro}") && !v.pro) || (t.includes("{servicio}") && !v.servicio);
  if (faltan) return base;
  return t.replace("{clienta}", v.clienta ?? "").replace("{pro}", v.pro ?? "").replace("{servicio}", v.servicio ?? "");
}

/** Intenciones de plan que son una función de la tabla compartida (`src/lib/plan.ts`): su plan mínimo sale de allí. */
const FUNCION_DE: Record<string, FuncionPlan> = {
  "plan-asistente": "asistente",
  "plan-importar-mensual": "importacion-mensual",
};

/**
 * Lo que la tabla de planes contradice del documento. «Más profesionales» NO
 * depende del plan (decisión de Tomás, 26-sep): entra en todos y no se promete
 * «Todo incluido».
 */
const CORRIGE_PLAN: Record<string, Partial<FamiliaEspecificacion>> = {
  "plan-mas-profesionales": {
    plan: "Reservas",
    alternativa: "Añádela desde Equipo con «Añadir profesional» (guía §6 Equipo)",
    mensaje: "Hola, soy María de PeluChic. Quiero añadir otra profesional al equipo y no me aparece la opción. ¿Qué hago?",
  },
};

function planMinimoDe(id: string, texto?: string): PlanSishow | null | undefined {
  const f = FUNCION_DE[id];
  if (f) return FUNCIONES_POR_PLAN[f];
  if (!texto) return undefined;
  const t = normalizar(texto);
  if (t.startsWith("ningun")) return null;
  if (t.includes("todo incluido")) return "todo-incluido";
  if (t.includes("asistente")) return "reservas-asistente";
  return "reservas";
}

const PROS_EJEMPLO = Object.entries(NOMBRES_EJEMPLO).filter(([, v]) => v === MARCA_PRO).map(([k]) => k);
const CLIENTAS_EJEMPLO = Object.entries(NOMBRES_EJEMPLO).filter(([, v]) => v === MARCA_CLIENTA).map(([k]) => k);

/** Un ejemplo del documento, enmascarado igual que se enmascaran las preguntas. */
export function enmascararEjemplo(texto: string): string {
  return enmascarar(texto, { pros: PROS_EJEMPLO, clientas: CLIENTAS_EJEMPLO });
}

function preguntaDe(f: FamiliaEspecificacion): string {
  const e = f.ejemplos.find((x) => !x.split(" ").some((p) => NOMBRES_EJEMPLO[normalizar(p)])) ?? f.ejemplos[0];
  const t = e.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const INTENCIONES: Intencion[] = ESPECIFICACION.map((doc) => ({ ...doc, ...CORRIGE_PLAN[doc.id] })).map((f) => ({
  ...f,
  ejemplos: [...f.ejemplos, ...(EXTRA[f.id] ?? []), ...(EJEMPLOS_EXTRA[f.id] ?? [])],
  requiere: REQUIERE[f.id] ?? [],
  planMinimo: f.grupo === "plan" ? planMinimoDe(f.id, f.plan) : undefined,
  pregunta: PREGUNTA[f.id] ?? preguntaDe(f),
}));

/**
 * Vocabulario del asistente: las palabras de los ejemplos (sin los nombres de
 * ejemplo) y sus comienzos de 5 letras o más («renta» por «rentable»). Una
 * palabra de aquí nunca se toma por el nombre de una clienta con una falta.
 */
export const VOCABULARIO: ReadonlySet<string> = (() => {
  const v = new Set<string>();
  for (const i of INTENCIONES)
    for (const e of i.ejemplos)
      for (const w of normalizar(e).split(" ")) {
        if (w.length < 3 || NOMBRES_EJEMPLO[w]) continue;
        v.add(w);
        for (let n = 5; n < w.length; n++) v.add(w.slice(0, n));
      }
  return v;
})();

export const POR_ID: Map<string, Intencion> = new Map(INTENCIONES.map((i) => [i.id, i]));

let preparados: CandidatoPreparado[] | null = null;
/** Candidatos listos para `clasificar`, con los nombres enmascarados. Se preparan una vez. */
export function candidatos(): CandidatoPreparado[] {
  preparados ??= prepararCandidatos(INTENCIONES.map((i) => ({ id: i.id, ejemplos: i.ejemplos.map(enmascararEjemplo) })));
  return preparados;
}

/**
 * Ajusta la intención ganadora a lo que la pregunta nombra de verdad.
 * `hoy` es el día del salón («AAAA-MM-DD»).
 */
export function reencaminar(id: string, e: Entidades, hoy: string): string {
  const f = e.fecha;
  const esHoy = !f || (f.tipo === "dia" && f.dia === hoy);
  const manana = f?.tipo === "dia" && f.dia === sumarDias(hoy, 1);
  const pro = e.profesionales.length > 0;
  const cli = e.clienta?.tipo === "una" || e.clienta?.tipo === "varias";

  switch (id) {
    case "citas-hoy":
    case "lista-citas-hoy":
    case "citas-manana":
    case "citas-dia":
    case "citas-periodo":
      if (cli && !pro && id !== "citas-periodo") return "proxima-cita-clienta";
      if (f?.tipo === "periodo") return pro ? "citas-profesional-periodo" : "citas-periodo";
      if (pro && (esHoy || f?.tipo === "dia")) return "citas-hoy-profesional";
      if (pro) return "citas-profesional-periodo";
      if (esHoy) return id === "lista-citas-hoy" ? id : "citas-hoy";
      if (manana) return "citas-manana";
      return "citas-dia";
    case "huecos-hoy":
    case "huecos-dia":
      if (e.servicios.length && !pro) return "primer-hueco-servicio";
      if (pro) return "hueco-profesional";
      return esHoy ? "huecos-hoy" : "huecos-dia";
    case "ocupacion-hoy":
    case "ocupacion-periodo":
      if (pro) return "ocupacion-profesional";
      return esHoy ? "ocupacion-hoy" : "ocupacion-periodo";
    case "servicio-mas-pedido":
      return pro ? "lo-que-mas-hace" : id;
    case "previsto-periodo":
      return pro ? "dinero-profesional" : id;
    case "cumpleanos":
      return e.clienta?.tipo === "una" ? "datos-clienta" : id;
    case "ingresos-hoy":
    case "cobrado-periodo":
      if (pro) return "dinero-profesional";
      if (e.servicios.length) return "dinero-servicio";
      return esHoy ? "ingresos-hoy" : "cobrado-periodo";
    case "citas-hoy-profesional":
    case "citas-profesional-periodo":
      if (f?.tipo === "periodo") return "citas-profesional-periodo";
      if (id === "citas-profesional-periodo" && f?.tipo === "dia") return "citas-hoy-profesional";
      return id;
    default:
      return id;
  }
}
