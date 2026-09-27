import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { DEMO_PARAM, blankDemoProfile, decodeDemoProfile } from "./demo-profile";
import { useSalonStore } from "./store";
import type { SalonProfile } from "./mock/types";
import { inferBusinessType, type BusinessType } from "./business-type";
import { demoPorSlug } from "./demos";
import { enlaceDemoEnPestana, perfilDeDemoRegistrada } from "./demos/aplicar";
import { leerPrevia } from "./vista-previa";

/** Slug de la web pública en la ruta actual (`/s/<slug>/…`), o `null`. */
function slugPublico(pathname: string): string | null {
  const m = pathname.match(/^\/s\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * El perfil que deben pintar las páginas públicas.
 *
 * Combina dos fuentes, en este orden:
 *   1. El perfil guardado en el navegador (lo que se edita en Ajustes).
 *   2. Lo que venga en el enlace (`?d=…`), que manda sobre lo anterior.
 *   3. Sin `?d=`, en `/s/<slug>` con demo registrada (lib/demos) que este
 *      navegador aún no ha cargado —el primer pintado, y siempre en el
 *      servidor—, el perfil de esa demo. En cuanto está cargada, manda lo
 *      guardado (con lo que se haya cambiado en el panel).
 *
 * Lo de la URL NO se persiste a propósito: quien abre un enlace de demo ve ese
 * salón mientras lo tiene abierto, y su propio perfil guardado queda intacto.
 */
export function useDisplayProfile(): SalonProfile {
  const stored = useSalonStore((s) => s.salonProfile);
  const search = useRouterState({ select: (s) => s.location.search }) as
    | Record<string, unknown>
    | undefined;

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Lote P: la vista previa de Mi página (`?previa=…`) trae el borrador por
  // sessionStorage, no en la dirección (ver lib/vista-previa.ts).
  const raw = typeof search?.[DEMO_PARAM] === "string"
    ? (search[DEMO_PARAM] as string)
    : search?.previa !== undefined ? leerPrevia(slugPublico(pathname)) : undefined;
  const realSalonSlug = useSalonStore((s) => s.realSalonSlug);

  return useMemo(() => {
    const fromUrl = decodeDemoProfile(raw);
    if (!fromUrl) {
      const slug = slugPublico(pathname);
      const registrada = demoPorSlug(slug);
      if (registrada && slug && slug !== realSalonSlug && stored.slug !== slug && !enlaceDemoEnPestana(slug)) {
        return perfilDeDemoRegistrada(registrada);
      }
      return stored;
    }
    // Lo que el enlace no traiga se queda en blanco, NO se hereda del salón
    // guardado en este navegador. Sin esto, la demo de una peluquería de
    // señoras salía presentándose como "barbería de toda la vida, tres
    // profesionales" y con las especialidades del salón de ejemplo: los datos
    // eran suyos y el discurso de otro, que es peor que no decir nada.
    return { ...stored, ...blankDemoProfile(), teamHours: undefined, teamIds: undefined, ...fromUrl };
  }, [stored, raw, pathname, realSalonSlug]);
}

/**
 * El tipo de negocio del perfil que se está mostrando (ver `useDisplayProfile`),
 * deducido una sola vez aquí y consumido por todas las pantallas públicas en
 * vez de que cada una vuelva a mirar el tagline con su propia regla.
 */
export function useBusinessType(): BusinessType {
  const profile = useDisplayProfile();
  return useMemo(
    () => inferBusinessType(profile.tagline, profile.name),
    [profile.tagline, profile.name],
  );
}
