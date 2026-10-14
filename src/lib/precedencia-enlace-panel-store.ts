import { conRegistroEnPausa, useSalonStore } from "@/lib/store";
import { accionPorEnlace, type AccionEnlacePanel } from "@/lib/precedencia-enlace-panel";

/** Aplica la precedencia de la URL sobre lo guardado. Síncrono: va antes de pintar el panel. */
export function aplicarPrecedenciaDeEnlace(search: { s?: unknown; d?: unknown }): AccionEnlacePanel {
  const store = useSalonStore.getState();
  const accion = accionPorEnlace({ ...search, slugGuardado: store.salonProfile.slug });
  if (accion === "reiniciar-al-salon") {
    store.resetSalonProfile();
    conRegistroEnPausa(() => useSalonStore.getState().updateSalonProfile({ slug: String(search.s).trim() }));
  }
  return accion;
}
