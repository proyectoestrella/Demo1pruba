import type { SalonProfile } from "./mock/types";
import { demoPorSlug } from "./demos";
export { slugDeAcceso, volverAlSitio, manifestDelAcceso } from "./identidad-slug";

export type PerfilIdentidadAcceso = Pick<
  SalonProfile,
  "slug" | "name" | "tagline" | "logoUrl" | "terminoProfesional"
>;

/**
 * Identidad que puede conocerse sin red. Una demo registrada (PeluChic) es
 * además el respaldo correcto mientras llega la ficha pública de Supabase.
 */
export function perfilInicialDeAcceso(
  slug: string | undefined,
  guardado: SalonProfile,
): PerfilIdentidadAcceso {
  const registrado = demoPorSlug(slug);
  if (registrado) return registrado;
  if (!slug || guardado.slug === slug) return guardado;
  return { slug, name: "Tu salón", tagline: "", logoUrl: undefined };
}

/** El salón puede fijar su término; si no, el acceso no presupone oficio. */
export function terminoProfesionalDeAcceso(perfil: { terminoProfesional?: string }): string {
  const termino = perfil.terminoProfesional?.trim().toLocaleLowerCase("es");
  return termino || "profesional";
}

