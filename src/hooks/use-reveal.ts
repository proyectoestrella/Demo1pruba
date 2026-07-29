import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether an element has scrolled into the viewport, for scroll-reveal
 * animations. Respects `prefers-reduced-motion: reduce`: reduced-motion users
 * get `visible: true` immediately (no observer, no motion at all).
 *
 * The element starts hidden on both server and first client render (so SSR
 * markup and hydration match — no flash/mismatch), then flips to visible once
 * it intersects the viewport.
 */
export function useReveal<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px", ...options },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // `options` intentionally excluded: it's only ever passed as an inline
    // literal (new identity every render) by the few callers that need it,
    // and re-subscribing the observer on every render would be wasteful —
    // the observer only needs to be (re)created when the node itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, visible };
}
