/**
 * Catálogo de intenciones del asistente: la especificación de FRONTEND
 * (especificacion.ts, generada, ids exactos) más las reglas que el documento
 * no trae: qué entidades exige cada intención, el plan mínimo, ejemplos extra
 * para las familias con pocos, y el reencaminado por entidades («citas hoy»
 * con una fecha que no es hoy es «citas de un día»).
 */
import { ESPECIFICACION, type FamiliaEspecificacion } from "./especificacion";
import { sumarDias, type Entidades } from "./entidades";
import type { PlanSishow } from "./fuentes";
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

/** Marcadores que sustituyen a los nombres propios en ejemplos y preguntas. */
export const MARCA_CLIENTA = "zzclienta";
export const MARCA_PRO = "zzpro";

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
  "precio-servicio": ["servicio"],
  "duracion-servicio": ["servicio"],
  "primer-hueco-servicio": ["servicio"],
  "veces-servicio": ["servicio"],
  "dinero-servicio": ["servicio"],
};

/** Ejemplos añadidos: familias con pocos en el documento y formulaciones de la sonda. */
const EXTRA: Record<string, string[]> = {
  "citas-hoy": ["espera un momento cuantas citas hay", "cuantas citas hay"],
  "citas-manana": ["q citas tengo mñn", "cuantas citas hay mañana", "y mañana"],
  "citas-dia": ["quien viene el sabado", "citas del viernes", "que hay el jueves"],
  "citas-periodo": ["citas de la semana que viene", "cuantas citas este mes"],
  "cobrado-periodo": ["cuanto hemos facturado esta semana", "ingresos de septiembre"],
  "plantones": ["cuantas han faltado este mes", "quien no ha venido"],
  "ultima-visita-clienta": ["cuanto hace que no viene lucia"],
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

function planMinimoDe(texto?: string): PlanSishow | null | undefined {
  if (!texto) return undefined;
  const t = normalizar(texto);
  if (t.startsWith("ningun")) return null;
  if (t.includes("todo incluido")) return "todo-incluido";
  if (t.includes("asistente")) return "reservas-asistente";
  return "reservas";
}

/** Sustituye los nombres del documento por su marca. */
export function enmascararEjemplo(texto: string): string {
  return normalizar(texto)
    .split(" ")
    .map((p) => NOMBRES_EJEMPLO[p] ?? p)
    .join(" ");
}

function preguntaDe(f: FamiliaEspecificacion): string {
  const e = f.ejemplos.find((x) => !x.split(" ").some((p) => NOMBRES_EJEMPLO[normalizar(p)])) ?? f.ejemplos[0];
  const t = e.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const INTENCIONES: Intencion[] = ESPECIFICACION.map((f) => ({
  ...f,
  ejemplos: [...f.ejemplos, ...(EXTRA[f.id] ?? [])],
  requiere: REQUIERE[f.id] ?? [],
  planMinimo: f.grupo === "plan" ? planMinimoDe(f.plan) : undefined,
  pregunta: preguntaDe(f),
}));

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
      if (pro && esHoy) return "citas-hoy-profesional";
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
    case "ingresos-hoy":
    case "cobrado-periodo":
      if (pro) return "dinero-profesional";
      if (e.servicios.length) return "dinero-servicio";
      return esHoy ? "ingresos-hoy" : "cobrado-periodo";
    case "ultima-visita-clienta":
    case "proxima-cita-clienta":
      return id;
    default:
      return id;
  }
}
