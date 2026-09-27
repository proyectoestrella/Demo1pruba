import type { ReactNode } from "react";
import { Cabecera } from "./Cabecera";
import { Pie } from "./Pie";

/**
 * Envoltorio de todas las páginas de la web oficial: enlace para saltar al
 * contenido, cabecera, contenido y pie. La clase `.ws` da el ámbito de los
 * estilos (ver `web.css`).
 */
export function EsqueletoWeb({ children }: { children: ReactNode }) {
  return (
    <div className="ws flex min-h-screen flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[color:var(--ws-moca)] focus:px-5 focus:py-3 focus:font-bold focus:text-white"
      >
        Saltar al contenido
      </a>
      <Cabecera />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <Pie />
    </div>
  );
}
