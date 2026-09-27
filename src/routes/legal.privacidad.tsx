import { createFileRoute, Link } from "@tanstack/react-router";
import { CORREO_SISHOW, cabezaWeb, enlaceCorreo } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { DatosTitular, PaginaLegal } from "@/components/web/Legal";

/** Política de privacidad de sishow.es (RGPD, art. 13, y LOPDGDD). */
export const Route = createFileRoute("/legal/privacidad")({
  head: () => ({ ...cabezaWeb("privacidad"), styles: [ESTILOS_WEB] }),
  component: Privacidad,
});

function Privacidad() {
  const correo = (
    <a href={enlaceCorreo("Protección de datos")} className="ws-enlace">
      {CORREO_SISHOW}
    </a>
  );
  return (
    <EsqueletoWeb>
      <PaginaLegal
        titulo="Política de privacidad"
        entradilla="Qué datos tratamos cuando nos escribes o contratas siShow, para qué, con qué base legal, cuánto tiempo y cómo ejercer tus derechos."
      >
        <p>
          Esta política cumple el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 de Protección de Datos
          Personales y garantía de los derechos digitales (LOPDGDD).
        </p>

        <h2>1. Responsable del tratamiento</h2>
        <DatosTitular />
        <p>Para cualquier cuestión sobre tus datos, escríbenos a {correo}.</p>

        <h2>2. Qué datos tratamos</h2>
        <ul>
          <li>
            <strong>Si nos escribes</strong> por correo o por WhatsApp: tu nombre, tu correo o tu teléfono y lo que nos
            cuentes de tu salón para enseñarte siShow o prepararte un presupuesto.
          </li>
          <li>
            <strong>Si contratas siShow:</strong> los datos de contacto y de facturación de tu negocio y de las personas de
            tu equipo que den de alta en el panel.
          </li>
          <li>
            <strong>Al visitar la web:</strong> el servicio que la aloja registra datos técnicos de cada visita (dirección
            IP, navegador y página pedida) para servirla y protegerla. No usamos analítica ni publicidad.
          </li>
        </ul>
        <p>Esta web no tiene formularios: solo tratamos lo que tú decides enviarnos.</p>

        <h2>3. Para qué y con qué base legal</h2>
        <ul>
          <li>
            <strong>Contestarte y, si lo pides, enseñarte la demo o prepararte un presupuesto.</strong> Base: tu
            consentimiento al escribirnos y la aplicación de medidas precontractuales a petición tuya (art. 6.1.a y 6.1.b
            RGPD).
          </li>
          <li>
            <strong>Prestar el servicio contratado</strong> y atenderte como cliente. Base: la ejecución del contrato (art.
            6.1.b).
          </li>
          <li>
            <strong>Cumplir obligaciones legales</strong>, como las contables y fiscales. Base: obligación legal (art.
            6.1.c).
          </li>
          <li>
            <strong>Mantener la web segura y funcionando.</strong> Base: nuestro interés legítimo (art. 6.1.f).
          </li>
        </ul>
        <p>No tomamos decisiones automatizadas ni elaboramos perfiles con tus datos.</p>

        <h2>4. Cuánto tiempo los guardamos</h2>
        <p>
          Los de una consulta, el tiempo necesario para atenderla y, si no llegamos a trabajar juntos, los borramos
          después. Los de un cliente, mientras dure la relación y, después, durante los plazos que exige la ley (por
          ejemplo, seis años para la documentación contable, según el Código de Comercio). Los registros técnicos de las
          visitas, el tiempo limitado que fija el servicio de alojamiento por seguridad.
        </p>

        <h2>5. Con quién los compartimos</h2>
        <p>
          No vendemos ni cedemos tus datos a nadie, salvo obligación legal. Para funcionar usamos proveedores que los
          tratan por cuenta nuestra (encargados del tratamiento): el alojamiento de la web (Vercel), el correo (Google),
          la mensajería si nos escribes por WhatsApp (Meta) y, para quien contrata siShow, la base de datos del servicio
          (Supabase).
        </p>
        <p>
          Las tipografías de la web se sirven desde la propia web, no desde Google Fonts: abrirla no envía tu dirección IP
          a ningún servicio de tipografías.
        </p>

        <h2>6. Transferencias internacionales</h2>
        <p>
          Algunos de esos proveedores tienen servidores o empresas matrices fuera del Espacio Económico Europeo, sobre todo
          en Estados Unidos. En ese caso, la transferencia se ampara en las garantías del RGPD: el Marco de Privacidad de
          Datos UE-EE. UU. para las empresas adheridas o las cláusulas contractuales tipo de la Comisión Europea.
        </p>

        <h2>7. Los datos de las clientas de cada salón</h2>
        <p>
          Cuando un salón usa siShow, los datos de sus clientas (reservas, fichas, cobros) los trata el salón como
          responsable, y siShow como encargado del tratamiento, solo para prestarle el servicio y siguiendo sus
          instrucciones, con el contrato que exige el artículo 28 del RGPD. La web de reservas de cada salón tiene su
          propia política de privacidad.
        </p>

        <h2>8. Tus derechos</h2>
        <p>
          Puedes pedirnos acceder a tus datos, rectificarlos o suprimirlos, oponerte a su tratamiento, limitarlo, llevártelos
          a otro servicio (portabilidad) y retirar tu consentimiento cuando quieras, sin que eso afecte a lo tratado antes.
          Escríbenos a {correo} indicando qué derecho quieres ejercer; podemos pedirte que acredites tu identidad.
        </p>
        <p>
          Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos
          (aepd.es).
        </p>

        <h2>9. Seguridad</h2>
        <p>
          Aplicamos medidas técnicas y organizativas adecuadas al riesgo: la web va cifrada (https), el acceso al panel es
          personal y cada persona del salón ve solo lo que le corresponde.
        </p>

        <h2>10. Menores</h2>
        <p>Esta web se dirige a negocios. No tratamos a sabiendas datos de menores de 14 años.</p>

        <h2>11. Cambios</h2>
        <p>
          Si cambiamos esta política, lo verás aquí con la nueva fecha de revisión. Lo que se guarda en tu navegador está
          en la{" "}
          <Link to="/legal/cookies" className="ws-enlace">
            política de cookies
          </Link>
          .
        </p>
      </PaginaLegal>
    </EsqueletoWeb>
  );
}
