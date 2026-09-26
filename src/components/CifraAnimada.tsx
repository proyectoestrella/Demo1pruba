import { montarCifra, partirCifra, useContador } from "@/lib/movimiento-panel";

/**
 * Lote 16: una cifra que sube hasta su valor al aparecer o cambiar. Acepta
 * el texto ya formateado («615 €», «84 %»); al terminar enseña exactamente
 * ese texto. Con «menos movimiento», el texto tal cual.
 */
export function CifraAnimada({ texto }: { texto: string | number }) {
  const t = String(texto);
  const p = partirCifra(t);
  const n = useContador(p?.n ?? 0);
  if (!p || n === p.n) return <>{t}</>;
  return <>{montarCifra(p, n)}</>;
}
