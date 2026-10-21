import { redirect } from "@tanstack/react-router";
import { moduloVisibleEnPanel, type ModuloOcultable } from "./demo-profile";
import { perfilGuardado } from "./perfil-ref";

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
    // Sin store aún cargada (no ocurre dentro del panel: /app la carga) no hay
    // nada que ocultar. Así la landing no arrastra la store por este guard.
    const modulosOcultos = perfilGuardado()?.modulosOcultos;
    if (!moduloVisibleEnPanel({ modulosOcultos }, clave)) {
      throw redirect({ to: "/app" });
    }
  };
}
