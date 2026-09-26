import { useEffect, useRef, useState } from "react";

/**
 * Entrada suave de un bloque la primera vez que aparece en pantalla.
 *
 * Lote 17: antes el bloque nacía OCULTO (opacidad 0 desde el servidor) y solo
 * aparecía al cruzar el 15 % de su alto. Sin JS, al saltar por un ancla, en la
 * vista previa de un enlace o en una captura de página completa, media web
 * salía en blanco. Ahora es al revés:
 *
 * - `armado` empieza en false: el servidor y el primer pintado lo enseñan todo.
 * - Al montar, solo se «arma» (se oculta para entrar luego) lo que está POR
 *   DEBAJO de la pantalla; lo que ya se ve no parpadea.
 * - Entra en cuanto asoma un píxel (umbral 0), una sola vez, y hay un seguro
 *   de 2,5 s que lo enseña igualmente si el observador no llega a dispararse.
 * - Con `prefers-reduced-motion` no se arma nunca.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [armado, setArmado] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;

    setArmado(true);
    setVisible(false);
    const mostrar = () => {
      setVisible(true);
      observer.disconnect();
      window.clearTimeout(seguro);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) mostrar();
      },
      { threshold: 0, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(node);
    const seguro = window.setTimeout(() => {
      // Si nadie ha hecho scroll hasta él, no hace falta enseñarlo ya; pero si
      // el navegador no dispara el observador (pestaña en segundo plano,
      // captura), que el bloque no se quede nunca a opacidad 0.
      if (node.getBoundingClientRect().top < window.innerHeight * 1.5) mostrar();
    }, 2500);
    return () => {
      observer.disconnect();
      window.clearTimeout(seguro);
    };
  }, []);

  return { ref, visible: !armado || visible, armado };
}
