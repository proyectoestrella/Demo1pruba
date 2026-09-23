import { useEffect } from "react";
import { redirect, useNavigate } from "@tanstack/react-router";
import { useSalonStore } from "./store";
import { moduloVisible, type ModuloOcultable } from "./demo-profile";

/**
 * `beforeLoad` para una ruta que una demo puede ocultar (Equipo, Marketing,
 * Lista de espera). Si la demo activa oculta este módulo y alguien navega
 * directo a la URL DESDE DENTRO del panel (link, atrás/adelante...), redirige
 * a `/app` antes de montar la pantalla.
 *
 * No cubre la recarga completa del navegador (escribir la URL a mano y
 * pulsar Enter): el perfil de la demo vive solo en el `localStorage` del
 * cliente, y `beforeLoad` en esta app corre también en el primer render del
 * servidor, donde ese `localStorage` no existe — ahí siempre ve el perfil de
 * ejemplo (sin módulos ocultos) y deja pasar. Para ESE caso está
 * `useRedirigirSiModuloOculto` abajo, que corre ya en el cliente hidratado.
 */
export function beforeLoadSiModuloVisible(clave: ModuloOcultable) {
  return () => {
    const { modulosOcultos } = useSalonStore.getState().salonProfile;
    if (!moduloVisible({ modulosOcultos }, clave)) {
      throw redirect({ to: "/app" });
    }
  };
}

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
  const visible = moduloVisible({ modulosOcultos }, clave);
  useEffect(() => {
    if (!visible) navigate({ to: "/app" });
  }, [visible, navigate]);
  return visible;
}
