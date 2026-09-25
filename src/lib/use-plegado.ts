import { useEffect, useState } from "react";

/**
 * Abierto o plegado, recordado en este navegador con la clave dada. Arranca
 * con `porDefecto` (también en el servidor) y lee lo guardado al montar.
 */
export function usePlegado(clave: string | undefined, porDefecto: boolean): [boolean, () => void] {
  const [abierto, setAbierto] = useState(porDefecto);
  useEffect(() => {
    if (!clave) return;
    try {
      const g = window.localStorage.getItem(`sishow-plegado:${clave}`);
      if (g === "1" || g === "0") setAbierto(g === "1");
    } catch {
      /* sin almacenamiento: el de por defecto */
    }
  }, [clave]);
  const alternar = () =>
    setAbierto((v) => {
      try {
        if (clave) window.localStorage.setItem(`sishow-plegado:${clave}`, v ? "0" : "1");
      } catch {
        /* solo dura esta visita */
      }
      return !v;
    });
  return [abierto, alternar];
}
