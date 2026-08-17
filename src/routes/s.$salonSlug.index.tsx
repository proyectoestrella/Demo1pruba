import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Info,
  Instagram,
  MapPin,
  Phone,
  Quote,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import {
  services,
  serviceMap,
  employees,
  salon,
  requiresDeposit,
  DEPOSIT_RATE,
  DEPOSIT_THRESHOLD_MIN,
} from "@/lib/mock/salon";
import { useSalonStore } from "@/lib/store";
import heroImg from "@/assets/hero-salon.jpg";
import { WorkGallery } from "@/components/WorkGallery";
import { MobileBookingBar } from "@/components/MobileBookingBar";
import { Reveal } from "@/components/Reveal";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import { CountUp } from "@/components/reactbits/CountUp";
import { ShinyText } from "@/components/reactbits/ShinyText";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";
import { ScrollVelocity } from "@/components/reactbits/ScrollVelocity";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { AnimatedShinyText } from "@/components/magicui/animated-shiny-text";
import { AuroraText } from "@/components/magicui/aurora-text";
import { AvatarCircles } from "@/components/magicui/avatar-circles";
import { BentoCard, BentoGrid } from "@/components/magicui/bento-grid";
import { BorderBeam } from "@/components/magicui/border-beam";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Marquee } from "@/components/magicui/marquee";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { WordRotate } from "@/components/magicui/word-rotate";
import { TeamShowcase } from "@/components/twentyfirst/team-showcase";
import { cn } from "@/lib/utils";
import { SERVICE_ES, CATEGORY_LABELS, CATEGORY_ORDER, EMPLOYEE_ES, eur } from "@/lib/copy";

export const Route = createFileRoute("/s/$salonSlug/")({
  component: SalonHome,
});

const SALON_ABOUT_ES =
  "Barbería de toda la vida en el corazón de la ciudad. Tres profesionales, una misma obsesión: que salgas de aquí sintiéndote como nuevo.";

const FEATURED_IDS = ["haircut", "color", "highlights", "keratin"];

/**
 * Reseñas de ejemplo. No hay reseñas reales todavía — se muestran marcadas
 * como ejemplo (ver nota junto al título de la sección y la etiqueta en cada
 * tarjeta) para que quede claro que hay que sustituirlas.
 */
const REVIEWS = [
  {
    name: "Marta R.",
    rating: 5,
    quote: "Salgo distinta cada vez. Mario entiende exactamente lo que le pido.",
  },
  { name: "Carlos M.", rating: 5, quote: "El mejor arreglo de barba de Madrid, sin discusión." },
  {
    name: "Elena G.",
    rating: 5,
    quote: "Ambiente cuidado y muy puntuales con la hora de la cita.",
  },
  {
    name: "Javier P.",
    rating: 5,
    quote: "Reservé desde el móvil en un minuto y a la hora exacta estaba en la silla.",
  },
  {
    name: "Nuria S.",
    rating: 4,
    quote: "El color quedó justo como lo habíamos hablado. Repetiré sin dudarlo.",
  },
];
const AGGREGATE_RATING = 4.8;
const REVIEW_COUNT = 312;

const WEEK_DAYS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Card hover lift, gated so it's fully inert under prefers-reduced-motion. */
const CARD_HOVER =
  "transition-all duration-300 hover:-translate-y-1 motion-reduce:hover:translate-y-0";

/** Variantes de entrada del hero — el patrón de los bloques de Tailark. */
const HERO_IN = {
  container: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.4 } },
  },
  item: {
    hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring" as const, bounce: 0.3, duration: 1.4 },
    },
  },
};

/**
 * Celdas de la rejilla bento. Todo lo que se afirma aquí es cierto en la app:
 * el equipo son tres, la cancelación gratuita es de 24 h y los precios y
 * duraciones salen del catálogo.
 *
 * Los destinos son anclas de esta misma página a propósito: `BentoCard`
 * renderiza un `<a href>` normal y una ruta real forzaría recarga completa en
 * vez de navegar por el router. Para reservar ya están los botones de arriba,
 * el de la cabecera y la barra fija del móvil.
 */
