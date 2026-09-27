import { createFileRoute } from "@tanstack/react-router";
import { cabezaWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { IntroPagina } from "@/components/web/IntroPagina";

export const Route = createFileRoute("/legal/aviso-legal")({
  head: () => ({ ...cabezaWeb("aviso-legal"), styles: [ESTILOS_WEB] }),
  component: AvisoLegal,
});

function AvisoLegal() {
  return (
    <EsqueletoWeb>
      <IntroPagina titulo="Aviso legal" entradilla="Quién es el titular de esta web y en qué condiciones se usa." />
    </EsqueletoWeb>
  );
}
