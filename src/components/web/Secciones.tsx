import { Link } from "@tanstack/react-router";
import { Check, Mail, MessageCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOMBRE_PLAN, PLANES } from "@/lib/plan";
import {
  CORREO_SISHOW,
  ENLACE_PANEL_EJEMPLO,
  ENLACE_WEB_EJEMPLO,
  PRECIOS,
  RESUMEN_PLANES,
  SEMANA_PUESTA,
  enlaceCorreo,
  enlaceWhatsapp,
  precioPuestaEnMarcha,
  type Pregunta,
} from "@/lib/sishow-web";
import { ImagenCaptura } from "./Dispositivos";

/** Título de sección: Fraunces grande y, si hace falta, una entradilla. */
export function TituloSeccion({ id, titulo, entradilla, className }: { id: string; titulo: string; entradilla?: string; className?: string }) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <h2 id={id} className="ws-display ws-h2">
        {titulo}
      </h2>
      {entradilla && <p className="ws-entradilla ws-medida mt-5">{entradilla}</p>}
    </div>
  );
}

/** La semana de puesta en marcha: cuatro pasos en orden. */
export function Semana() {
  return (
    <section className="ws-banda-beige ws-seccion" aria-labelledby="ws-semana">
      <div className="ws-contenedor">
        <TituloSeccion
          id="ws-semana"
          titulo="Funcionando en una semana"
          entradilla="El trabajo lo hacemos nosotros. A ti te pedimos una hora al principio y otra al final."
        />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {SEMANA_PUESTA.map((p, i) => (
            <li key={p.cuando} className="relative lg:pr-8">
              <div className="flex items-center gap-3">
                <span className="ws-cifra grid size-11 shrink-0 place-items-center rounded-full bg-[color:var(--ws-moca)] text-[1.05rem] font-extrabold text-white">
                  {i + 1}
                </span>
                <span aria-hidden="true" className="hidden h-px flex-1 bg-[color:var(--ws-lino-f)] lg:block" />
              </div>
              <p className="mt-4 text-[0.9rem] font-bold text-[color:var(--ws-moca)]">{p.cuando}</p>
              <h3 className="mt-1 text-[1.2rem] font-extrabold">{p.titulo}</h3>
              <p className="ws-texto mt-2">{p.texto}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-[1rem] font-semibold">
          Después, te acompañamos por WhatsApp las dos primeras semanas.
        </p>
      </div>
    </section>
  );
}

/** Los dos enlaces a la demo de PeluChic: la web de la clienta y el panel de la dueña. */
export function Demo() {
  const tarjetas = [
    {
      href: ENLACE_WEB_EJEMPLO,
      titulo: "Ver la web de reservas de un salón",
      texto: "Lo que ve tu clienta al abrir tu enlace: servicios, equipo y hueco en cuatro pasos.",
      captura: "movil-reserva-estilista" as const,
      movil: true,
    },
    {
      href: ENLACE_PANEL_EJEMPLO,
      titulo: "Entrar al panel de ejemplo",
      texto: "Hoy, la agenda del equipo, las fichas y la caja, con datos de ejemplo. Toca lo que quieras.",
      captura: "hoy" as const,
      movil: false,
    },
  ];
  return (
    <section id="demo" className="ws-seccion scroll-mt-20" aria-labelledby="ws-demo">
      <div className="ws-contenedor">
        <TituloSeccion
          id="ws-demo"
          titulo="Pruébalo antes de hablar con nadie"
          entradilla="Un salón de ejemplo, PeluChic, con su carta, su equipo y su horario. Reserva como una clienta y luego ábrelo como la dueña."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {tarjetas.map((t) => (
            <a
              key={t.titulo}
              href={t.href}
              className="ws-tarjeta-arena ws-elevar group flex flex-col overflow-hidden no-underline"
            >
              <div className="flex h-56 items-end justify-center overflow-hidden bg-[color:var(--ws-beige)] px-6 pt-7 sm:h-64">
                <ImagenCaptura
                  captura={t.captura}
                  decorativa
                  sizes={t.movil ? "(min-width: 768px) 260px, 60vw" : "(min-width: 768px) 45vw, 88vw"}
                  className={cn(
                    "h-full rounded-t-xl border border-b-0 border-[color:var(--ws-lino)] object-cover object-top shadow-[0_12px_32px_rgba(59,47,42,0.12)]",
                    t.movil ? "w-[min(62%,15rem)]" : "w-full",
                  )}
                />
              </div>
              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <h3 className="text-[1.3rem] font-extrabold leading-snug">{t.titulo}</h3>
                <p className="ws-texto mt-2 flex-1">{t.texto}</p>
                <span className="ws-boton ws-boton-p mt-6 self-start">Abrir la demo</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Precios en corto para el inicio; el detalle vive en /precios. */
export function PreciosResumen() {
  return (
    <section className="ws-banda-arena ws-seccion" aria-labelledby="ws-precios">
      <div className="ws-contenedor">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <TituloSeccion
            id="ws-precios"
            titulo="Una cuota fija, sin comisiones"
            entradilla="Tres planes con precio cerrado al mes. Estos son con pago anual; mes a mes, un poco más."
          />
          <Link to="/precios" className="ws-boton ws-boton-s">
            Ver precios y comparativa
          </Link>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PLANES.map((plan) => {
            const destacado = plan === "reservas-asistente";
            return (
              <article
                key={plan}
                className={cn(
                  "relative flex flex-col rounded-[1.25rem] border bg-[color:var(--ws-crema)] p-7",
                  destacado ? "border-2 border-[color:var(--ws-moca)]" : "border-[color:var(--ws-lino)]",
                )}
              >
                {destacado && (
                  <span className="ws-pildora absolute -top-3.5 left-6 bg-[color:var(--ws-moca)] text-[0.8rem] text-white">Recomendado</span>
                )}
                <h3 className="text-[1.25rem] font-extrabold">{NOMBRE_PLAN[plan]}</h3>
                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="ws-cifra text-[2.75rem] font-extrabold leading-none tracking-tight">{PRECIOS[plan].anual} €</span>
                  <span className="text-[0.95rem] text-[color:var(--ws-cafe-m)]">al mes</span>
                </p>
                <p className="ws-cifra mt-1.5 text-[0.9rem] text-[color:var(--ws-cafe-m)]">
                  Mes a mes, {PRECIOS[plan].mensual} €
                </p>
                <p className="mt-5 font-semibold">{RESUMEN_PLANES[plan].para}</p>
                <ul className="mt-4 space-y-2.5 border-t border-[color:var(--ws-lino)] pt-5">
                  {RESUMEN_PLANES[plan].puntos.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[0.98rem]">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-[color:var(--ws-hoja)]" strokeWidth={2.6} aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="ws-cifra mt-6 text-[1rem]">
          Puesta en marcha: <b>{precioPuestaEnMarcha(false)} €</b> una sola vez, que se quedan en{" "}
          <b>{precioPuestaEnMarcha(true)} €</b> con el pago anual.
        </p>
      </div>
    </section>
  );
}

/** Preguntas frecuentes con `<details>`: se abren sin JavaScript. */
export function Preguntas({ id, titulo, preguntas }: { id: string; titulo: string; preguntas: Pregunta[] }) {
  return (
    <section className="ws-seccion" aria-labelledby={id}>
      <div className="ws-contenedor grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <TituloSeccion id={id} titulo={titulo} />
          <p className="ws-texto mt-5">
            ¿Tienes otra? Escríbenos a{" "}
            <a href={enlaceCorreo("Una pregunta sobre siShow")} className="ws-enlace">
              {CORREO_SISHOW}
            </a>
            .
          </p>
        </div>
        <div className="border-t border-[color:var(--ws-lino)]">
          {preguntas.map((p) => (
            <details key={p.pregunta} className="ws-pregunta">
              <summary>
                {p.pregunta}
                <Plus className="h-5 w-5 text-[color:var(--ws-moca)]" aria-hidden="true" />
              </summary>
              <div className="ws-texto">{p.respuesta}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Cierre de página. Mientras WhatsApp siga con el marcador, el botón dice
 * «correo» y abre el correo: nunca un botón de WhatsApp que no abre WhatsApp.
 */
export function CtaFinal({ titulo = "¿Lo vemos con tu salón?" }: { titulo?: string }) {
  const whatsapp = enlaceWhatsapp();
  return (
    <section className="ws-banda-salvia" aria-labelledby="ws-cta">
      <div className="ws-contenedor grid items-center gap-8 py-16 md:py-20 lg:grid-cols-[minmax(0,1.2fr)_auto]">
        <div>
          <h2 id="ws-cta" className="ws-display ws-h2">
            {titulo}
          </h2>
          <p className="ws-entradilla mt-4 ws-medida">
            Te lo enseñamos con tus servicios y tu equipo, sin compromiso. Escríbenos y quedamos cuando te venga bien.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="ws-boton ws-boton-p ws-boton-g">
              <MessageCircle className="h-5 w-5" aria-hidden="true" /> Escríbenos por WhatsApp
            </a>
          ) : (
            <a href={enlaceCorreo()} className="ws-boton ws-boton-p ws-boton-g">
              <Mail className="h-5 w-5" aria-hidden="true" /> Escríbenos un correo
            </a>
          )}
          <Link to="/contacto" className="ws-boton ws-boton-s ws-boton-g">
            Ver cómo contactar
          </Link>
        </div>
      </div>
    </section>
  );
}
