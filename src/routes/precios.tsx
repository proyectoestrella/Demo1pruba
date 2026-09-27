import { createFileRoute } from "@tanstack/react-router";
import { cabezaWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { IntroPagina } from "@/components/web/IntroPagina";

/** Precios de siShow: los tres planes, la puesta en marcha y lo que va a tu medida. */
export const Route = createFileRoute("/precios")({
  head: () => ({ ...cabezaWeb("precios"), styles: [ESTILOS_WEB] }),
  component: Precios,
});

function Precios() {
  return (
    <EsqueletoWeb>
      <IntroPagina
        titulo="Precios claros, sin comisiones por reserva"
        entradilla="Tres planes con cuota fija al mes. Con el pago anual, cada mes sale más barato y la puesta en marcha se queda en la mitad."
      />
    </EsqueletoWeb>
  );
}
