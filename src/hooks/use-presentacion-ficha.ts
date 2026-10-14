import { useEffect, useState } from "react";
import { presentacionDeFicha, useModoFicha, type ModoFicha, type Presentacion, type TipoFicha } from "@/lib/ficha-preferencia";

function anchoActual() {
  return typeof window === "undefined" ? 1280 : window.innerWidth;
}

/** Cómo se pinta ahora una ficha de este tipo: pantalla completa, centrada o lateral. */
export function usePresentacionFicha(tipo: TipoFicha): { presentacion: Presentacion; modo: ModoFicha; puedeAnclar: boolean } {
  const modo = useModoFicha(tipo);
  const [ancho, setAncho] = useState(anchoActual);
  useEffect(() => {
    const alCambiar = () => setAncho(window.innerWidth);
    alCambiar();
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, []);
  return { presentacion: presentacionDeFicha(modo, ancho), modo, puedeAnclar: ancho >= 1024 };
}
