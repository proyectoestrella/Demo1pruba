import type { SalonProfile } from "./mock/types";
import { demoPorSlug } from "./demos";
import { resolverHost } from "./host";

export type PerfilIdentidadAcceso = Pick<
  SalonProfile,
  "slug" | "name" | "tagline" | "logoUrl" | "terminoProfesional"
>;

/** La URL manda; después el subdominio y, por último, el salón guardado. */
export function slugDeAcceso({
  slugDesdeUrl,
  hostname,
  slugGuardado,
}: {
  slugDesdeUrl: unknown;
  hostname: string;
  slugGuardado?: string | null;
}): string | undefined {
  if (typeof slugDesdeUrl === "string" && slugDesdeUrl.trim()) return slugDesdeUrl.trim();
  const host = resolverHost(hostname);
  if (host.tipo === "salon") return host.slug;
  return slugGuardado?.trim() || undefined;
}

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

/** En el dominio del propio salón su web es `/`; fuera, `/s/<slug>`. */
export function volverAlSitio(slug: string | undefined, hostname: string): string {
  if (!slug) return "/";
  const host = resolverHost(hostname);
  return host.tipo === "salon" && host.slug === slug ? "/" : `/s/${encodeURIComponent(slug)}`;
}

export function manifestDelAcceso(slug: string | undefined): string {
  return slug === "peluchic" ? "/manifest-peluchic.webmanifest" : "/manifest-panel.webmanifest";
}
