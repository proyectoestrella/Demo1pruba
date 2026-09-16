import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { DEMO_PARAM, blankDemoProfile, decodeDemoProfile } from "./demo-profile";
import { useSalonStore } from "./store";
import type { SalonProfile } from "./mock/types";
import { inferBusinessType, type BusinessType } from "./business-type";

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
    // Lo que el enlace no traiga se queda en blanco, NO se hereda del salón
    // guardado en este navegador. Sin esto, la demo de una peluquería de
    // señoras salía presentándose como "barbería de toda la vida, tres
    // profesionales" y con las especialidades del salón de ejemplo: los datos
    // eran suyos y el discurso de otro, que es peor que no decir nada.
    return { ...stored, ...blankDemoProfile(), ...fromUrl };
  }, [stored, raw]);
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