const BENTO_ITEMS = [
  {
    Icon: CalendarCheck,
    name: "Reserva sin llamar",
    description:
      "Eliges servicio, barbero y hora desde el móvil. Sin teléfono y sin esperar a que abramos.",
    href: "#servicios",
    cta: "Empezar por la carta",
    className: "lg:col-span-2",
  },
  {
    Icon: Users,
    name: "Eliges barbero",
    description: "Mario, Diego o Rubén. O el primero que tenga hueco, si lo que corre es la hora.",
    href: "#equipo",
    cta: "Ver el equipo",
    className: "lg:col-span-1",
  },
  {
    Icon: ShieldCheck,
    name: "Cancelas gratis",
    description: "Hasta 24 horas antes, sin coste y sin dar explicaciones.",
    href: "#faq",
    cta: "Ver condiciones",
    className: "lg:col-span-1",
  },
  {
    Icon: Scissors,
    name: "Nuestro trabajo, de cerca",
    description:
      "Pasa la lupa por las fotos de la galería y mira el degradado y el remate al detalle.",
    href: "#galeria",
    cta: "Ver la galería",
    className: "lg:col-span-2",
  },
];

const FAQ = [
  {
    q: "¿Puedo cancelar o cambiar la cita?",
    a: "Sí. Hasta 24 horas antes puedes cancelar o mover la cita sin coste desde el enlace que recibes al reservar.",
  },
  {
    q: "¿Hace falta pagar por adelantado?",
    a: `Solo en los servicios largos, de más de ${DEPOSIT_THRESHOLD_MIN} minutos: se pide un depósito del ${Math.round(
      DEPOSIT_RATE * 100,
    )}% que se descuenta del total y se abona en el salón.`,
  },
  {
    q: "¿Atendéis sin cita previa?",
    a: "Si hay hueco, sí — pero la agenda suele ir llena. Reservar online es la forma segura de tener sitio.",
  },
  {
    q: "¿Puedo elegir barbero?",
    a: "Claro. En el paso 2 de la reserva eliges profesional, o dejas «cualquiera disponible» si lo que te corre prisa es la hora.",
  },
];

function todayOpenInfo(hours: typeof salon.hours) {
  const dow = new Date().getDay();
  const entry =
    dow === 0
      ? hours.find((h) => h.day === "Sunday")
      : dow === 6
        ? hours.find((h) => h.day === "Saturday")
        : hours.find((h) => h.day === "Mon–Fri");
  if (!entry || entry.value === "Closed") return "Cerrado hoy";
  const [startStr, endStr] = entry.value.split("—").map((s) => s.trim());
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (nowMin < startMin) return `Cerrado · abre a las ${startStr}`;
  if (nowMin >= endMin) return "Cerrado hoy";
  return `Abierto · cierra a las ${endStr}`;
}

function isOpenNow(hours: typeof salon.hours) {
  return todayOpenInfo(hours).startsWith("Abierto");
}

function fullWeekSchedule(hours: typeof salon.hours) {
  const weekday = hours.find((h) => h.day === "Mon–Fri")?.value ?? "—";
  const sat = hours.find((h) => h.day === "Saturday")?.value ?? "—";
  const sun = hours.find((h) => h.day === "Sunday")?.value ?? "—";
  return WEEK_DAYS_ES.map((label, i) => ({
    label,
    value: i < 5 ? weekday : i === 5 ? sat : sun === "Closed" ? "Cerrado" : sun,
  }));
}

/** Tarjeta de reseña del muro. Ancho fijo: es lo que espera un marquee. */
function ReviewCard({ name, rating, quote }: (typeof REVIEWS)[number]) {
  return (
    <figure className="relative flex w-72 shrink-0 flex-col rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40 sm:w-80">
      <span className="absolute right-4 top-4 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Ejemplo
      </span>
      <Quote className="h-5 w-5 text-primary/40" aria-hidden="true" />
      <blockquote className="mt-3 flex-1 pr-10 text-sm leading-relaxed text-foreground">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className="mt-5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{name}</span>
        <span className="flex gap-0.5" aria-label={`${rating} de 5 estrellas`}>
          {Array.from({ length: 5 }).map((_, j) => (
            <Star
              key={j}
              className={cn(
                "h-3.5 w-3.5",
                j < rating ? "fill-primary text-primary" : "text-muted-foreground/30",
              )}
            />
          ))}
        </span>
      </figcaption>
    </figure>
  );
}

