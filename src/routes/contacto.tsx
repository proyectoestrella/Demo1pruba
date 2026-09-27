import { createFileRoute } from "@tanstack/react-router";
import { cabezaWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { IntroPagina } from "@/components/web/IntroPagina";

/** Contacto: correo, WhatsApp y la demo. */
export const Route = createFileRoute("/contacto")({
  head: () => ({ ...cabezaWeb("contacto"), styles: [ESTILOS_WEB] }),
  component: Contacto,
});

function Contacto() {
  return (
    <EsqueletoWeb>
      <IntroPagina
        titulo="Hablemos de tu salón"
        entradilla="Cuéntanos cómo trabajáis y te enseñamos siShow con tus servicios y tu equipo, sin compromiso."
      />
    </EsqueletoWeb>
  );
}
