import { accesoAlPanel } from "@/lib/api/salons.functions";
import { crearCacheAcceso } from "@/lib/acceso-cache-panel";
import { accesoConReintento } from "@/lib/acceso-con-reintento";
import { refrescarSesion } from "@/lib/supabase-browser";
import { permisosDe, vePagina, type MiembroActual } from "@/lib/permisos";
import { paginaDeRutaPanel } from "@/lib/ruta-panel-permiso";

/**
 * La caché compartida por el `beforeLoad` de `/app`, `GuardiaDelPanel` y el
 * refresco del panel (rendimiento, 21-oct): una sola pregunta al servidor por
 * salón y minuto (stale-while-revalidate), en vez de una o dos por clic.
 */
export const accesoPanel = crearCacheAcceso((slug: string) =>
  accesoConReintento(() => accesoAlPanel({ data: { slug } }), refrescarSesion),
);

/** Una revalidación de fondo dijo que ya no entra: fuera, al acceso. */
export function salirPorRevocacion(slug: string) {
  accesoPanel.olvidar();
  if (typeof window !== "undefined") window.location.replace(`/login?s=${encodeURIComponent(slug)}`);
}

/**
 * ¿Puede ver esta pantalla? Se decide en el navegador con la membresía ya
 * cargada: es solo QUÉ SE PINTA. Los DATOS los sigue protegiendo el servidor
 * en cada función (exigirPermisoEn / listSalonData recortado por rol).
 */
export function permitidoEnRuta(
  acc: { real: boolean; permitido: boolean; miembro: unknown },
  pathname: string,
): boolean {
  if (!acc.real) return true;
  if (!acc.permitido) return false;
  const pagina = paginaDeRutaPanel(pathname);
  const m = acc.miembro as MiembroActual | null;
  if (!pagina || !m) return true;
  return vePagina(permisosDe(m.rol, m.permisosExtra), pagina);
}
