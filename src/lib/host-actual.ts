import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { resolverHost } from "./host";
export const hostActual = createIsomorphicFn()
  .server(() => {
    try {
      return new URL(getRequest().url).hostname;
    } catch {
      return "";
    }
  })
  .client(() => window.location.hostname);
export function esHostPeluchic() {
  return slugSalonDelHost() === "peluchic";
}

/** Slug del salón del subdominio actual, también en local (`slug.localhost`). */
export function slugSalonDelHost(): string | undefined {
  const host = resolverHost(hostActual());
  return host.tipo === "salon" ? host.slug : undefined;
}
