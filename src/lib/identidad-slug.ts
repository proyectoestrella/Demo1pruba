// Parte de identidad-acceso que no necesita las demos: vive en el chunk inicial.
import { resolverHost } from "./host";

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

/** En el dominio del propio salón su web es `/`; fuera, `/s/<slug>`. */
export function volverAlSitio(slug: string | undefined, hostname: string): string {
  if (!slug) return "/";
  const host = resolverHost(hostname);
  return host.tipo === "salon" && host.slug === slug ? "/" : `/s/${encodeURIComponent(slug)}`;
}

export function manifestDelAcceso(slug: string | undefined): string {
  return slug === "peluchic" ? "/manifest-peluchic.webmanifest" : "/manifest-panel.webmanifest";
}
