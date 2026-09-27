import { createFileRoute, Link } from "@tanstack/react-router";
import { cabezaWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { DatosTitular, PaginaLegal } from "@/components/web/Legal";

/** Aviso legal de sishow.es (Ley 34/2002, LSSI-CE, art. 10). */
export const Route = createFileRoute("/legal/aviso-legal")({
  head: () => ({ ...cabezaWeb("aviso-legal"), styles: [ESTILOS_WEB] }),
  component: AvisoLegal,
});

function AvisoLegal() {
  return (
    <EsqueletoWeb>
      <PaginaLegal titulo="Aviso legal" entradilla="Quién es el titular de esta web y en qué condiciones se usa.">
        <h2>1. Datos del titular</h2>
        <p>
          En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de servicios de la sociedad de la
          información y de comercio electrónico (LSSI-CE), estos son los datos del titular de sishow.es:
        </p>
        <DatosTitular />

        <h2>2. Objeto de la web</h2>
        <p>
          sishow.es informa sobre siShow, un servicio de reservas online y gestión para peluquerías y centros de belleza
          (agenda, fichas de clientas, caja y web de reservas de cada salón), y permite ponerse en contacto con nosotros.
          Las condiciones de contratación del servicio se acuerdan por escrito con cada salón; si algo de esta web no
          coincide con lo contratado, manda lo contratado.
        </p>

        <h2>3. Condiciones de uso</h2>
        <p>
          Quien navega por esta web acepta usarla de forma lícita y de buena fe, sin dañarla, sin impedir que otros la
          usen y sin intentar acceder a partes o datos a los que no tiene permiso. La demo de un salón de ejemplo se ofrece
          para conocer el producto: lo que se toca en ella se guarda solo en el navegador de quien la usa.
        </p>

        <h2>4. Propiedad intelectual e industrial</h2>
        <p>
          Los textos, el diseño, el logotipo, el código y las capturas de esta web pertenecen a su titular o se usan con
          permiso. No se pueden copiar, distribuir ni transformar sin autorización, salvo el uso personal y privado que
          permite la ley. Las clientas, citas y cifras que se ven en las capturas y en la demo son de ejemplo.
        </p>

        <h2>5. Enlaces a otras webs</h2>
        <p>
          Esta web enlaza con servicios de terceros, como el correo o WhatsApp. No controlamos su contenido ni respondemos
          de él; cada uno tiene sus propias condiciones y su política de privacidad.
        </p>

        <h2>6. Responsabilidad</h2>
        <p>
          Procuramos que la información de esta web sea correcta y esté al día, y que la web funcione sin cortes, pero no
          podemos garantizarlo en todo momento. Los precios y funciones publicados pueden cambiar; los de cada salón son
          los de su contrato.
        </p>

        <h2>7. Datos personales y cookies</h2>
        <p>
          Cómo tratamos los datos de quien nos escribe está en la{" "}
          <Link to="/legal/privacidad" className="ws-enlace">
            política de privacidad
          </Link>
          , y lo que se guarda en tu navegador, en la{" "}
          <Link to="/legal/cookies" className="ws-enlace">
            política de cookies
          </Link>
          .
        </p>

        <h2>8. Legislación aplicable</h2>
        <p>
          Esta web y este aviso se rigen por la legislación española. Para cualquier controversia, las partes se someten a
          los juzgados y tribunales que correspondan conforme a la ley; si quien usa la web actúa como consumidor, los de
          su domicilio.
        </p>
      </PaginaLegal>
    </EsqueletoWeb>
  );
}
