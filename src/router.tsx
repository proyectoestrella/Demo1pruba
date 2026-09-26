import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

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
  });

  return router;
};
