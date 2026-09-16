import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSalonStore } from "./store";

/**
 * Lee `?v=` de la URL actual, ya como cadena ("2" | "1" | undefined).
 *
 * Dos cosas a tener en cuenta:
 * - El parser de búsqueda de TanStack Router convierte "2" en el NÚMERO 2,
 *   no en la cadena "2" — de ahí el `String(...)`.
 * - El `select` tiene que devolver algo más concreto que `unknown` a secas:
 *   con `unknown` puro, el tipo condicional de `useRouterState` colapsa a
 *   "unknown extends unknown" y TanStack Router devuelve el estado completo
 *   del router en vez del valor seleccionado (solo a nivel de tipos — en
 *   tiempo de ejecución el selector se aplica igual, pero rompe `tsc`).
 */
function useRawVParam(): string | undefined {
  return useRouterState({
    select: (s): string | undefined => {
      const search = s.location.search as Record<string, unknown> | undefined;
      return search?.v === undefined ? undefined : String(search.v);
    },
  });
}

/**
 * El valor efectivo de `panelV2` para ESTE render: si la URL actual trae el
 * flag, manda ahora mismo — incluido el primer render en el servidor, antes
 * de que corra ningún efecto de cliente (necesario para que la SSR ya salga
 * en v2 con `?v=2`, sin depender de la hidratación). Si la URL no lo trae, se
 * respeta lo que ya hubiera guardado el store.
 *
 * La usan TODAS las pantallas de `/app/*` — el layout para elegir el cromo, y
 * cada ruta hija para elegir su propio contenido v1/v2 — así que no hace
 * falta repetir `?v=2` en cada enlace interno para que el contenido y el
 * cromo vayan a la par.
 */
export function usePanelV2(): boolean {
  const rawV = useRawVParam();
  const stored = useSalonStore((s) => s.panelV2);
  if (rawV === "2") return true;
  if (rawV === "1") return false;
  return stored;
}

/**
 * Efecto de un solo sentido: cuando `?v=` aparece en la URL, lo deja guardado
 * en el store para que una navegación posterior dentro de `/app/*` que NO
 * repita el parámetro siga respetando la preferencia. Se llama una vez, en
 * el layout de `/app` (routes/app.tsx) — el resto de pantallas solo
 * necesitan `usePanelV2()`.
 */
export function useSyncPanelV2FromUrl() {
  const rawV = useRawVParam();
  const setPanelV2 = useSalonStore((s) => s.setPanelV2);

  useEffect(() => {
    if (rawV === "2") setPanelV2(true);
    else if (rawV === "1") setPanelV2(false);
  }, [rawV, setPanelV2]);
}
