import { createFileRoute } from "@tanstack/react-router";
import { PREGUNTAS_PRECIOS, cabezaWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { IntroPagina } from "@/components/web/IntroPagina";
import { PuestaYMedida, TablaComparativa, TarjetasPlanes } from "@/components/web/Planes";
import { CtaFinal, Preguntas, TituloSeccion } from "@/components/web/Secciones";

/**
 * Precios de siShow: los tres planes (anual o mes a mes), la puesta en
 * marcha, lo que va a tu medida, la comparativa completa y las preguntas.
 * Cifras de `lib/sishow-web.ts` (hoja de planes v2, aprobada el 26-sep).
 */
export const Route = createFileRoute("/precios")({
  head: () => ({ ...cabezaWeb("precios"), styles: [ESTILOS_WEB] }),
  component: Precios,
});

function Precios() {
  return (
    <EsqueletoWeb>
      <IntroPagina
        titulo="Precios claros, sin comisiones por reserva"
        entradilla="Tres planes con cuota fija al mes. Pagando el año entero, cada mes sale más barato y la puesta en marcha se queda en la mitad."
      />
      <section className="ws-seccion-s" aria-label="Planes">
        <div className="ws-contenedor">
          <TarjetasPlanes />
        </div>
      </section>
      <section className="pb-16 md:pb-24" aria-label="Puesta en marcha y a tu medida">
        <div className="ws-contenedor">
          <PuestaYMedida />
        </div>
      </section>
      <section className="ws-banda-arena ws-seccion" aria-labelledby="ws-comparativa">
        <div className="ws-contenedor">
          <TituloSeccion
            id="ws-comparativa"
            titulo="Qué incluye cada plan"
            entradilla="Todo, fila a fila. En la cabecera, el precio al mes con pago anual y mes a mes."
          />
          <div className="mt-10">
            <TablaComparativa />
          </div>
        </div>
      </section>
      <Preguntas id="ws-preguntas-precios" titulo="Preguntas sobre precios" preguntas={PREGUNTAS_PRECIOS} />
      <CtaFinal titulo="¿Qué plan le va a tu salón?" />
    </EsqueletoWeb>
  );
}
