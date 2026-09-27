import { createFileRoute } from "@tanstack/react-router";
import { cabezaWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { IntroPagina } from "@/components/web/IntroPagina";

/** Funcionalidades de siShow, módulo a módulo y con capturas reales. */
export const Route = createFileRoute("/funcionalidades")({
  head: () => ({ ...cabezaWeb("funcionalidades"), styles: [ESTILOS_WEB] }),
  component: Funcionalidades,
});

function Funcionalidades() {
  return (
    <EsqueletoWeb>
      <IntroPagina
        titulo="Todo lo que hace siShow por tu salón"
        entradilla="Reservas online, agenda del equipo, fichas con el color de cada clienta, caja y señal, y un asistente que responde con tus datos."
      />
    </EsqueletoWeb>
  );
}
