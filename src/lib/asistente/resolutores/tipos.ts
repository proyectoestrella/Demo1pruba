/**
 * Tipos y utilidades de redacción de los resolutores.
 *
 * Un resolutor es PURO: recibe las fuentes y las entidades ya extraídas y
 * devuelve texto, cifras, como mucho una acción y sugerencias. Si falta el
 * dato, lo dice («Eso no lo tengo apuntado»): nunca rellena con un valor.
 */
import type { Entidades } from "../entidades";
import type { ClientaA, EstadoAsistente, FuentesAsistente } from "../fuentes";

export type TipoAccion =
  | "ver-calendario"
  | "ver-hoja"
  | "abrir-ficha"
  | "abrir-cita"
  | "nueva-cita"
  | "ver-seccion"
  | "copiar"
  | "whatsapp"
  | "descargar"
  | "escribir-soporte";

export interface Accion {
  tipo: TipoAccion;
  /** Texto del botón, con verbo: «Ver calendario». */
  etiqueta: string;
  dia?: string;
  clientaId?: string;
  citaId?: string;
  profesionalId?: string;
  /** Sección del panel («Marketing», «Ajustes › Señal») o texto a copiar. */
  destino?: string;
}

export interface Cifra {
  etiqueta: string;
  valor: number;
  unidad?: "citas" | "€" | "%" | "min" | "clientas" | "veces" | "dias" | "huecos" | "señales";
}

export interface Respuesta {
  texto: string;
  cifras: Cifra[];
  /** Como mucho una (principio 6). */
  acciones: Accion[];
  sugerencias: string[];
  /** Intención con la que se ha respondido. */
  intencion?: string;
  /** El asistente pide que elija: una opción por botón. */
  opciones?: Array<{ etiqueta: string; pregunta: string }>;
}

export interface Rango {
  desde: string;
  hasta: string;
  etiqueta: string;
}

export interface Contexto {
  fuentes: FuentesAsistente;
  estado: EstadoAsistente;
  e: Entidades;
  /** Día del salón, «AAAA-MM-DD». */
  hoy: string;
  /** La pregunta normalizada (minúsculas, sin tildes). */
  pregunta: string;
  /** La clienta ya resuelta (una sola), si la intención la necesita. */
  clienta?: ClientaA;
}

export type Resolutor = (c: Contexto) => Respuesta;

export function respuesta(texto: string, extra: Partial<Omit<Respuesta, "texto">> = {}): Respuesta {
  return { texto, cifras: extra.cifras ?? [], acciones: (extra.acciones ?? []).slice(0, 1), sugerencias: extra.sugerencias ?? [], ...(extra.opciones ? { opciones: extra.opciones } : {}) };
}

export const NO_LO_TENGO = "Eso no lo tengo apuntado";

/** «1.940 €», «35 €», «12,50 €». */
export function euros(n: number): string {
  const r = Math.round(n * 100) / 100;
  const [ent, dec] = Math.abs(r).toFixed(Number.isInteger(r) ? 0 : 2).split(".");
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${r < 0 ? "-" : ""}${miles}${dec ? `,${dec}` : ""} €`;
}

/** «a», «a y b», «a, b y c». */
export function lista(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function plural(n: number, uno: string, varios: string): string {
  return `${n.toLocaleString("es-ES")} ${n === 1 ? uno : varios}`;
}

/** Nombre de pila: «Marta Ruiz» → «Marta». */
export function pila(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

/** «2 h», «40 min», «2 h 15». */
export function duracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/** Primera letra en mayúscula. */
export function mayus(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** «14 de julio» (y el año si no es el de `hoy`). */
export function fechaLarga(dia: string, hoy?: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const anio = hoy && Number(hoy.slice(0, 4)) !== a ? ` de ${a}` : "";
  return `${d} de ${MESES[m - 1]}${anio}`;
}
export function nombreMes(dia: string): string {
  return MESES[Number(dia.slice(5, 7)) - 1];
}

/** «esta semana» → «esta semana»; «septiembre» → «en septiembre». */
export function enPeriodo(etiqueta: string): string {
  return /^(esta|este|la|las|los|el|del|hoy|mañana|ayer|pasado)\b/.test(etiqueta) ? etiqueta : `en ${etiqueta}`;
}
