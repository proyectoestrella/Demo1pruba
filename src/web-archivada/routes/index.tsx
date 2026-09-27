import { createFileRoute, Link } from "@tanstack/react-router";
import { Scissors } from "lucide-react";
import { NOMBRE_PLAN } from "@/lib/plan";
import {
  PREGUNTAS_INICIO,
  cabezaWeb,
  jsonLdAplicacion,
  jsonLdOrganizacion,
  jsonLdPreguntas,
  jsonLdSitioWeb,
} from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { Portada } from "@/components/web/Portada";
import { Problemas } from "@/components/web/Problemas";
import { BloqueModulo, MODULOS_INICIO, Tranquilidad } from "@/components/web/Modulos";
import { CtaFinal, Demo, Preguntas, PreciosResumen, Semana, TituloSeccion } from "@/components/web/Secciones";

/**
 * Inicio de la web oficial de siShow (sishow.es): para la dueña de una
 * peluquería o un centro de belleza. Qué es, qué problema le quita, cómo se
 * ve de verdad (capturas reales), cuánto cuesta y cómo empezamos. Las
 * barberías, en un segundo plano.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    ...cabezaWeb("inicio", [
      jsonLdOrganizacion(),
      jsonLdSitioWeb(),
      jsonLdAplicacion(NOMBRE_PLAN),
      jsonLdPreguntas(PREGUNTAS_INICIO),
    ]),
    styles: [ESTILOS_WEB],
  }),
  component: Inicio,
});

function Inicio() {
  return (
    <EsqueletoWeb>
      <Portada />
      <Problemas />
      <section className="ws-seccion" aria-labelledby="ws-modulos">
        <div className="ws-contenedor">
          <TituloSeccion
            id="ws-modulos"
            titulo="Todo tu salón en una sola app"
            entradilla="Estas son pantallas reales de siShow, con los datos de un salón de ejemplo."
          />
          <div className="mt-14 space-y-24 lg:mt-20 lg:space-y-32">
            {MODULOS_INICIO.map((m, i) => (
              <BloqueModulo key={m.modulo.id} modulo={m.modulo} visual={m.visual} invertido={i % 2 === 1} />
            ))}
          </div>
          <div className="mt-24 lg:mt-32">
            <h3 className="ws-display ws-h3 max-w-2xl">Y lo que te da tranquilidad</h3>
            <div className="mt-10">
              <Tranquilidad />
            </div>
          </div>
          <p className="mt-12">
            <Link to="/funcionalidades" className="ws-boton ws-boton-s">
              Ver todas las funcionalidades
            </Link>
          </p>
        </div>
      </section>
      <Semana />
      <Demo />
      <PreciosResumen />
      <Barberias />
      <Preguntas id="ws-preguntas" titulo="Preguntas frecuentes" preguntas={PREGUNTAS_INICIO} />
      <CtaFinal />
    </EsqueletoWeb>
  );
}

/** Las barberías, en segundo plano: una franja discreta. */
function Barberias() {
  return (
    <section className="border-y border-[color:var(--ws-lino)]" aria-labelledby="ws-barberias">
      <div className="ws-contenedor flex flex-col gap-5 py-10 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="flex gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[color:var(--ws-beige)] text-[color:var(--ws-moca)]">
            <Scissors className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="ws-barberias" className="text-[1.2rem] font-extrabold">
              ¿Tienes una barbería? También te sirve.
            </h2>
            <p className="ws-texto mt-1 max-w-2xl">
              La agenda, la web de reservas, las fichas y la caja funcionan igual con cortes, degradados y arreglos de
              barba. Cuéntanos cómo trabajas y te lo enseñamos.
            </p>
          </div>
        </div>
        <Link to="/contacto" className="ws-boton ws-boton-s shrink-0 self-start md:self-center">
          Escríbenos
        </Link>
      </div>
    </section>
  );
}
