import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Mail, MessageCircle } from "lucide-react";
import {
  CORREO_SISHOW,
  DATOS_PARA_LA_DEMO,
  DEMO_PANEL_URL,
  DEMO_WEB_URL,
  cabezaWeb,
  enlaceCorreo,
  enlaceCorreoConDatos,
  enlaceWhatsapp,
} from "@/lib/sishow-web";
import { BotonCopiar } from "@/components/web/BotonCopiar";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { IntroPagina } from "@/components/web/IntroPagina";

/**
 * Contacto: correo (copiable), WhatsApp y la demo. Mientras
 * `WHATSAPP_SISHOW` siga siendo el marcador, el botón de WhatsApp abre el
 * correo y lo dice: nunca un botón que promete WhatsApp y abre otra cosa.
 */
export const Route = createFileRoute("/contacto")({
  head: () => ({ ...cabezaWeb("contacto"), styles: [ESTILOS_WEB] }),
  component: Contacto,
});

function Contacto() {
  const whatsapp = enlaceWhatsapp();
  return (
    <EsqueletoWeb>
      <IntroPagina
        titulo="Hablemos de tu salón"
        entradilla="Cuéntanos cómo trabajáis y te enseñamos siShow con tus servicios y tu equipo, sin compromiso."
      />
      <section className="ws-seccion-s" aria-label="Formas de contacto">
        <div className="ws-contenedor grid gap-5 lg:grid-cols-3">
          <article className="ws-tarjeta flex flex-col p-7 sm:p-8">
            <span className="grid size-12 place-items-center rounded-full bg-[color:var(--ws-salvia)] text-[color:var(--ws-hoja)]">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-[1.35rem] font-extrabold">Por correo</h2>
            <p id="ws-correo" className="mt-2 break-all text-[1.2rem] font-bold text-[color:var(--ws-moca)]">
              {CORREO_SISHOW}
            </p>
            <p className="ws-texto mt-2 flex-1">Escríbenos cuando quieras y quedamos para enseñártelo.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={enlaceCorreo()} className="ws-boton ws-boton-p">
                Escribir un correo
              </a>
              <BotonCopiar texto={CORREO_SISHOW} idTexto="ws-correo" />
            </div>
          </article>
          <article className="ws-tarjeta flex flex-col p-7 sm:p-8">
            <span className="grid size-12 place-items-center rounded-full bg-[color:var(--ws-salvia)] text-[color:var(--ws-hoja)]">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-[1.35rem] font-extrabold">Por WhatsApp</h2>
            {whatsapp ? (
              <>
                <p className="ws-texto mt-2 flex-1">Te contestamos por WhatsApp, con el mensaje ya empezado.</p>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="ws-boton ws-boton-p mt-6 self-start">
                  Abrir WhatsApp
                </a>
              </>
            ) : (
              <>
                <p className="ws-texto mt-2 flex-1">
                  Aún no hemos activado el WhatsApp de siShow. Mientras tanto, este botón te abre el correo con el mensaje
                  preparado.
                </p>
                <a href={enlaceCorreo()} className="ws-boton ws-boton-p mt-6 self-start">
                  Escribir por correo
                </a>
              </>
            )}
          </article>
          <article className="ws-tarjeta flex flex-col p-7 sm:p-8">
            <h2 className="text-[1.35rem] font-extrabold">Pruébalo tú antes</h2>
            <p className="ws-texto mt-2">Un salón de ejemplo, PeluChic, con su carta, su equipo y su horario.</p>
            <ul className="mt-5 flex-1 space-y-3">
              <li>
                <a href={DEMO_WEB_URL} className="ws-enlace inline-flex min-h-11 items-center">
                  Ver la web de reservas de un salón
                </a>
              </li>
              <li>
                <a href={DEMO_PANEL_URL} className="ws-enlace inline-flex min-h-11 items-center">
                  Entrar al panel de ejemplo
                </a>
              </li>
            </ul>
            <p className="mt-4 text-[0.95rem] text-[color:var(--ws-cafe-m)]">
              ¿Prefieres leer antes? <Link to="/funcionalidades" className="ws-enlace">Funcionalidades</Link> y{" "}
              <Link to="/precios" className="ws-enlace">precios</Link>.
            </p>
          </article>
        </div>
      </section>
      <section className="pb-16 md:pb-24" aria-labelledby="ws-datos">
        <div className="ws-contenedor">
          <div className="ws-tarjeta-arena grid gap-8 p-7 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
            <div>
              <h2 id="ws-datos" className="ws-display ws-h3">
                Para enseñártelo con tu salón
              </h2>
              <p className="ws-texto mt-4">
                Con esto te preparamos la demo con tus servicios. Si nos escribes desde el botón, las preguntas ya van en el
                correo.
              </p>
              <a href={enlaceCorreoConDatos()} className="ws-boton ws-boton-p mt-6">
                Escribir con estas preguntas
              </a>
            </div>
            <ul className="space-y-3">
              {DATOS_PARA_LA_DEMO.map((d) => (
                <li key={d} className="flex gap-3 text-[1.05rem]">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[color:var(--ws-hoja)]" strokeWidth={2.6} aria-hidden="true" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-8 max-w-3xl text-[0.95rem] text-[color:var(--ws-cafe-m)]">
            Cuando nos escribes, usamos tus datos solo para contestarte y, si lo pides, preparar tu presupuesto. Más en la{" "}
            <Link to="/legal/privacidad" className="ws-enlace">
              política de privacidad
            </Link>
            .
          </p>
        </div>
      </section>
    </EsqueletoWeb>
  );
}
