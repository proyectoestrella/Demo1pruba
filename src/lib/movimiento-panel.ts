import { useEffect, useRef, useState } from "react";

/** ¿Pide la persona menos movimiento? (sistema operativo o navegador). */
export function menosMovimiento(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Curva de salida suave (sin rebote). Pura, con test. */
export function salidaSuave(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}

/**
 * Lote 16: una cifra que sube (o baja) hasta su valor en ~600 ms al aparecer
 * o cambiar. Con «menos movimiento», el valor tal cual.
 */
export function useContador(valor: number, ms = 600): number {
  const [n, setN] = useState(() => (menosMovimiento() ? valor : 0));
  const desde = useRef(n);
  useEffect(() => {
    if (menosMovimiento() || typeof requestAnimationFrame === "undefined") {
      setN(valor);
      return;
    }
    const ini = performance.now();
    const origen = desde.current;
    let id = 0;
    const paso = (t: number) => {
      const k = salidaSuave((t - ini) / ms);
      const v = origen + (valor - origen) * k;
      desde.current = v;
      setN(k >= 1 ? valor : v);
      if (k < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [valor, ms]);
  return Number.isInteger(valor) && n !== valor ? Math.round(n) : Math.round(n * 100) / 100;
}

/**
 * Para animar una cifra ya formateada («1.234,50 €», «84 %», «16»): separa
 * el número (formato español) del resto. `null` si no hay número.
 */
export function partirCifra(texto: string): { antes: string; n: number; decimales: number; despues: string } | null {
  const m = /-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?/.exec(texto);
  if (!m) return null;
  const crudo = m[0];
  const coma = crudo.indexOf(",");
  const decimales = coma >= 0 ? crudo.length - coma - 1 : 0;
  const n = Number(crudo.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return { antes: texto.slice(0, m.index), n, decimales, despues: texto.slice(m.index + crudo.length) };
}

/** Vuelve a montar la cifra con otro valor, con el mismo formato. */
export function montarCifra(p: { antes: string; decimales: number; despues: string }, n: number, miles = true): string {
  const num = n.toLocaleString("es-ES", { minimumFractionDigits: p.decimales, maximumFractionDigits: p.decimales, useGrouping: miles });
  return `${p.antes}${num}${p.despues}`;
}
