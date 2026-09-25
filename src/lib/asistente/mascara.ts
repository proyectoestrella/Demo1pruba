/**
 * Enmascarado común de ejemplos y preguntas antes de comparar: lo que ya es
 * una entidad (fecha, franja, clienta, profesional, servicio) se cambia por
 * una marca, para que la intención se decida por lo que se pregunta y no por
 * «martes», «Lucía» o «mechas». Se aplica IGUAL a los ejemplos del catálogo y
 * a la pregunta: si no, no son comparables.
 */
import { ALIAS_SERVICIO, extraerFecha, sumarDias } from "./entidades";
import { normalizar } from "./normalizar";
import { damerau } from "./parecido";
import { diaEnZona } from "./reloj";

export const MARCA_CLIENTA = "zzclienta";
export const MARCA_PRO = "zzpro";
export const MARCA_SERVICIO = "zzservicio";
export const MARCA_DIA = "zzdia";
export const MARCA_PERIODO = "zzperiodo";
export const MARCA_FRANJA = "zzfranja";

/** Palabras que nombran un servicio en cualquier salón (alias de la especificación). */
export const PALABRAS_SERVICIO = new Set(Object.values(ALIAS_SERVICIO).flat());

export interface Nombres {
  clientas?: string[];
  pros?: string[];
  /** Palabras de los nombres de la carta de este salón (se suman a los alias). */
  servicios?: string[];
  ahora?: Date;
  timeZone?: string;
}

const casa = (p: string, lista: string[]) => lista.includes(p) || (p.length >= 5 && lista.some((n) => n.length >= 5 && damerau(n, p) <= 1));

/** Texto normalizado y enmascarado, listo para `terminos`. */
export function enmascarar(texto: string, n: Nombres = {}): string {
  const ahora = n.ahora ?? new Date("2026-09-25T10:00:00Z");
  const tz = n.timeZone ?? "Europe/Madrid";
  const dominio = /\b[a-z0-9-]+\.(?:es|com|net|org|eu)\b/i.test(texto);
  let t = normalizar(texto).replace(/\bhasta (manana|luego|pronto|la vista|otra)\b/g, "despedida");
  const { fecha, franja, resto } = extraerFecha(t, ahora, tz);
  t = resto;
  const hoy = diaEnZona(ahora, tz);
  const servicios = n.servicios ?? [];
  const out: string[] = [];
  for (const p of t.split(" ").filter(Boolean)) {
    let m = p;
    if (p.length >= 3 && n.pros?.length && casa(p, n.pros)) m = MARCA_PRO;
    else if (p.length >= 3 && n.clientas?.length && casa(p, n.clientas)) m = MARCA_CLIENTA;
    else if (PALABRAS_SERVICIO.has(p) || (p.length >= 4 && servicios.includes(p))) m = MARCA_SERVICIO;
    if (m.startsWith("zz") && out[out.length - 1] === m) continue;
    out.push(m);
  }
  if (fecha) {
    if (fecha.tipo === "dia") out.push(fecha.dia === hoy ? "hoy" : fecha.dia === sumarDias(hoy, 1) ? "manana" : MARCA_DIA);
    else out.push(MARCA_PERIODO);
  }
  if (franja) out.push(MARCA_FRANJA);
  if (dominio) out.push("zzdominio");
  return out.join(" ");
}
