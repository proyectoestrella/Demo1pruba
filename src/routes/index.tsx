import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Mail,
  MessageCircle,
  MessagesSquare,
  Palette,
  Receipt,
  RotateCcw,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";
import { CONTENEDOR_WEB, SECCION_WEB } from "@/lib/web-publica";
import { NOMBRE_PLAN, PLANES, QUE_ES, incluye, type PlanSishow } from "@/lib/plan";
import {
  CORREO_SISHOW,
  ENLACE_PANEL_EJEMPLO,
  ENLACE_WEB_EJEMPLO,
  PRECIOS,
  PUESTA_EN_MARCHA,
  enlaceCorreo,
  enlaceWhatsapp,
  precioPuestaEnMarcha,
} from "@/lib/sishow-web";

/**
 * Web de producto de siShow (lote 17). Antes `/` redirigía a la web de una
 * barbería de ejemplo; ahora es la página que se enseña a la dueña de una
 * peluquería o un centro de belleza: qué hace, pruébalo, cuánto cuesta y cómo
 * empezamos. Misma identidad que el panel (Arena: crema, café, salvia).
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "siShow — Agenda y reservas para peluquerías y centros de belleza" },
      {
        name: "description",
        content:
          "Tus clientas reservan solas por tu enlace, tú ves su color e historial y cobras con la señal ya puesta. Desde el móvil, sin complicaciones.",
      },
      { property: "og:title", content: "siShow — Agenda y reservas para tu salón" },
    ],
  }),
  component: WebSishow,
});

const ETIQUETA = "text-[11px] font-bold uppercase tracking-[0.08em] text-cafe-suave";
const TITULO = "text-[26px] font-extrabold leading-tight tracking-tight text-foreground md:text-[32px]";

const NAV = [
  { href: "#que-hace", label: "Qué hace" },
  { href: "#pruebalo", label: "Pruébalo" },
  { href: "#planes", label: "Planes" },
  { href: "#empezar", label: "Cómo empezamos" },
];

function WebSishow() {
  const whatsapp = enlaceWhatsapp() ?? enlaceCorreo();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-lino bg-background/90 backdrop-blur">
        <div className={cn(CONTENEDOR_WEB, "flex min-h-16 items-center justify-between gap-4 py-2.5")}>
          <a href="#inicio" className="flex min-h-11 items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground" aria-hidden="true">
              sí
            </span>
            <span className="text-lg font-extrabold tracking-tight">siShow</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-cafe-medio lg:flex" aria-label="Secciones">
            {NAV.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </a>
            ))}
          </nav>
          <Button asChild className="h-11 rounded-full px-5 font-semibold">
            <a href="#contacto">Hablemos</a>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Portada: la propuesta de valor en una frase. */}
        <section id="inicio" className={cn(CONTENEDOR_WEB, "grid items-center gap-10 py-12 md:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-14")}>
          <div className="entrada-portada">
            <p className={ETIQUETA}>Para peluquerías y centros de belleza</p>
            <h1 className="mt-3 text-[34px] font-extrabold leading-[1.08] tracking-tight md:text-5xl">
              Tus clientas reservan solas y tú llevas el salón desde el móvil.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-cafe-medio">
              Agenda, fichas con el color de cada clienta y caja con la señal, en una sola app pensada
              para la dueña que lo mira entre clienta y clienta.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-[15px] font-semibold">
                <a href="#pruebalo" className="gap-2">
                  Pruébalo ahora <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-lino-fuerte bg-card px-6 text-[15px]">
                <a href="#planes">Ver precios</a>
              </Button>
            </div>
            <p className="mt-5 text-sm text-cafe-suave">Te lo dejamos funcionando en una semana, con tus servicios y tu equipo.</p>
          </div>
          <AgendaDeMuestra />
        </section>

        {/* Tres bloques */}
        <section id="que-hace" className="border-t border-lino bg-card">
          <div className={cn(CONTENEDOR_WEB, SECCION_WEB)}>
            <Reveal className="mb-8 max-w-2xl md:mb-10">
              <p className={ETIQUETA}>Qué hace</p>
              <h2 className={cn(TITULO, "mt-2")}>Tres cosas, y bien hechas</h2>
            </Reveal>
            <div className="grid gap-3 md:grid-cols-3">
              {BLOQUES.map((b, i) => (
                <Reveal key={b.titulo} delay={i * 60} className="h-full">
                  <article className="flex h-full flex-col rounded-[20px] border border-lino bg-background p-6">
                    <span className="grid size-11 place-items-center rounded-full bg-beige text-primary">
                      <b.Icono className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-lg font-extrabold">{b.titulo}</h3>
                    <p className="mt-1.5 text-[15px] text-muted-foreground">{b.texto}</p>
                    <ul className="mt-4 space-y-2 text-[15px]">
                      {b.puntos.map((p) => (
                        <li key={p} className="flex gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-hoja" aria-hidden="true" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Demo interactiva */}
        <section id="pruebalo" className="border-t border-lino">
          <div className={cn(CONTENEDOR_WEB, SECCION_WEB)}>
            <Reveal className="mb-8 max-w-2xl md:mb-10">
              <p className={ETIQUETA}>Pruébalo</p>
              <h2 className={cn(TITULO, "mt-2")}>Toca, reserva y mira cómo llega</h2>
              <p className="mt-2 text-[15px] text-muted-foreground">
                Un salón de ejemplo, PeluChic, con sus servicios, su equipo y su horario. Reserva como
                una clienta y ábrelo luego como la dueña.
              </p>
            </Reveal>
            <div className="grid gap-3 md:grid-cols-2">
              <Reveal className="h-full">
                <a
                  href={ENLACE_WEB_EJEMPLO}
                  className="elevar group flex h-full flex-col rounded-[20px] border border-lino bg-card p-6"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-salvia-clara text-hoja-tinta">
                    <Smartphone className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-extrabold">La web de reservas de tus clientas</h3>
                  <p className="mt-1.5 flex-1 text-[15px] text-muted-foreground">
                    Lo que ve una clienta al abrir tu enlace: servicios, precios, equipo, galería y
                    reserva en cuatro pasos.
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-primary">
                    Abrir como clienta <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </a>
              </Reveal>
              <Reveal delay={60} className="h-full">
                <a
                  href={ENLACE_PANEL_EJEMPLO}
                  className="elevar group flex h-full flex-col rounded-[20px] border border-lino bg-card p-6"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-beige text-primary">
                    <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-extrabold">El panel de la dueña</h3>
                  <p className="mt-1.5 flex-1 text-[15px] text-muted-foreground">
                    Hoy de un vistazo, la agenda del equipo, las fichas de las clientas y la caja del día.
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-primary">
                    Abrir como dueña <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </a>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Además */}
        <section className="border-t border-lino bg-card">
          <div className={cn(CONTENEDOR_WEB, SECCION_WEB)}>
            <Reveal className="mb-8 max-w-2xl md:mb-10">
              <p className={ETIQUETA}>Y además</p>
              <h2 className={cn(TITULO, "mt-2")}>Pensado para el día a día del salón</h2>
            </Reveal>
            <div className="grid gap-3 md:grid-cols-3">
              {ADEMAS.map((a, i) => (
                <Reveal key={a.titulo} delay={i * 60} className="h-full">
                  <article className="h-full rounded-[20px] border border-lino bg-background p-6">
                    <a.Icono className="h-6 w-6 text-primary" aria-hidden="true" />
                    <h3 className="mt-3 text-base font-extrabold">{a.titulo}</h3>
                    <p className="mt-1.5 text-[15px] text-muted-foreground">{a.texto}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Planes />

        {/* Cómo empezamos */}
        <section id="empezar" className="border-t border-lino bg-card">
          <div className={cn(CONTENEDOR_WEB, SECCION_WEB)}>
            <Reveal className="mb-8 max-w-2xl md:mb-10">
              <p className={ETIQUETA}>Cómo empezamos</p>
              <h2 className={cn(TITULO, "mt-2")}>Funcionando en una semana</h2>
              <p className="mt-2 text-[15px] text-muted-foreground">
                El trabajo lo hacemos nosotros. A ti te pedimos una hora al principio y otra al final.
              </p>
            </Reveal>
            <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {SEMANA.map((p, i) => (
                <li key={p.cuando} className="h-full">
                  <Reveal delay={i * 60} className="flex h-full flex-col rounded-[20px] border border-lino bg-background p-5">
                    <span className="inline-flex w-fit rounded-full bg-beige px-3 py-1 text-xs font-bold text-cafe-medio">
                      {p.cuando}
                    </span>
                    <h3 className="mt-3 text-base font-extrabold">{p.titulo}</h3>
                    <p className="mt-1.5 text-[15px] text-muted-foreground">{p.texto}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Contacto */}
        <section id="contacto" className="border-t border-lino">
          <div className={cn(CONTENEDOR_WEB, SECCION_WEB, "text-center")}>
            <Reveal className="mx-auto flex max-w-xl flex-col items-center">
              <h2 className={TITULO}>¿Lo vemos en tu salón?</h2>
              <p className="mt-2 text-[15px] text-muted-foreground">
                Escríbenos y te lo enseñamos con tus servicios y tu equipo, sin compromiso.
              </p>
              <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-7 text-[15px] font-semibold">
                  <a href={whatsapp} target="_blank" rel="noreferrer" className="gap-2">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> Escríbenos por WhatsApp
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-lino-fuerte bg-card px-6 text-[15px]">
                  <a href={enlaceCorreo()} className="gap-2">
                    <Mail className="h-4 w-4" aria-hidden="true" /> Enviar un correo
                  </a>
                </Button>
              </div>
              <p className="mt-4 text-sm text-cafe-medio">
                O escribe a <span className="font-semibold text-foreground">{CORREO_SISHOW}</span>
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-lino bg-card">
        <div className={cn(CONTENEDOR_WEB, "flex flex-col gap-2 py-6 text-[13px] text-cafe-suave sm:flex-row sm:items-center sm:justify-between")}>
          <p>© siShow · Agenda y reservas para peluquerías y centros de belleza</p>
          <p>{CORREO_SISHOW}</p>
        </div>
      </footer>
    </div>
  );
}

const BLOQUES = [
  {
    Icono: CalendarCheck,
    titulo: "Agenda y reservas por tu enlace",
    texto: "Tus clientas reservan a cualquier hora desde tu propia web, sin llamarte.",
    puntos: [
      "Tu web con servicios, precios, equipo y horario",
      "Eligen servicio, profesional y hora en un minuto",
      "Tú aceptas y la agenda del equipo se ordena sola",
    ],
  },
  {
    Icono: Palette,
    titulo: "Clientas con su color e historial",
    texto: "Cada clienta con su ficha: lo que se hizo, con quién y con qué fórmula.",
    puntos: [
      "La fórmula de su color, siempre a mano",
      "Alergias y avisos que no se olvidan",
      "Quién vino, quién no y cuándo le toca volver",
    ],
  },
  {
    Icono: Receipt,
    titulo: "Caja y señal",
    texto: "Cobra cada cita en un toque y pide señal a las citas largas para que nadie te falle.",
    puntos: [
      "Señal por Bizum que se descuenta del precio",
      "Efectivo, tarjeta o Bizum, apuntado al momento",
      "La caja del día cuadrada al cerrar",
    ],
  },
];

const ADEMAS = [
  {
    Icono: MessagesSquare,
    titulo: "Un asistente que no se inventa nada",
    texto:
      "Pregúntale como hablas: «¿cuántas citas tengo mañana?» o «¿qué color lleva Lucía?». Sin inteligencia artificial: responde con tus datos y nada más.",
  },
  {
    Icono: UsersRound,
    titulo: "Cada una ve lo suyo",
    texto: "Accesos para la gerente y para cada estilista: la agenda para todas, la caja y los números solo para quien tú digas.",
  },
  {
    Icono: RotateCcw,
    titulo: "Deshacer, siempre",
    texto: "¿Moviste una cita sin querer? Un toque y vuelve a su sitio. Todo lo cambiado queda apuntado, con quién y cuándo.",
  },
];

const SEMANA = [
  { cuando: "Día 1", titulo: "Hablamos una hora", texto: "Nos cuentas tus servicios, tu equipo, tu horario y cómo trabajas la señal." },
  { cuando: "Días 2 y 3", titulo: "Lo montamos nosotros", texto: "Cargamos la carta, el equipo y tus clientas, y dejamos tu web de reservas con tu enlace." },
  { cuando: "Día 4", titulo: "Lo repasas", texto: "Te lo enseñamos ya hecho y cambiamos lo que no te encaje." },
  { cuando: "Días 5 a 7", titulo: "Primeras reservas", texto: "Formación de una hora con el equipo, compartes tu enlace y estamos pendientes de las primeras citas." },
];

/** Lo que trae el plan Reservas, en frases cortas. El resto sale de `lib/plan.ts`. */
const BASE_RESERVAS = [
  "Web de reservas con tu enlace",
  "Agenda del equipo y vista de hoy",
  "Fichas con color e historial",
  "Caja y señal por Bizum",
  "Accesos de gerente y estilista",
  "Deshacer lo de las últimas 24 h",
];

function Planes() {
  const [anual, setAnual] = useState(true);
  const puesta = precioPuestaEnMarcha(anual);
  return (
    <section id="planes" className="border-t border-lino">
      <div className={cn(CONTENEDOR_WEB, SECCION_WEB)}>
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
          <div className="max-w-2xl">
            <p className={ETIQUETA}>Planes</p>
            <h2 className={cn(TITULO, "mt-2")}>Un precio claro, sin sorpresas</h2>
          </div>
          <div role="radiogroup" aria-label="Forma de pago" className="inline-flex rounded-full border border-lino-fuerte bg-card p-1">
            {[
              { valor: true, texto: "Pago anual" },
              { valor: false, texto: "Pago mensual" },
            ].map((o) => (
              <button
                key={o.texto}
                type="button"
                role="radio"
                aria-checked={anual === o.valor}
                onClick={() => setAnual(o.valor)}
                className={cn(
                  "h-11 rounded-full px-5 text-sm font-semibold transition-colors",
                  anual === o.valor ? "bg-primary text-primary-foreground" : "text-cafe-medio hover:text-foreground",
                )}
              >
                {o.texto}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="grid gap-3 lg:grid-cols-3">
          {PLANES.map((plan, i) => (
            <Reveal key={plan} delay={i * 60} className="h-full">
              <TarjetaPlan plan={plan} anual={anual} destacado={plan === "reservas-asistente"} />
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-[20px] border border-lino bg-card p-6">
            <h3 className="text-base font-extrabold">Puesta en marcha</h3>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              {PUESTA_EN_MARCHA.horas} horas de trabajo nuestro a {PUESTA_EN_MARCHA.precioHora} € la hora:{" "}
              <b className="text-foreground tabular-nums">{precioPuestaEnMarcha(false)} €</b>, que se quedan en{" "}
              <b className="text-foreground tabular-nums">{precioPuestaEnMarcha(true)} €</b> con el pago anual.
            </p>
            <p className="mt-3 text-sm font-semibold text-hoja-tinta">
              Con la forma de pago elegida: {puesta} € una sola vez.
            </p>
          </div>
          <div className="rounded-[20px] border border-dashed border-moca bg-card p-6">
            <h3 className="text-base font-extrabold">A tu medida</h3>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              Si necesitas más, lo preparamos contigo y te damos precio cerrado:
            </p>
            <ul className="mt-3 space-y-1.5 text-[15px]">
              {["Contabilidad y facturación", "Formaciones para tu equipo", "Mensajes de WhatsApp automáticos"].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-hoja" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function TarjetaPlan({ plan, anual, destacado }: { plan: PlanSishow; anual: boolean; destacado: boolean }) {
  const precio = PRECIOS[plan];
  const propias = incluye(plan).map((f) => QUE_ES[f].titulo);
  const lista =
    plan === "reservas"
      ? BASE_RESERVAS
      : plan === "reservas-asistente"
        ? [
            "Todo lo de Reservas",
            "El asistente, sin inteligencia artificial",
            "Pregúntale citas, huecos, lo cobrado o el color de una clienta",
            "Responde con tus datos, sin inventar",
          ]
        : ["Todo lo de Reservas + Asistente", ...propias];
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-[20px] border bg-card p-6",
        destacado ? "border-2 border-primary" : "border-lino",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold">{NOMBRE_PLAN[plan]}</h3>
        {destacado && (
          <span className="rounded-full bg-salvia-clara px-2.5 py-0.5 text-xs font-bold text-hoja-tinta">Recomendado</span>
        )}
      </div>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold tabular-nums">{anual ? precio.anual : precio.mensual} €</span>
        <span className="text-sm text-cafe-suave">al mes</span>
      </p>
      <p className="mt-1 text-sm text-cafe-suave">
        {anual ? `Pagando el año: ${precio.anual * 12} €. Mes a mes, ${precio.mensual} €.` : `Con el pago anual, ${precio.anual} € al mes.`}
      </p>
      <ul className="mt-5 flex-1 space-y-2 border-t border-lino pt-5 text-[15px]">
        {lista.map((t) => (
          <li key={t} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-hoja" aria-hidden="true" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <Button
        asChild
        variant={destacado ? "default" : "outline"}
        className={cn("mt-6 h-12 rounded-full text-[15px] font-semibold", !destacado && "border-lino-fuerte bg-background")}
      >
        <a href={enlaceCorreo(`Quiero el plan ${NOMBRE_PLAN[plan]}`)}>Quiero este plan</a>
      </Button>
    </article>
  );
}

/**
 * Muestra de la agenda de hoy hecha con la paleta del calendario (un pastel por
 * servicio). No es una captura: pesa cero y se lee igual en cualquier ancho.
 */
function AgendaDeMuestra() {
  const citas = [
    { hora: "10:00", clienta: "Lucía", servicio: "Mechas / balayage", con: "Sara", color: 3, estado: "Vino" },
    { hora: "11:30", clienta: "Carmen", servicio: "Tinte", con: "Sara", color: 2, estado: "Color 7.1" },
    { hora: "12:15", clienta: "Marta", servicio: "Corte y peinado", con: "María", color: 1, estado: "Señal pagada" },
    { hora: "13:00", clienta: "Elena", servicio: "Peinado de novia", con: "María", color: 4, estado: "Te espera" },
  ];
  return (
    <div className="entrada-portada rounded-[28px] border border-lino bg-card p-4 shadow-[0_24px_60px_rgba(59,47,42,0.12)] sm:p-6" aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={ETIQUETA}>Sábado, 26 de septiembre</p>
          <p className="mt-1 font-display text-2xl">Hola, María</p>
        </div>
        <span className="shrink-0 rounded-full bg-salvia-clara px-3 py-1 text-xs font-bold text-hoja-tinta">4 citas hoy</span>
      </div>
      <ul className="mt-5 space-y-2">
        {citas.map((c) => (
          <li
            key={c.hora}
            className="flex items-center gap-3 rounded-xl border-l-4 px-3 py-2.5"
            style={{ background: `var(--serv-${c.color})`, borderLeftColor: `var(--serv-${c.color}-borde)` }}
          >
            <span className="w-11 shrink-0 text-sm font-extrabold tabular-nums text-[color:var(--k-tinta)]">{c.hora}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-[color:var(--k-tinta)]">{c.clienta}</span>
              <span className="block truncate text-xs text-[color:var(--k-tinta2)]">
                {c.servicio} · {c.con}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                c.estado === "Te espera"
                  ? "border border-dashed border-moca bg-white text-cafe-medio"
                  : "bg-white/80 text-[color:var(--k-tinta2)]",
              )}
            >
              {c.estado}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { cifra: "312 €", texto: "Cobrado" },
          { cifra: "2", texto: "Huecos libres" },
          { cifra: "1", texto: "Te espera" },
        ].map((k) => (
          <div key={k.texto} className="rounded-xl bg-nata px-2 py-2.5">
            <p className="text-lg font-extrabold tabular-nums">{k.cifra}</p>
            <p className="text-[11px] text-cafe-medio">{k.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
