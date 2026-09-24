import { useEffect, useState } from "react";
import { listSalonData } from "./api/salons.functions";
import { useSalonStore } from "./store";
import { sincronizacionPendiente } from "./salon-sync";
import { debeAplazarRefresco, haceCuanto } from "./panel-refresh";

export function usePanelRefresh(slug: string | null) {
  const [actualizado, setActualizado] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!slug) { setActualizado(null); return; }
    setActualizado(Date.now());
    let activo = true;
    let consultando = false;
    const editando = () => {
      const el = document.activeElement;
      return !!el?.matches("input, textarea, select, [contenteditable='true']") ||
        !!document.querySelector("[role='dialog'][data-state='open']");
    };
    const refrescar = async () => {
      if (consultando || useSalonStore.getState().realSalonSlug !== slug ||
        debeAplazarRefresco(document.visibilityState === "visible", editando(), sincronizacionPendiente())) return;
      consultando = true;
      try {
        const datos = await listSalonData({ data: { slug, vista: "panel" } });
        if (activo && useSalonStore.getState().realSalonSlug === slug &&
          !debeAplazarRefresco(document.visibilityState === "visible", editando(), sincronizacionPendiente())) {
          useSalonStore.getState().hydrateFromServer(datos);
          const instante = Date.now();
          setActualizado(instante);
          setAhora(instante);
        }
      } catch (error) {
        console.error("No se pudo actualizar la agenda:", error);
      } finally { consultando = false; }
    };
    const alVolver = () => { if (document.visibilityState === "visible") void refrescar(); };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    const intervalo = window.setInterval(() => { setAhora(Date.now()); void refrescar(); }, 60_000);
    return () => { activo = false; document.removeEventListener("visibilitychange", alVolver); window.removeEventListener("focus", alVolver); window.clearInterval(intervalo); };
  }, [slug]);

  return slug && actualizado ? `Actualizado ${haceCuanto(actualizado, ahora)}` : null;
}
