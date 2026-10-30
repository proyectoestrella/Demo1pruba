import { useEffect, useState } from "react";
import { cerrarSesion } from "./sesion";
import { accesoConReintento, esRevocacion } from "./acceso-con-reintento";
import { haySesionLocal, refrescarSesion, tokenDeAcceso } from "./supabase-browser";
import { accesoAlPanel, listSalonData } from "./api/salons.functions";
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
        // Acceso y agenda a la vez (antes en serie). Si el acceso cae, los
        // datos se descartan: el servidor ya los habría recortado igualmente.
        const [entrada, datos] = await Promise.all([
          accesoConReintento(() => accesoAlPanel({ data: { slug } }), refrescarSesion, haySesionLocal),
          listSalonData({ data: { slug, vista: "panel" } }),
        ]);
        // Solo una baja explícita (el servidor verificó quién eres y el salón ya
        // no te reconoce) cierra la sesión. Una sesión sin renovar o un fallo de
        // red lanzan AccesoNoVerificable arriba y caen en el catch sin tocar nada.
        if (esRevocacion(entrada)) { await cerrarSesion(); return; }
        if (!entrada.permitido) return;
        useSalonStore.getState().setMiembro(entrada.miembro);
        if (activo && useSalonStore.getState().realSalonSlug === slug &&
          !debeAplazarRefresco(document.visibilityState === "visible", editando(), sincronizacionPendiente())) {
          useSalonStore.getState().hydrateFromServer(datos);
          // Señales vencidas: solo se liberan solas si el salón lo activó
          // (lib/senal.ts, `revisarVencimiento`). Sin eso, se avisa y decide ella.
          useSalonStore.getState().liberarSenalesVencidas();
          const instante = Date.now();
          setActualizado(instante);
          setAhora(instante);
        }
      } catch (error) {
        console.error("No se pudo actualizar la agenda:", error);
      } finally { consultando = false; }
    };
    // Al volver (pestaña visible, foco, red recuperada) primero se asegura un
    // token vigente —getSession renueva si está por caducar— y luego se pide.
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      void tokenDeAcceso().finally(() => { void refrescar(); });
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    window.addEventListener("online", alVolver);
    const intervalo = window.setInterval(() => { setAhora(Date.now()); void refrescar(); }, 60_000);
    return () => { activo = false; document.removeEventListener("visibilitychange", alVolver); window.removeEventListener("focus", alVolver); window.removeEventListener("online", alVolver); window.clearInterval(intervalo); };
  }, [slug]);

  return slug && actualizado ? `Actualizado ${haceCuanto(actualizado, ahora)}` : null;
}
