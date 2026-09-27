import { createFileRoute } from "@tanstack/react-router";
import { cabezaWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { IntroPagina } from "@/components/web/IntroPagina";

export const Route = createFileRoute("/legal/privacidad")({
  head: () => ({ ...cabezaWeb("privacidad"), styles: [ESTILOS_WEB] }),
  component: Privacidad,
});

function Privacidad() {
  return (
    <EsqueletoWeb>
      <IntroPagina titulo="Política de privacidad" entradilla="Qué datos tratamos cuando nos escribes, para qué y cómo ejercer tus derechos." />
    </EsqueletoWeb>
  );
}
