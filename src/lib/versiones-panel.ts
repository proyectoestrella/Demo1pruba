/**
 * Mi página › Versiones anteriores (lote 14), sin que la pantalla distinga
 * demo de salón real:
 *   - Demo por enlace: la lista local de `useVersiones` (versiones-maqueta.ts,
 *     por navegador). Cada versión trae su `web`, así que se pueden comparar
 *     campo a campo antes de restaurar.
 *   - Salón real: `listarVersiones`/`restaurarVersion` de
 *     `api/salons.functions.ts` (BACKEND, lote 9). La lista del servidor SOLO
 *     trae fecha y autora (`perfil_versiones` no expone el contenido para no
 *     bajar el perfil entero de cada versión a la lista): el contenido de una
 *     versión real no se conoce hasta restaurarla, así que no hay diferencias
 *     que enseñar antes de decidir — solo fecha, autora y el botón.
 */
import { useCallback, useEffect, useState } from "react";
import { listarVersiones, restaurarVersion } from "./api/salons.functions";
import { conRegistroEnPausa, useSalonStore } from "./store";
import { useVersiones, webDe, diferenciasWeb, type WebPublicada, type Diferencia } from "./versiones-maqueta";
import type { SalonProfile } from "./mock/types";

export { webDe, diferenciasWeb };
export type { WebPublicada, Diferencia };

/**
 * Una versión tal y como la pinta la pantalla. `web` es el contenido
 * publicado en esa versión; en un salón real vale `null` hasta que se
 * restaura (no se conoce antes).
 */
export interface VersionPanel {
  id: string;
  fecha: string;
  autorNombre: string | null;
  web: WebPublicada | null;
}

const SIN_VERSIONES: VersionPanel[] = [];

export interface EstadoVersionesPanel {
  versiones: VersionPanel[];
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}

/** Versiones publicadas de Mi página para este salón (demo o real). */
export function useVersionesPanel(slug: string, esReal: boolean): EstadoVersionesPanel {
  const demoVersiones = useVersiones((s) => s.porSalon[slug]);
  const [servidor, setServidor] = useState<VersionPanel[]>([]);
  const [cargando, setCargando] = useState(esReal);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!esReal) return;
    let cancelado = false;
    setCargando(true);
    setError(null);
    listarVersiones({ data: { slug } })
      .then((res) => {
        if (cancelado) return;
        setServidor(res.versiones.map((v) => ({ id: v.id, fecha: v.fecha, autorNombre: v.autorNombre, web: null })));
      })
      .catch((err) => {
        if (cancelado) return;
        console.error("No se pudieron cargar las versiones de Mi página:", err);
        setError("No se han podido cargar las versiones anteriores.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [slug, esReal, intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  if (!esReal) {
    return {
      versiones: (demoVersiones ?? SIN_VERSIONES).map((v) => ({ id: v.id, fecha: v.fecha, autorNombre: v.autorNombre, web: v.web })),
      cargando: false,
      error: null,
      recargar: () => undefined,
    };
  }
  return { versiones: servidor, cargando, error, recargar };
}

export type ResultadoRestaurar = { ok: true; profile: Partial<SalonProfile> } | { ok: false; motivo: string };

/**
 * Restaura una versión anterior en un salón REAL: pide al servidor que la
 * vuelva a publicar (deja su propia fila en Versiones y en el Historial de
 * cambios, tipo `perfil.restaurar`) y aplica en local el perfil que
 * devuelve, sin volver a registrar cambio a cambio (`conRegistroEnPausa`):
 * el servidor ya ha dejado constancia de esto como UN solo cambio.
 *
 * La demo no pasa por aquí: se restaura en local con `webDe`/`publicarEnPanel`
 * de siempre (ver `app.web.tsx`), porque una demo no tiene versiones en el
 * servidor.
 */
export async function restaurarVersionReal(slug: string, versionId: string): Promise<ResultadoRestaurar> {
  const res = await restaurarVersion({ data: { slug, versionId } });
  if (!res.ok) return res;
  const perfil = res.profile as Partial<SalonProfile>;
  conRegistroEnPausa(() => useSalonStore.getState().updateSalonProfile(perfil));
  return { ok: true, profile: perfil };
}
