import { useCallback } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { busquedaConFicha, fichaDeBusqueda, type FichaAbierta } from "./ficha-url";

/** La ficha de la que venimos, para el «Volver» de la ficha nueva. Vive solo en esta pestaña. */
let anterior: FichaAbierta = null;

/** La ficha que pide la URL ahora mismo. */
export function useFichaAbierta(): FichaAbierta {
  const clienta = useRouterState({ select: (s) => (s.location.search as Record<string, unknown>)?.clienta });
  const cita = useRouterState({ select: (s) => (s.location.search as Record<string, unknown>)?.cita });
  return fichaDeBusqueda({ clienta, cita });
}

/**
 * Abrir y cerrar fichas desde cualquier sitio, sin pasar estado: se cambia la
 * URL (`?clienta=` / `?cita=`) y `FichasGlobales` pinta la ficha. Abrir una
 * ficha deja una entrada en el historial, así «atrás» la cierra.
 */
export function useFichas() {
  const router = useRouter();
  const actual = useFichaAbierta();

  const ir = useCallback(
    (ficha: FichaAbierta, replace: boolean) => {
      void router.navigate({
        to: ".",
        search: ((prev: Record<string, unknown>) => busquedaConFicha(prev, ficha)) as never,
        replace,
        resetScroll: false,
      });
    },
    [router],
  );

  const abrir = useCallback(
    (ficha: Exclude<FichaAbierta, null>) => {
      anterior = actual && actual.tipo !== ficha.tipo ? actual : null;
      ir(ficha, false);
    },
    [actual, ir],
  );

  return {
    ficha: actual,
    abrirClienta: useCallback((id: string) => abrir({ tipo: "clienta", id }), [abrir]),
    abrirCita: useCallback((id: string) => abrir({ tipo: "cita", id }), [abrir]),
    cerrar: useCallback(() => {
      anterior = null;
      ir(null, true);
    }, [ir]),
    /** Hay una ficha de la que venimos (cita → clienta, o al revés). */
    puedeVolver: anterior !== null && actual !== null && anterior.tipo !== actual.tipo,
    volver: useCallback(() => {
      const a = anterior;
      anterior = null;
      if (a) ir(a, true);
    }, [ir]),
  };
}
