import { useEffect, useState } from "react";
import { cargarRetratos, retratosCargados, type DibujoRetratos } from "@/lib/retratos-avatar";

/**
 * Carga DiceBear solo cuando hace falta pintar un retrato.
 * Devuelve el dibujo, `undefined` mientras carga o `null` si la carga falló.
 */
export function useDibujoRetratos(necesario: boolean): DibujoRetratos | undefined | null {
  const [dibujo, setDibujo] = useState<DibujoRetratos | undefined | null>(retratosCargados);
  useEffect(() => {
    if (!necesario || dibujo) return;
    let vivo = true;
    cargarRetratos().then(
      (m) => vivo && setDibujo(m),
      () => vivo && setDibujo(null),
    );
    return () => {
      vivo = false;
    };
  }, [necesario, dibujo]);
  return dibujo;
}