/** Encabezado de sección: cintillo en latón + titular display. */
function SectionHeading({
  eyebrow,
  title,
  className,
}: {
  eyebrow: string;
  title: string;
  className?: string;
}) {
  return (
    <Reveal className={cn("mb-10", className)}>
      <p className="text-xs uppercase tracking-[0.25em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl md:text-4xl">{title}</h2>
    </Reveal>
  );
}

function SalonHome() {
  const { salonSlug } = Route.useParams();
  const profile = useSalonStore((s) => s.salonProfile);
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(profile.address)}&output=embed`;

  const activeServices = services.filter((s) => s.active !== false);
  const openNow = isOpenNow(salon.hours);
  // Las fotos del equipo ya están importadas en mock/salon: no hay avatares de stock.
  const TEAM_AVATARS = employees.map((e) => ({
    imageUrl: e.photo,
    profileUrl: `/s/${salonSlug}#equipo`,
  }));
  const totalTeamYears = employees.reduce((sum, e) => sum + e.yearsExperience, 0);
  // Cifras sacadas del propio catálogo/equipo, no inventadas.
  const stats = [
    { value: employees.length, suffix: "", label: "barberos en plantilla" },
    {
      value: Math.max(...employees.map((e) => e.yearsExperience)),
      suffix: "+",
      label: "años de oficio",
    },
    { value: activeServices.length, suffix: "", label: "servicios en carta" },
    {
      value: Math.min(...activeServices.map((s) => s.durationMin)),
      suffix: " min",
      label: "el servicio más rápido",
    },
  ];

  return (
    <>
      {/* ------------------------------------------------------------------
       * Hero a sangre. Foto + doble degradado para que el texto sea legible
       * pase lo que pase con la imagen, y entrada escalonada al estilo de
       * los bloques de Tailark.
       * ---------------------------------------------------------------- */}
      <section className="relative isolate flex min-h-[85vh] items-end overflow-hidden text-white sm:items-center">
        <img
          src={heroImg}
          alt={`Interior de ${profile.name}`}
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          width={1920}
          height={1280}
          fetchPriority="high"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/92 via-black/60 to-black/25" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(75%_60%_at_15%_50%,rgba(0,0,0,0.55),transparent_70%)]" />

        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24 md:py-32">
          <AnimatedGroup variants={HERO_IN} className="max-w-2xl space-y-6">
            {/* Dos píldoras en una sola fila: estado real del salón a la
                izquierda y el reclamo a la derecha. Apiladas competían entre sí. */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-sm backdrop-blur-sm">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    openNow ? "bg-success animate-pulse motion-reduce:animate-none" : "bg-white/40",
                  )}
                  aria-hidden="true"
                />
                <ShinyText
                  text={todayOpenInfo(salon.hours)}
                  baseColor="rgb(255 255 255 / 0.92)"
                  className="font-medium"
                  speed={5}
                />
                <span className="text-white/40" aria-hidden="true">
                  ·
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  <span className="font-medium">{AGGREGATE_RATING}</span>
                </span>
              </div>

              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 backdrop-blur-sm">
                <AnimatedShinyText className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/70">
                  <Sparkles className="h-3.5 w-3.5" />
                  Reservas en menos de un minuto
                </AnimatedShinyText>
              </div>
            </div>

            <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl md:text-7xl">
              <TextEffect
                as="span"
                per="char"
                preset="fade-in-blur"
                speedSegment={2.4}
                delay={0.2}
                className="block"
              >
                {profile.name}
              </TextEffect>
            </h1>

            {/* La palabra que va rotando cuenta lo que se hace aquí sin ocupar
                cuatro líneas de texto. */}
            <div className="flex flex-wrap items-baseline gap-x-2 text-lg text-white/80">
              <span>Especialistas en</span>
              <WordRotate
                words={["degradados", "barba a navaja", "color", "mechas", "keratina"]}
                duration={2200}
                className="font-display text-2xl text-primary"
              />
            </div>

            <p className="flex items-center gap-2 text-white/85">
              <MapPin className="h-4 w-4 shrink-0 text-primary" /> {profile.address}
            </p>
            <p className="max-w-md text-white/70">{SALON_ABOUT_ES}</p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ShimmerButton
                asChild
                shimmerColor="#f5e6c8"
                background="var(--color-primary)"
                className="px-7 py-3 font-medium"
              >
                <Link
                  to="/s/$salonSlug/book"
                  params={{ salonSlug }}
                  className="flex items-center gap-2 text-[color:var(--color-primary-foreground)]"
                >
                  Reservar cita <ArrowRight className="h-4 w-4" />
                </Link>
              </ShimmerButton>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/30 bg-white/10 px-7 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              >
                <a href="#servicios">Ver la carta</a>
              </Button>
            </div>
          </AnimatedGroup>
        </div>
      </section>

      {/* Barra de info rápida */}
      <section className="border-y border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 text-sm">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Clock className="h-4 w-4 shrink-0 text-primary" /> {todayOpenInfo(salon.hours)}
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-primary" /> {profile.address}
          </span>
          <a
            href={`tel:${profile.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Phone className="h-4 w-4 shrink-0 text-primary" /> {profile.phone}
          </a>
        </div>
      </section>

      {/* Cinta que reacciona al scroll */}
      <div className="overflow-hidden border-b border-border/40 bg-background py-4">
        <ScrollVelocity
          items={["Degradados", "Barba a navaja", "Toalla caliente", "Color", "Sin esperas"]}
          velocity={28}
          className="font-display text-xl text-muted-foreground/70 sm:text-2xl"
        />
      </div>

      {/* Cifras del salón */}
      <section className="border-b border-border/40">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-8 px-6 py-12 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="text-center">
              <p className="font-display text-4xl text-foreground md:text-5xl">
                <CountUp to={s.value} format={(v) => `${Math.round(v)}${s.suffix}`} />
              </p>
              <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Servicios destacados */}
      <section id="servicios" className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <SectionHeading eyebrow="Más reservados" title="Servicios destacados" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_IDS.map((id, i) => {
            const s = serviceMap[id];
            if (!s) return null;
            const label = SERVICE_ES[id] ?? { name: s.name, description: s.description };
            return (
              <Reveal key={id} delay={i * 70} className="h-full">
                <SpotlightCard
                  className={cn(
                    "group relative h-full rounded-2xl border border-border/60 bg-card hover:border-primary/40",
                    CARD_HOVER,
                  )}
                >
                  <Link
                    to="/s/$salonSlug/book"
                    params={{ salonSlug }}
                    search={{ service: id }}
                    className="relative flex h-full flex-col p-6"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Scissors className="h-5 w-5 text-primary" />
                      <span className="font-display text-xl">{eur(s.priceEur)}</span>
                    </div>
                    <h3 className="mt-5 text-base font-semibold">{label.name}</h3>
                    <p className="mt-1 flex-1 text-sm text-muted-foreground">{label.description}</p>
                    <span className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {s.durationMin} min
                    </span>
                  </Link>
                  {/* Haz de luz recorriendo el borde, desfasado por tarjeta para
                      que no vayan las cuatro a la vez. */}
                  <BorderBeam
                    size={70}
                    duration={9}
                    delay={i * 2.2}
                    colorFrom="var(--color-primary)"
                    colorTo="transparent"
                    className="opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Por qué aquí — rejilla bento */}
      <section className="relative border-t border-border/40">
        <DotPattern
          width={22}
          height={22}
          cr={1}
          className="[mask-image:radial-gradient(500px_circle_at_center,white,transparent)] fill-primary/25"
        />
        <div className="relative mx-auto max-w-5xl px-6 py-16 md:py-24">
          <SectionHeading eyebrow="Por qué aquí" title="Lo que te vas a encontrar" />
          <Reveal>
            <BentoGrid className="md:grid-rows-2 lg:grid-cols-3">
              {BENTO_ITEMS.map((item) => (
                <BentoCard
                  key={item.name}
                  name={item.name}
                  description={item.description}
                  Icon={item.Icon}
                  className={item.className}
                  href={item.href}
                  cta={item.cta}
                  background={
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-transparent"
                    />
                  }
                />
              ))}
            </BentoGrid>
          </Reveal>
        </div>
      </section>

      {/* Catálogo completo */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <SectionHeading eyebrow="El menú completo" title="Todos los servicios" />
          <Reveal>
            <Accordion
              type="single"
              collapsible
              defaultValue={CATEGORY_ORDER[0]}
              className="divide-y divide-border/40"
            >
              {CATEGORY_ORDER.map((cat) => {
                const items = activeServices.filter(
                  (s) => (CATEGORY_LABELS[s.id] ?? "Otros") === cat,
                );
                if (!items.length) return null;
                return (
                  <AccordionItem key={cat} value={cat} className="border-b-0">
                    <AccordionTrigger className="py-4 text-base font-display font-medium hover:no-underline">
                      {cat}
                      <span className="ml-auto mr-3 text-xs font-normal text-muted-foreground">
                        {items.length}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pb-2">
                        {items.map((s) => {
                          const label = SERVICE_ES[s.id] ?? {
                            name: s.name,
                            description: s.description,
                          };
                          return (
                            <Link
                              key={s.id}
                              to="/s/$salonSlug/book"
                              params={{ salonSlug }}
                              search={{ service: s.id }}
                              className="group flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-muted/30"
                            >
                              <div className="min-w-0">
                                <p className="font-medium">{label.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {s.durationMin} min
                                  {requiresDeposit(s.durationMin) ? " · requiere depósito" : ""}
                                </p>
                              </div>
                              <span className="flex shrink-0 items-center gap-2 font-display text-lg">
                                {eur(s.priceEur)}
                                <ArrowRight className="h-4 w-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* Galería de trabajos */}
      <WorkGallery />

      {/* Equipo */}
      <section id="equipo" className="border-t border-border/40 bg-card">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <SectionHeading eyebrow="Equipo" title="Quién te va a atender" className="mb-12" />
          {/* Retratos grandes en vez de avatares pequeños: en una barbería la
              cara del que te va a cortar es parte de lo que se vende. */}
          <Reveal>
            <TeamShowcase
              members={employees.map((e) => ({
                id: e.id,
                name: e.name,
                role: `${EMPLOYEE_ES[e.id]?.specialty ?? e.specialty} · ${e.yearsExperience} años`,
                image: e.photo,
              }))}
            />
          </Reveal>
        </div>
      </section>

      {/* Reseñas */}
      <section id="resenas" className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary">Reseñas</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">
              Lo que dicen nuestros clientes
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-primary text-primary" />
            <span className="font-medium">{AGGREGATE_RATING}</span>
            <span className="text-muted-foreground">· {REVIEW_COUNT} reseñas</span>
          </div>
        </Reveal>
        <Reveal className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" /> Reseñas de ejemplo — sustitúyelas por las
          reseñas reales de tu salón.
        </Reveal>

        {/* Muro en dos filas que se cruzan. Se para al pasar el ratón para
            poder leer la que te interese. */}
        <Reveal className="relative">
          <Marquee pauseOnHover className="[--duration:38s] [--gap:1.25rem]">
            {REVIEWS.map((r) => (
              <ReviewCard key={r.name} {...r} />
            ))}
          </Marquee>
          <Marquee reverse pauseOnHover className="mt-5 [--duration:44s] [--gap:1.25rem]">
            {[...REVIEWS].reverse().map((r) => (
              <ReviewCard key={r.name} {...r} />
            ))}
          </Marquee>
          {/* Desvanecido lateral para que las tarjetas no se corten en seco. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background sm:w-28" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background sm:w-28" />
        </Reveal>
      </section>

      {/* Preguntas frecuentes */}
      <section id="faq" className="border-t border-border/40 bg-card">
        <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
          <SectionHeading eyebrow="Antes de venir" title="Preguntas frecuentes" />
          <Reveal>
            <Accordion type="single" collapsible className="divide-y divide-border/40">
              {FAQ.map((item) => (
                <AccordionItem key={item.q} value={item.q} className="border-b-0">
                  <AccordionTrigger className="py-4 text-left text-base font-medium hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* Ubicación + horario */}
      <section id="ubicacion" className="border-t border-border/40">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="Ubicación y horario"
            title="Te esperamos aquí"
            className="mb-12"
          />
          <div className="grid gap-6 md:grid-cols-2">
            <Reveal className="space-y-6">
              <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
                <p className="flex items-start gap-3 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {profile.address}
                </p>
                <a
                  href={`tel:${profile.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-3 text-sm transition-colors hover:text-primary"
                >
                  <Phone className="h-4 w-4 shrink-0 text-primary" /> {profile.phone}
                </a>
                <p className="flex items-center gap-3 text-sm">
                  <Instagram className="h-4 w-4 shrink-0 text-primary" /> {profile.instagram}
                </p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border/60">
                <iframe
                  src={mapSrc}
                  title={`Mapa de ubicación de ${profile.name}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-72 w-full border-0 dark:brightness-90 dark:invert dark:contrast-[0.9] dark:hue-rotate-180"
                />
              </div>
            </Reveal>
            <Reveal delay={100} className="rounded-2xl border border-border/60 bg-card p-6">
              <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
                Horario
              </p>
              <div className="divide-y divide-border/40">
                {fullWeekSchedule(salon.hours).map((d, i) => {
                  // Domingo es el índice 6 de WEEK_DAYS_ES, pero el 0 de getDay().
                  const isToday = (new Date().getDay() + 6) % 7 === i;
                  return (
                    <div
                      key={d.label}
                      className={cn(
                        "flex justify-between py-2 text-sm",
                        isToday && "font-medium text-primary",
                      )}
                    >
                      <span className={cn(!isToday && "text-muted-foreground")}>{d.label}</span>
                      <span className={cn(!isToday && "font-medium")}>{d.value}</span>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative isolate overflow-hidden border-t border-border/40">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,color-mix(in_oklab,var(--color-primary)_18%,transparent),transparent)]"
        />
        <div className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
          <Reveal className="flex flex-col items-center">
            <h2 className="font-display text-3xl md:text-5xl">
              ¿Nos vemos <AuroraText colors={["#d6ab68", "#f0e6d2", "#b98a4d"]}>pronto</AuroraText>?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Elige servicio, barbero y hora en menos de un minuto.
            </p>

            {/* Caras reales del equipo, no stock. */}
            <div className="mt-7 flex flex-col items-center gap-2">
              <AvatarCircles avatarUrls={TEAM_AVATARS} />
              <p className="text-xs text-muted-foreground">
                {employees.length} barberos · {totalTeamYears} años de oficio entre los tres
              </p>
            </div>

            <ShimmerButton
              asChild
              shimmerColor="#f5e6c8"
              background="var(--color-primary)"
              className="mt-8 px-8 py-3.5 font-medium"
            >
              <Link
                to="/s/$salonSlug/book"
                params={{ salonSlug }}
                className="flex items-center gap-2 text-[color:var(--color-primary-foreground)]"
              >
                Reservar ahora <ArrowRight className="h-4 w-4" />
              </Link>
            </ShimmerButton>
          </Reveal>
        </div>
      </section>

      {/* Espaciador para que la barra fija móvil no tape el CTA final en pantallas pequeñas */}
      <div className="h-20 md:hidden" aria-hidden="true" />

      <MobileBookingBar salonSlug={salonSlug} />
    </>
  );
}
