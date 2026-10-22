import { paginaDeRutaPanel } from "./ruta-panel-permiso";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSalonStore } from "./store";
import { moduloVisibleEnPanel, type ModuloOcultable } from "./demo-profile";
import { permisosDe, vePagina } from "./permisos";

/**
 * Red de seguridad en el cliente para la recarga completa: `beforeLoad` no
 * ve el perfil de la demo cuando corre en el servidor (ver arriba), así que
 * esto vuelve a comprobarlo ya en el navegador, con el store hidratado desde
 * `localStorage`, y saca a `/app` si el módulo sigue oculto. Se llama al
 * principio del componente de la ruta.
 */
export function useRedirigirSiModuloOculto(clave: ModuloOcultable) {
  const navigate = useNavigate();
  const modulosOcultos = useSalonStore((s) => s.salonProfile.modulosOcultos);
  const visible = moduloVisibleEnPanel({ modulosOcultos }, clave);
  useEffect(() => {
    if (!visible) navigate({ to: "/app" });
  }, [visible, navigate]);
  return visible;
}


/**
 * Segunda puerta de las rutas del panel: el menú ya no enseña lo que no toca,
 * pero una URL guardada o escrita a mano también debe volver a Inicio. Lee el
 * miembro que ha dado el servidor, incluidos los overrides por persona.
 */
export function useRedirigirSiRutaSinPermiso(path: string): boolean {
  const navigate = useNavigate();
  const miembro = useSalonStore((s) => s.miembro);
  const pagina = paginaDeRutaPanel(path);
  const permitida =
    !pagina || vePagina(permisosDe(miembro?.rol ?? "gerente", miembro?.permisosExtra), pagina);
  useEffect(() => {
    if (!permitida) void navigate({ to: "/app", replace: true });
  }, [navigate, permitida]);
  return permitida;
}
