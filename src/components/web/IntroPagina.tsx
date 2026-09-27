import type { ReactNode } from "react";

/** Arranque de las páginas interiores: título, entradilla y, si hace falta, acciones. */
export function IntroPagina({ titulo, entradilla, children }: { titulo: string; entradilla: ReactNode; children?: ReactNode }) {
  return (
    <section className="ws-banda-arena border-b border-[color:var(--ws-lino)]">
      <div className="ws-contenedor pb-12 pt-14 md:pb-16 md:pt-20">
        <h1 className="ws-display ws-h1-s max-w-4xl">{titulo}</h1>
        <p className="ws-entradilla ws-medida-l mt-5">{entradilla}</p>
        {children}
      </div>
    </section>
  );
}
