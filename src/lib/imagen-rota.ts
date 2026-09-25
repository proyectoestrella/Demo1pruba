import { useCallback, useEffect, useRef, useState } from "react";

/** ¿Terminó de cargar una imagen sin poder pintarla? (`complete` con ancho natural 0). */
export function imagenYaRota(img: Pick<HTMLImageElement, "complete" | "naturalWidth"> | null): boolean {
  return !!img && img.complete && img.naturalWidth === 0;
}

/**
 * Qué fuentes de imagen han fallado. En una página con SSR la imagen puede
 * fallar ANTES de hidratar, y entonces React no ve su `onError`: por eso, al
 * montar, se mira también si ya estaba rota. `ref` y `onError` van en el <img>.
 */
export function useImagenesRotas() {
  const [rotas, setRotas] = useState<ReadonlySet<string>>(() => new Set());
  const marcar = useCallback((src: string | undefined) => {
    if (!src) return;
    setRotas((s) => (s.has(src) ? s : new Set(s).add(src)));
  }, []);
  /** `ref` para un <img>: si ya llegó roto al montar, se marca en el momento. */
  const vigilar = useCallback(
    (src: string | undefined) => (img: HTMLImageElement | null) => {
      if (imagenYaRota(img)) marcar(src);
    },
    [marcar],
  );
  return { rotas, marcar, vigilar };
}

/** Una sola imagen con respaldo: devuelve la fuente a usar y lo que va en el <img>. */
export function useImagenConRespaldo(propia: string | undefined, respaldo: string) {
  const { rotas, marcar } = useImagenesRotas();
  const ref = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (imagenYaRota(ref.current)) marcar(propia);
  }, [propia, marcar]);
  const src = propia && !rotas.has(propia) ? propia : respaldo;
  return { src, ref, onError: () => marcar(propia) };
}
