import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { DEMO_PARAM, decodeDemoProfile } from "./demo-profile";
import { useSalonStore } from "./store";
import type { SalonProfile } from "./mock/types";

/**
 * El perfil que deben pintar las páginas públicas.
 *
 * Combina dos fuentes, en este orden:
 *   1. El perfil guardado en el navegador (lo que se edita en Ajustes).
 *   2. Lo que venga en el enlace (`?d=…`), que manda sobre lo anterior.
 *
 * Lo de la URL NO se persiste a propósito: quien abre un enlace de demo ve ese
 * salón mientras lo tiene abierto, y su propio perfil guardado queda intacto.
 */
export function useDisplayProfile(): SalonProfile {
  const stored = useSalonStore((s) => s.salonProfile);
  const search = useRouterState({ select: (s) => s.location.search }) as
    | Record<string, unknown>
    | undefined;

  const raw = typeof search?.[DEMO_PARAM] === "string" ? (search[DEMO_PARAM] as string) : undefined;

  return useMemo(() => {
    const fromUrl = decodeDemoProfile(raw);
    if (!fromUrl) return stored;
    // Si el enlace trae su propia portada, cualquier selección de galería
    // guardada en este navegador es de otro local: sus índices apuntarían, en
    // esta ficha, a fotos que no tienen nada que ver.
    const galeriaAjena = fromUrl.heroImage && !fromUrl.galleryPhotos;
    return { ...stored, ...fromUrl, ...(galeriaAjena ? { galleryPhotos: [] } : {}) };
  }, [stored, raw]);
}
