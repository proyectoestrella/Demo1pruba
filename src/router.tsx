import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { routeTree } from "./routeTree.gen";
import { reescrituraPorDominio, resolverHost } from "./lib/host";

/**
 * Host de la petición (servidor) o de la pestaña (navegador). En el servidor
 * es el mismo `request.url` del que TanStack Start saca el `origin` del
 * router; fuera de una petición (no debería pasar) devuelve "" y no se
 * reescribe nada.
 */
const hostActual = createIsomorphicFn()
  .server(() => {
    try {
      return new URL(getRequest().url).hostname;
    } catch {
      return "";
    }
  })
  .client(() => window.location.hostname);

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Lote 16: el código de cada pantalla se trae al pasar el ratón (o al
    // tocar) por su enlace, no al pulsarlo.
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    // Lote 17: en `<slug>.sishow.es` la web del salón cuelga de la raíz
    // (`/` ≡ `/s/<slug>`, `/book` ≡ `/s/<slug>/book`). Solo se instala en el
    // subdominio de un salón: en sishow.es, vercel.app y localhost el router
    // queda exactamente como antes. Ver docs/dominios-sishow.md.
    rewrite: resolverHost(hostActual()).tipo === "salon" ? reescrituraPorDominio() : undefined,
  });

  return router;
};
