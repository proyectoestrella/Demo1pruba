import { accesoAlPanel } from "@/lib/api/salons.functions";
import { crearCacheAcceso } from "@/lib/acceso-cache-panel";

/** La caché compartida por el `beforeLoad` de `/app` y `GuardiaDelPanel`. */
export const accesoPanel = crearCacheAcceso((slug: string) => accesoAlPanel({ data: { slug } }));
