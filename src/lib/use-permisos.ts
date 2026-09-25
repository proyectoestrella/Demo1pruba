/**
 * Permisos de quien está usando el panel, para la pantalla (lote 8).
 *
 * Ocultar no es proteger: el servidor ya recorta los datos y rechaza lo que
 * no toca (lib/api/autorizacion.ts). Esto solo evita pintar botones que
 * fallarían.
 */
import { PERMISOS_DEMO, permisosDe, type MiembroActual, type Permisos } from "./permisos";
import { useSalonStore } from "./store";

/** El miembro que ha entrado, o `null` en una demo o mientras se resuelve. */
export function useMiembroActual(): MiembroActual | null {
  return useSalonStore((s) => s.miembro);
}

/** Permisos efectivos: los del rol del miembro; en una demo, los de la gerente. */
export function usePermisos(): Permisos {
  const m = useSalonStore((s) => s.miembro);
  return m ? permisosDe(m.rol) : PERMISOS_DEMO;
}

/** «Buenos días, Noelia» / «Buenas tardes» sin nombre. `hora` en el día del salón. */
export function saludo(nombre: string | null | undefined, hora: number): string {
  const franja = hora < 14 ? "Buenos días" : hora < 21 ? "Buenas tardes" : "Buenas noches";
  const pila = nombre?.trim().split(/\s+/)[0];
  return pila ? `${franja}, ${pila}` : franja;
}
