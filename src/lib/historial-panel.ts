/**
 * Ajustes › Historial de cambios (lote 14), sin que la pantalla distinga
 * demo de salón real:
 *   - Demo por enlace: la lista local de la store (`useCambios` de
 *     deshacer-maqueta.ts), ya acotada a 200 cambios / 90 días.
 *   - Salón real: `listarCambios` de `api/cambios.functions.ts` (BACKEND,
 *     lote 9), paginada por día con «cargar más» (`antesDe` = la fecha del
 *     cambio más antiguo ya traído). Los filtros de grupo, persona y
 *     búsqueda de la pantalla siguen aplicándose en el cliente sobre lo ya
 *     cargado, como en la demo: el servidor solo pagina.
 *
 * «Deshacer» sigue siendo el de siempre (`estadoDeshacer`/`deshacerConAviso`
 * de deshacer-maqueta.ts, que miran `useSalonStore.getState().cambios`, la
 * store de ESTE navegador). Eso alcanza sin más para lo hecho en esta
 * sesión. Un cambio que el servidor enseña pero que esta store no conoce
 * (de otro dispositivo, o de antes de esta sesión) se ve en la lista, pero
 * sin botón «Deshacer»: no hay forma fiable de saber si sigue pudiéndose
 * deshacer sin ese estado, y no se reimplementa esa lógica aquí.
 */
import { useCallback, useEffect, useState } from "react";
import { listarCambios } from "./api/cambios.functions";
import type { Cambio } from "./cambios";

/** Cuántos cambios pide cada página del servidor. */
export const CAMBIOS_POR_PAGINA = 60;

export interface EstadoHistorialPanel {
  cambios: Cambio[];
  /** Cargando la primera página (o recargando desde cero). */
  cargando: boolean;
  /** Cargando una página siguiente («cargar más»), sin vaciar lo que ya hay. */
  cargandoMas: boolean;
  error: string | null;
  hayMas: boolean;
  cargarMas: () => void;
  recargar: () => void;
}

/**
 * Agrupa una lista de cambios (se asume ya ordenada del más nuevo al más
 * viejo, que es como los devuelve tanto la store como el servidor) por su
 * etiqueta de día. `etiquetaDia` decide el texto («Hoy», «Ayer», «vie 12
 * sep»…); se recibe como función para no atar esto al reloj del sistema.
 */
export function agruparPorDia<T extends { fecha: string }>(cambios: T[], etiquetaDia: (fecha: string) => string): Array<[string, T[]]> {
  const porDia = new Map<string, T[]>();
  for (const c of cambios) {
    const k = etiquetaDia(c.fecha);
    const lista = porDia.get(k);
    if (lista) lista.push(c);
    else porDia.set(k, [c]);
  }
  return [...porDia.entries()];
}

/**
 * ¿Hay página siguiente, y con qué `antesDe` se pide? El servidor no dice
 * cuántos quedan: la señal es recibir una página llena (si vino más corta
 * que el límite, no hay más). `ultimaFecha` es la del cambio más viejo ya
 * en la lista.
 */
export function siguientePagina(recibidosEnUltimaPagina: number, limite: number, ultimaFecha: string | undefined): { hayMas: boolean; antesDe: string | undefined } {
  if (recibidosEnUltimaPagina < limite || !ultimaFecha) return { hayMas: false, antesDe: undefined };
  return { hayMas: true, antesDe: ultimaFecha };
}

const SIN_CAMBIOS: Cambio[] = [];

/** El historial del servidor para un salón real, paginado por `antesDe`. */
export function useHistorialServidor(slug: string, activo: boolean): EstadoHistorialPanel {
  const [cambios, setCambios] = useState<Cambio[]>(SIN_CAMBIOS);
  const [cargando, setCargando] = useState(activo);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(true);

  const pedirPrimeraPagina = useCallback(() => {
    setCargando(true);
    setCambios(SIN_CAMBIOS);
    setHayMas(true);
    setError(null);
    listarCambios({ data: { slug, limite: CAMBIOS_POR_PAGINA } })
      .then((res) => {
        setCambios(res.cambios as Cambio[]);
        setHayMas(siguientePagina(res.cambios.length, CAMBIOS_POR_PAGINA, res.cambios[res.cambios.length - 1]?.fecha).hayMas);
        if ("aviso" in res && res.aviso) setError(res.aviso);
      })
      .catch((err) => {
        console.error("No se pudo cargar el historial de cambios:", err);
        setError("No se ha podido cargar el historial.");
      })
      .finally(() => setCargando(false));
  }, [slug]);

  useEffect(() => {
    if (!activo) return;
    pedirPrimeraPagina();
    // pedirPrimeraPagina cambia con `slug`, que ya está en sus dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, pedirPrimeraPagina]);

  const cargarMas = useCallback(() => {
    const ultimo = cambios[cambios.length - 1];
    const antesDe = ultimo?.fecha;
    if (!antesDe || cargandoMas) return;
    setCargandoMas(true);
    setError(null);
    listarCambios({ data: { slug, antesDe, antesDeId: ultimo.id, limite: CAMBIOS_POR_PAGINA } })
      .then((res) => {
        setCambios((prev) => {
          const vistos = new Set(prev.map((c) => c.id));
          return [...prev, ...(res.cambios as Cambio[]).filter((c) => !vistos.has(c.id))];
        });
        setHayMas(siguientePagina(res.cambios.length, CAMBIOS_POR_PAGINA, res.cambios[res.cambios.length - 1]?.fecha).hayMas);
        if ("aviso" in res && res.aviso) setError(res.aviso);
      })
      .catch((err) => {
        console.error("No se pudo cargar más historial:", err);
        setError("No se ha podido cargar más historial.");
      })
      .finally(() => setCargandoMas(false));
  }, [slug, cambios, cargandoMas]);

  if (!activo) {
    return { cambios: SIN_CAMBIOS, cargando: false, cargandoMas: false, error: null, hayMas: false, cargarMas: () => undefined, recargar: () => undefined };
  }
  return { cambios, cargando, cargandoMas, error, hayMas, cargarMas, recargar: pedirPrimeraPagina };
}
