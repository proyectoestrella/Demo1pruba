import { createFileRoute, Link } from "@tanstack/react-router";
import { cabezaWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { PaginaLegal } from "@/components/web/Legal";

/**
 * Política de cookies (LSSI art. 22.2 y guía de la AEPD). sishow.es no pone
 * cookies de analítica ni de publicidad, así que no hay banner: solo
 * almacenamiento técnico de la aplicación, que está exento de consentimiento.
 * Si algún día se añade analítica, primero el consentimiento y el banner.
 */
export const Route = createFileRoute("/legal/cookies")({
  head: () => ({ ...cabezaWeb("cookies"), styles: [ESTILOS_WEB] }),
  component: Cookies,
});

const ALMACEN: { clave: string; para: string; duracion: string }[] = [
  {
    clave: "trimly-salon-store",
    para: "Los datos de funcionamiento de la aplicación y de la demo del salón de ejemplo.",
    duracion: "Hasta que lo borres",
  },
  { clave: "trimly-tour-visto", para: "Recordar que ya viste la guía del panel.", duracion: "Hasta que lo borres" },
  { clave: "sishow-sesion", para: "Mantener tu sesión si entras al panel con tu cuenta.", duracion: "Hasta que cierres sesión" },
  {
    clave: "sishow-hoy-abiertos y sishow-ancho-panel",
    para: "Recordar qué bloques del panel dejaste abiertos y el ancho de los paneles laterales.",
    duracion: "Hasta que lo borres",
  },
];

function Resto() {
  return (
    <>
      <div className="ws-tabla-caja mt-6" role="region" aria-label="Datos que se guardan en tu navegador" tabIndex={0}>
        <table className="ws-tabla">
          <caption className="sr-only">Datos que se guardan en el almacenamiento local de tu navegador</caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Para qué</th>
              <th scope="col">Duración</th>
            </tr>
          </thead>
          <tbody>
            {ALMACEN.map((a) => (
              <tr key={a.clave}>
                <th scope="row" className="font-mono text-[0.85rem]">
                  {a.clave}
                </th>
                <td className="!text-left">{a.para}</td>
                <td className="!text-left">{a.duracion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ws-legal text-[1.02rem] leading-relaxed">
        <h2>Tipografías de Google</h2>
        <p>
          La web carga sus tipografías desde Google Fonts. No pone cookies, pero tu navegador se conecta a servidores de
          Google, que reciben tu dirección IP. Más detalle en la{" "}
          <Link to="/legal/privacidad" className="ws-enlace">
            política de privacidad
          </Link>
          .
        </p>

        <h2>Cómo borrarlo</h2>
        <p>
          Puedes borrar todo lo guardado desde los ajustes de tu navegador, en el apartado de privacidad o de datos de
          sitios web. Si lo borras, la demo vuelve a empezar y, si tenías sesión en el panel, tendrás que volver a entrar.
        </p>

        <h2>Si esto cambia</h2>
        <p>
          Si algún día añadimos analítica u otras cookies que no sean técnicas, te pediremos antes el consentimiento con un
          aviso y lo contaremos aquí, con la nueva fecha de revisión.
        </p>
      </div>
    </>
  );
}

function Cookies() {
  return (
    <EsqueletoWeb>
      <PaginaLegal
        titulo="Política de cookies"
        entradilla="Qué se guarda en tu navegador cuando visitas sishow.es y para qué."
        despues={<Resto />}
      >
        <h2>Sin cookies de analítica ni de publicidad</h2>
        <p>
          sishow.es no usa cookies de analítica, de publicidad ni de redes sociales, ni propias ni de terceros. Por eso no
          te pedimos consentimiento ni verás un aviso de cookies.
        </p>

        <h2>Lo que sí se guarda: almacenamiento técnico</h2>
        <p>
          siShow es una aplicación que funciona en tu navegador, y para funcionar guarda algunos datos en su
          almacenamiento local (no son cookies, pero la ley los trata igual). Son técnicos: no sirven para identificarte
          ni para seguirte por otras webs, y no se envían a nadie. Por eso no necesitan consentimiento (artículo 22.2 de
          la LSSI).
        </p>
      </PaginaLegal>
    </EsqueletoWeb>
  );
}
