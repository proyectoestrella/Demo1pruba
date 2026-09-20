import { useMemo } from "react";

import { inferBusinessType } from "./business-type";
import { employeesForType } from "./mock/salon";
import type { Employee } from "./mock/types";
import { esSoloUnProfesional } from "./solo-profesional";
import { useSalonStore } from "./store";

/**
 * El equipo del salón que está gestionando el panel, leído de la store.
 *
 * Las pantallas del panel importaban `employees` de `mock/salon.ts`, que es un
 * array MUTADO en sitio: sirve para pintar, pero no notifica a React cuando el
 * equipo cambia (al cargar un salón real, al aplicar una demo guardada). Este
 * hook calcula lo mismo a partir del perfil de la store —que sí es reactivo—
 * con la misma función que ya usan las páginas públicas, así que panel y web
 * no pueden discrepar sobre cuánta gente trabaja aquí.
 */
export function useEquipo(): Employee[] {
  const profile = useSalonStore((s) => s.salonProfile);
  return useMemo(
    () => employeesForType(inferBusinessType(profile.tagline, profile.name), profile.team),
    [profile.tagline, profile.name, profile.team],
  );
}

/** ¿Trabaja una sola persona en este salón? Ver `lib/solo-profesional.ts`. */
export function useSoloProfesional(): boolean {
  return esSoloUnProfesional(useEquipo());
}
