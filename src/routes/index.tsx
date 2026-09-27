import { createFileRoute } from "@tanstack/react-router";
import { cabezaWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { Portada } from "@/components/web/Portada";

/**
 * Inicio de la web oficial de siShow (sishow.es): para la dueña de una
 * peluquería o un centro de belleza. Qué es, qué problema le quita, cómo se
 * ve de verdad, cuánto cuesta y cómo empezamos.
 */
export const Route = createFileRoute("/")({
  head: () => ({ ...cabezaWeb("inicio"), styles: [ESTILOS_WEB] }),
  component: Inicio,
});

function Inicio() {
  return (
    <EsqueletoWeb>
      <Portada />
    </EsqueletoWeb>
  );
}
