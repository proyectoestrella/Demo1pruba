/**
 * Versiones publicadas de Mi página (lote 12): las 20 últimas, con fecha y
 * quién publicó. CONECTAR: en un salón real, `listarVersiones` y
 * `restaurarVersion` de `salons.functions.ts` (BACKEND lote 9); aquí viven en
 * este navegador, por salón.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SalonProfile } from "./mock/types";

export const MAX_VERSIONES = 20;

/** Los campos que publica Mi página (el equipo se edita en Equipo). */
export const CAMPOS_WEB = [
  "name", "tagline", "about", "address", "phone", "instagram", "heroImage", "logoUrl",
  "rating", "reviewCount", "specialties", "openingHours", "menu", "faq", "priorityHours",
] as const;
type CampoWeb = (typeof CAMPOS_WEB)[number];
export type WebPublicada = Partial<Pick<SalonProfile, Extract<CampoWeb, keyof SalonProfile>>> & Record<string, unknown>;

export interface VersionWeb {
  id: string;
  fecha: string;
  autorNombre: string | null;
  web: WebPublicada;
}

export function webDe(perfil: Partial<SalonProfile>): WebPublicada {
  const p = perfil as Record<string, unknown>;
  return Object.fromEntries(CAMPOS_WEB.filter((k) => k in p).map((k) => [k, p[k]])) as WebPublicada;
}

interface EstadoVersiones {
  porSalon: Record<string, VersionWeb[]>;
  guardar: (slug: string, web: WebPublicada, autorNombre: string | null, fecha?: string) => void;
}

export const useVersiones = create<EstadoVersiones>()(
  persist(
    (set) => ({
      porSalon: {},
      guardar: (slug, web, autorNombre, fecha = new Date().toISOString()) =>
        set((s) => {
          const v: VersionWeb = { id: `v-${Date.parse(fecha)}-${Math.random().toString(36).slice(2, 6)}`, fecha, autorNombre, web };
          return { porSalon: { ...s.porSalon, [slug]: [v, ...(s.porSalon[slug] ?? [])].slice(0, MAX_VERSIONES) } };
        }),
    }),
    { name: "sishow-versiones-web", storage: createJSONStorage(() => localStorage) },
  ),
);

const ETIQUETA: Record<CampoWeb, string> = {
  name: "Nombre",
  tagline: "Tipo de negocio",
  about: "Texto de presentación",
  address: "Dirección",
  phone: "Teléfono",
  instagram: "Instagram",
  heroImage: "Foto de portada",
  logoUrl: "Logo",
  rating: "Nota de Google",
  reviewCount: "Reseñas de Google",
  specialties: "Especialidades",
  openingHours: "Horario",
  menu: "Servicios",
  faq: "Preguntas frecuentes",
  priorityHours: "Horas preferentes",
};
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function texto(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}
const corto = (t: string, n = 60) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export interface Diferencia {
  campo: string;
  etiqueta: string;
  antes: string;
  despues: string;
}

/** Lo que cambia de `desde` a `hasta`, campo a campo y en palabras. */
export function diferenciasWeb(desde: WebPublicada, hasta: WebPublicada): Diferencia[] {
  const out: Diferencia[] = [];
  for (const k of CAMPOS_WEB) {
    const a = desde[k];
    const b = hasta[k];
    // Vacío, null y sin definir son lo mismo: no hay nada que enseñar.
    const vacio = (v: unknown) => (v === "" || v === undefined ? null : v);
    if (JSON.stringify(vacio(a)) === JSON.stringify(vacio(b))) continue;
    if (k === "openingHours" && Array.isArray(a) && Array.isArray(b)) {
      DIAS.forEach((d, i) => {
        if (a[i] !== b[i]) out.push({ campo: `${k}.${i}`, etiqueta: `Horario · ${d}`, antes: texto(a[i]), despues: texto(b[i]) });
      });
      continue;
    }
    if (k === "menu" && Array.isArray(a) && Array.isArray(b)) {
      const quitados = a.filter((x) => !b.includes(x));
      const puestos = b.filter((x) => !a.includes(x));
      out.push({ campo: k, etiqueta: ETIQUETA[k], antes: corto(quitados.join(" · ") || "—", 90), despues: corto(puestos.join(" · ") || "—", 90) });
      continue;
    }
    out.push({ campo: k, etiqueta: ETIQUETA[k], antes: corto(texto(a)), despues: corto(texto(b)) });
  }
  return out;
}
