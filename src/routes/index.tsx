import { createFileRoute } from "@tanstack/react-router";
import { CORREO_SISHOW, cabezaWeb, enlaceCorreo, jsonLdOrganizacion, jsonLdSitioWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { MarcaSishow } from "@/components/web/Marca";

/**
 * Inicio de sishow.es, retirado a portada sobria el 27-09-2026: Tomás no
 * quiere de momento una web de proyecto que enseñe todas las
 * funcionalidades de la app ni que use el caso de un cliente (PeluChic,
 * que aún no lo es y no ha dado permiso) para publicitarla. Una sola
 * pantalla: marca, una frase y un contacto por correo. El inicio anterior
 * (con funcionalidades, precios y capturas) sigue en `src/web-archivada/`.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    ...cabezaWeb("inicio", [jsonLdOrganizacion(), jsonLdSitioWeb()]),
    styles: [ESTILOS_WEB],
  }),
  component: Inicio,
});

function Inicio() {
  return (
    <EsqueletoWeb>
      <section className="flex min-h-[calc(100vh-4.25rem)] items-center justify-center px-6 py-20 text-center">
        <div className="ws-medida-l">
          <MarcaSishow className="mx-auto justify-center" />
          <p className="ws-display ws-h2 mt-8">Reservas y gestión para peluquerías</p>
          <p className="ws-texto ws-entradilla mx-auto mt-5 max-w-xl">
            Estamos preparando cómo enseñarlo. Si quieres saber más, escríbenos.
          </p>
          <p className="mt-9">
            <a href={enlaceCorreo()} className="ws-boton ws-boton-p ws-boton-g">
              {CORREO_SISHOW}
            </a>
          </p>
        </div>
      </section>
    </EsqueletoWeb>
  );
}
