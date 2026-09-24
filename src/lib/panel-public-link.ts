import { useRouterState } from "@tanstack/react-router";
import { DEMO_PARAM, decodeDemoProfile, demoUrl, slugify } from "./demo-profile";
import type { SalonProfile } from "./mock/types";
import { useSalonStore } from "./store";

/** Enlace público del salón que está abierto en el panel. */
export function panelPublicLink(
  profile: SalonProfile,
  realSalonSlug: string | null,
  demoActive: boolean,
  demoRaw?: unknown,
): string {
  if (realSalonSlug) return `/s/${realSalonSlug}`;

  const fromUrl = typeof demoRaw === "string" ? decodeDemoProfile(demoRaw) : null;
  if (fromUrl) {
    const slug = slugify(fromUrl.name ?? "") || "demo";
    return `/s/${slug}?${DEMO_PARAM}=${demoRaw}`;
  }

  // La navegación interna del panel quita ?d=; el perfil ya aplicado permite
  // reconstruir un enlace autocontenido, incluida la carta del salón.
  if (demoActive) return demoUrl(profile, "");
  return `/s/${profile.slug}`;
}

export function usePanelPublicLink(): string {
  const profile = useSalonStore((s) => s.salonProfile);
  const realSalonSlug = useSalonStore((s) => s.realSalonSlug);
  const demoActive = useSalonStore((s) => s.demoActive);
  const demoRaw = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.[DEMO_PARAM],
  });
  return panelPublicLink(profile, realSalonSlug, demoActive, demoRaw);
}
