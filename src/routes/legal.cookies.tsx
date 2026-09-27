import { createFileRoute } from "@tanstack/react-router";
import { cabezaWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { IntroPagina } from "@/components/web/IntroPagina";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({ ...cabezaWeb("cookies"), styles: [ESTILOS_WEB] }),
  component: Cookies,
});

function Cookies() {
  return (
    <EsqueletoWeb>
      <IntroPagina titulo="Política de cookies" entradilla="Qué se guarda en tu navegador cuando visitas sishow.es y para qué." />
    </EsqueletoWeb>
  );
}
