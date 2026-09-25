import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { DEMO_PARAM } from "@/lib/demo-profile";
import { logoDelSalon } from "@/lib/logo-salon";
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Info,
  Instagram,
  MapPin,
  Navigation,
  Phone,
  Quote,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import {
  employeesForType,
  servicesForType,
} from "@/lib/mock/salon";
import { useSalonStore } from "@/lib/store";
import { recargoActivo } from "@/lib/recargo-activo";
import { useRealSalonSlug } from "@/lib/use-real-salon";
import { useBusinessType, useDisplayProfile } from "@/lib/use-display-profile";
import {
  categoryOrderOf,
  FEATURED_IDS_BY_TYPE,
  fotoDeProfesional,
  professionalWord,
  showsRealPhotos,
  type BusinessType,
  placeholderAvatar,
} from "@/lib/business-type";
import { StylistAvatar } from "@/components/StylistAvatar";
import type { EmployeeId } from "@/lib/mock/types";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useMemo, useState } from "react";
import { isOpenNow, todayOpenInfo, weekSchedule } from "@/lib/opening-hours";
import { useClientNow } from "@/lib/use-client-now";
import { galleryPhotosFor } from "@/lib/demo-photos";
import { useImagenConRespaldo } from "@/lib/imagen-rota";
import heroImg from "@/assets/hero-salon.jpg";
import heroSalonImg from "@/assets/gallery-salon.jpg";
import { WorkGallery } from "@/components/WorkGallery";
import { MobileBookingBar } from "@/components/MobileBookingBar";
import { Reveal } from "@/components/Reveal";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
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
import { AvatarCircles } from "@/components/magicui/avatar-circles";
import { BentoCard, BentoGrid } from "@/components/magicui/bento-grid";
import { BorderBeam } from "@/components/magicui/border-beam";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Marquee } from "@/components/magicui/marquee";
import { cintaDeSalon } from "@/lib/salon-words";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { WordRotate } from "@/components/magicui/word-rotate";
import { TeamShowcase } from "@/components/twentyfirst/team-showcase";
import { cn } from "@/lib/utils";
import { eur } from "@/lib/copy";
import { faqPublica } from "@/lib/faq";
import { reglaSenal, respuestaFaqSenal, resumenCancelacionSenal, servicioLlevaSenal, type ReglaSenal } from "@/lib/senal";

export const Route = createFileRoute("/s/$salonSlug/")({
  component: SalonHome,
});

type Review = { name: string; rating: number; quote: string };

/**
 * Reseñas de ejemplo. No hay reseñas reales todavía — se muestran marcadas
 * como ejemplo (ver nota junto al título de la sección y la etiqueta en cada
 * tarjeta) para que quede claro que hay que sustituirlas. Cambian con el tipo
 * de negocio: una peluquería de señoras no debe enseñar una reseña alabando
 * "el mejor arreglo de barba".
 */
const REVIEWS_BY_TYPE: Record<BusinessType, Review[]> = {
  barberia: [
    // «{pro}» se sustituye por el primer barbero del equipo activo: si el
    // enlace trae equipo real (Adam), la reseña no puede alabar a Mario.
    {
      name: "Dani R.",
      rating: 5,
      quote: "{pro} entiende exactamente lo que le pido. Salgo nuevo cada vez.",
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
      quote: "El degradado quedó justo como lo habíamos hablado. Repetiré sin dudarlo.",
    },
  ],
  peluqueria: [
    {
      name: "Marta R.",
      rating: 5,
      quote: "Salgo distinta cada vez. Entienden exactamente lo que les pido.",
    },
    { name: "Carmen M.", rating: 5, quote: "Las mejores mechas de Madrid, sin discusión." },
    {
      name: "Elena G.",
      rating: 5,
      quote: "Ambiente cuidado y muy puntuales con la hora de la cita.",
    },
    {
      name: "Javier P.",
      rating: 5,
      quote: "Reservé desde el móvil en un minuto y a la hora exacta estaba en el sillón.",
    },
    {
      name: "Nuria S.",
      rating: 4,
      quote: "El color quedó justo como lo habíamos hablado. Repetiré sin dudarlo.",
    },
  ],
  estetica: [
    {
      name: "Marta R.",
      rating: 5,
      quote: "Salgo distinta cada vez. Entienden exactamente lo que les pido.",
    },
    { name: "Carmen M.", rating: 5, quote: "La mejor manicura de Madrid, sin discusión." },
    {
      name: "Elena G.",
      rating: 5,
      quote: "Ambiente cuidado y muy puntuales con la hora de la cita.",
    },
    {
      name: "Javier P.",
      rating: 5,
      quote: "Reservé desde el móvil en un minuto y a la hora exacta estaba en el sillón.",
    },
    {
      name: "Nuria S.",
      rating: 4,
      quote: "El color quedó justo como lo habíamos hablado. Repetiré sin dudarlo.",
    },
  ],
  unisex: [
    {
      name: "Marta R.",
      rating: 5,
      quote: "Salgo distinta cada vez. Entienden exactamente lo que les pido.",
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
  ],
};

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
 * el equipo son tres, la cancelación gratuita es la que marca la política de
 * plantón del salón (24 h por defecto, o las horas pactadas si tiene
 * penalización activa — ver no-show.ts) y los precios y duraciones salen del
 * catálogo.
 *
 * Los destinos son anclas de esta misma página a propósito: `BentoCard`
 * renderiza un `<a href>` normal y una ruta real forzaría recarga completa en
 * vez de navegar por el router. Para reservar ya están los botones de arriba,
 * el de la cabecera y la barra fija del móvil.
 */
function bentoItemsFor(
  tipo: BusinessType,
  noShowFeeEur: number,
  noShowNoticeHours: number,
  single: boolean,
  proName?: string,
  textoSenal = "",
) {
  const palabra = professionalWord(tipo);
  // Señal por Bizum (caso PeluChic): el salón no penaliza, pide una señal al
  // confirmar la cita. Se enseña en la tarjeta de cancelación, que es donde
  // la clienta busca "qué pasa con mi dinero".
  const cancelacion =
    recargoActivo({ noShowFeeEur })
      ? `Hasta ${noShowNoticeHours} h antes, sin coste. Después, ${eur(noShowFeeEur)} de penalización.`
      : textoSenal
        ? textoSenal
        : "Hasta 24 horas antes, sin coste y sin dar explicaciones.";
  return [
    {
      Icon: CalendarCheck,
      name: "Reserva sin llamar",
      description: single
        ? "Eliges servicio y hora desde el móvil. Sin teléfono y sin esperar a que abramos."
        : `Eliges servicio, ${palabra} y hora desde el móvil. Sin teléfono y sin esperar a que abramos.`,
      href: "#servicios",
      cta: "Empezar por la carta",
      className: "lg:col-span-2",
    },
    single
      ? {
          Icon: Users,
          name: "Trato directo",
          description: `Siempre te atiende ${proName ?? "la misma persona"}, sin intermediarios ni cambios de última hora.`,
          href: "#equipo",
          cta: "Conócele",
          className: "lg:col-span-1",
        }
      : {
          Icon: Users,
          name: `Eliges ${palabra}`,
          description:
            "El equipo que prefieras. O el primero que tenga hueco, si lo que corre es la hora.",
          href: "#equipo",
          cta: "Ver el equipo",
          className: "lg:col-span-1",
        },
    {
      Icon: ShieldCheck,
      name: "Cancelas gratis",
      description: cancelacion,
      href: "#faq",
      cta: "Ver condiciones",
      className: "lg:col-span-1",
    },
    {
      Icon: Scissors,
      name: "Nuestro trabajo, de cerca",
      description: "Pasa la lupa por las fotos de la galería y mira el detalle de cada servicio.",
      href: "#galeria",
      cta: "Ver la galería",
      className: "lg:col-span-2",
    },
  ];
}

/** Tarjeta de reseña del muro. Ancho fijo: es lo que espera un marquee. */
function ReviewCard({ name, rating, quote }: Review) {
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

/**
 * Presentación de un salón con un único profesional (caso Adam): sustituye a
 * `TeamShowcase`, pensada para tres fichas, que con una sola persona queda
 * descompensada. Foto grande si la hay (StylistAvatar cae sola al avatar de
 * iniciales si no), nombre, especialidad y años de experiencia en una línea.
 */
function SoloProfessional({
  name,
  specialty,
  yearsExperience,
  photo,
  employeeId,
}: {
  name: string;
  specialty: string;
  yearsExperience: number;
  photo?: string;
  employeeId: EmployeeId;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
      <div
        className={cn(
          "shrink-0 overflow-hidden rounded-3xl border-2 border-primary/20",
          photo ? "h-56 w-56 sm:h-64 sm:w-64" : "h-40 w-40",
        )}
      >
        {photo ? (
          <img src={photo} alt={name} className="h-full w-full object-cover" />
        ) : (
          <StylistAvatar name={name} employeeId={employeeId} size="lg" className="h-full w-full" />
        )}
      </div>
      <div>
        <p className="font-display text-2xl md:text-3xl">{name}</p>
        <p className="mt-1 text-muted-foreground">
          {specialty} · {yearsExperience} años de experiencia
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Siempre te atiende {name.split(" ")[0]}, sin cambios de última hora.
        </p>
      </div>
    </div>
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
  const profile = useDisplayProfile();
  // La demo (enlace ?d= o navegador sin salón real) resuelve su logo de la
  // lista estática de demos; un salón real, solo el que haya guardado.
  const sinSalonReal = useSalonStore((s) => !s.realSalonSlug);
  const conEnlaceDemo = useRouterState({ select: (st) => typeof (st.location.search as Record<string, unknown>)[DEMO_PARAM] === "string" });
  const logoPortada = logoDelSalon(profile, sinSalonReal || conEnlaceDemo);
  const tipo = useBusinessType();
  // Una portada propia puede dejar de cargar sin que nadie lo sepa: el enlace
  // de demo la trae fija (caso PeluChic, foto de Google Places servida por
  // `/api/foto`), y esa foto puede desaparecer de la ficha, o faltar la clave
  // de Google (503). Sin respaldo queda un icono de imagen rota a pantalla completa.
  const portada = useImagenConRespaldo(profile.heroImage, tipo === "barberia" ? heroImg : heroSalonImg);
  // El parser de búsqueda de TanStack Router convierte "2" en el NÚMERO 2, no
  // en la cadena "2" — de ahí el `String(...)` antes de comparar.
  const isV2 = useRouterState({
    select: (s) => String((s.location.search as Record<string, unknown>)?.v) === "2",
  });
  // `hl=es`: sin él el iframe de Google Maps sale en inglés ("Open in Maps",
  // "Keyboard shortcuts") dentro de una web en español (auditoría, hallazgo C6).
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(profile.address)}&output=embed&hl=es`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(profile.address)}`;
  // Enlace a la ficha de Google del salón, para las reseñas reales (ver
  // sección de Reseñas más abajo). No hay un id de ficha guardado en el
  // perfil, así que se busca por nombre + dirección: honesto y sin inventar
  // una URL que pueda no ser la suya.
  const googleReviewsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${profile.name} ${profile.address}`)}`;
  // Auditoría, hallazgo C3: un salón REAL no puede enseñar reseñas
  // inventadas con la etiqueta "Ejemplo" a su propio cliente. Las demos de
  // venta (el resto de esta condición) siguen exactamente igual que hoy.
  const isRealSalon = useRealSalonSlug() === salonSlug;
  const hasGoogleReviews = isRealSalon && profile.rating > 0 && profile.reviewCount > 0;

  // Catálogo y equipo calculados a partir del tipo deducido del enlace —no
  // del catálogo/equipo "activo" mutado en mock/salon.ts, que solo se
  // actualiza tras un efecto de cliente— para que el primer render (incluido
  // el del servidor) ya salga en el idioma correcto. Si el enlace trae carta
  // o equipo reales (profile.menu/profile.team), sustituyen al catálogo y
  // equipo de ejemplo del tipo.
  const services = useMemo(() => servicesForType(tipo, profile.menu), [tipo, profile.menu]);
  const serviceMap = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services]);
  const employees = useMemo(() => employeesForType(tipo, profile.team, profile.teamHours, profile.openingHours, profile.teamIds), [tipo, profile.team, profile.teamHours, profile.openingHours, profile.teamIds]);
  /**
   * Adam es el único barbero de su barbería. Con un solo profesional, la
   * sección "Equipo" no cuenta nada (una ficha suelta de la persona que ya
   * firma toda la web) y los textos de "elige tu barbero" son ruido. Se
   * deriva del equipo activo, así que una demo de tres barberos no cambia.
   */
  const soloUno = esSoloUnProfesional(employees);

  const activeServices = services.filter((s) => s.active !== false);
  const categoryOrder = categoryOrderOf(services);
  // Con carta real no hay ids fijos que mapear a "destacados": se enseñan los
  // cuatro primeros de la carta, en el orden en que se dieron.
  const featuredIds = profile.menu?.length
    ? activeServices.slice(0, 4).map((s) => s.id)
    : FEATURED_IDS_BY_TYPE[tipo];
  const noShowFeeEur = profile.noShowFeeEur ?? 0;
  const noShowNoticeHours = profile.noShowNoticeHours ?? 2;
  // Salón con un solo profesional (caso Adam): la sección de equipo, el
  // bento "Eliges barbero" y la FAQ de elegir profesional no tienen sentido.
  const soloPro = employees[0];
  // La señal sale de UNA regla (9j): la carta, la tarjeta de cancelación y la
  // FAQ dicen lo mismo, y nada si el salón no la pide.
  const reglaDeSenal = reglaSenal(profile);
  const textoSenal = reglaDeSenal.activa ? respuestaFaqSenal(reglaDeSenal, (n) => eur(n).replace(",00", "")) : "";
  const bentoItems = bentoItemsFor(
    tipo,
    noShowFeeEur,
    noShowNoticeHours,
    soloUno,
    soloPro?.name,
    textoSenal,
  );
  const faq = faqPublica(tipo, noShowFeeEur, noShowNoticeHours, profile.faq, soloUno, respuestaFaqSenal(reglaDeSenal, eur)).map(
    (entry) => {
      if (profile.faq?.length) return entry;
      if (entry.q === "¿Hace falta pagar por adelantado?") {
        return { ...entry, a: respuestaFaqSenal(reglaDeSenal, (n) => eur(n).replace(",00", "")) };
      }
      if (soloUno && entry.q === "¿Quién me va a atender?" && soloPro) {
        return { ...entry, a: `Siempre te atiende ${soloPro.name}, sin turnos ni sustitutos.` };
      }
      return entry;
    },
  );
  // v2: como mucho dos reseñas de ejemplo, y ya van marcadas "Ejemplo" — el
  // cambio priorizado #9 del informe pide "copy del salón real, nunca
  // genérico"; cinco reseñas inventadas pesan más que dos.
  const pro = employees[0]?.name ?? "El equipo";
  const reviews = (isV2 ? REVIEWS_BY_TYPE[tipo].slice(0, 2) : REVIEWS_BY_TYPE[tipo]).map((r) => ({
    ...r,
    quote: r.quote.replace("{pro}", pro),
  }));
  // Hora del navegador: en el servidor no se sabe qué hora es en el salón.
  const now = useClientNow();
  const openNow = now ? isOpenNow(profile.openingHours, now) : false;
  const estadoHoy = now ? todayOpenInfo(profile.openingHours, now) : "Horario";
  // Las fotos del equipo: la de stock solo en una DEMO de barbería. En un
  // salón real no se enseña la cara de un desconocido como si fuera suya —
  // iniciales (ver `fotoDeProfesional`).
  const fotoDe = (e: (typeof employees)[number]) =>
    fotoDeProfesional(e.name, e.id, e.photo, tipo, isRealSalon);
  const TEAM_AVATARS = employees.map((e) => ({
    imageUrl: fotoDe(e),
    profileUrl: `/s/${salonSlug}#equipo`,
  }));
  const totalTeamYears = employees.reduce((sum, e) => sum + e.yearsExperience, 0);
  // "entre los tres" solo tiene sentido con equipo de tres; con un enlace de
  // equipo real puede haber uno o dos. Máximo tres: nunca hay más franjas.
  const entreElEquipo =
    employees.length === 1 ? "" : employees.length === 2 ? " entre los dos" : " entre los tres";
  // Cifras sacadas del propio catálogo/equipo, no inventadas.

  return (
    <>
      {/* ------------------------------------------------------------------
       * Hero a sangre. Foto + doble degradado para que el texto sea legible
       * pase lo que pase con la imagen, y entrada escalonada al estilo de
       * los bloques de Tailark.
       * ---------------------------------------------------------------- */}
      <section className="relative isolate flex min-h-[85vh] items-end overflow-hidden text-white sm:items-center">
        <img
          // Sin foto propia (hay dos locales del rutero cuya ficha de Google
          // está vacía), o si la propia no carga (404 o 503 de /api/foto,
          // ficha cambiada…), se usa una de ejemplo, pero no la misma para
          // todos: un sillón de barbero de portada en una peluquería de
          // señoras canta tanto como una foto mala. El fallo puede llegar
          // antes de hidratar: lo cubre useImagenConRespaldo.
          src={portada.src}
          ref={portada.ref}
          onError={portada.onError}
          alt={`Interior de ${profile.name}`}
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          width={1920}
          height={1280}
          fetchPriority="high"
        />
        {/* Velo en tinta café sobre la foto (nunca negro puro): lo justo para
            que el texto blanco se lea encima de cualquier portada. */}
        <div className="absolute inset-0 -z-10 bg-cafe/60" />

        <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-5 py-20 sm:py-24 md:py-32">
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
                  text={estadoHoy}
                  baseColor="rgb(255 255 255 / 0.92)"
                  className="font-medium"
                  speed={5}
                />
                <span className="text-white/40" aria-hidden="true">
                  ·
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  <span className="font-medium">{profile.rating}</span>
                </span>
              </div>

              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 backdrop-blur-sm">
                {/* El color base tiene que ir con la variante `dark:` puesta:
                    el componente trae `dark:text-neutral-400/70` y esa variante
                    le gana a un `text-white/70` a secas por especificidad, no
                    por orden — quedaba gris ilegible sobre la foto del hero. */}
                <AnimatedShinyText className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/85 dark:text-white/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  Reservas en menos de un minuto
                </AnimatedShinyText>
              </div>
            </div>

            {logoPortada && (
              <span className="mb-4 block size-[72px] overflow-hidden rounded-full border border-white/40 bg-white shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
                <img src={logoPortada} alt={`Logo de ${profile.name}`} className="h-full w-full object-cover" />
              </span>
            )}
            <h1
              className={cn(
                "font-display leading-[1.05] text-balance",
                // El tamaño baja con la longitud del nombre: "Pepe" merece el
                // titular grande, pero "Peluquería y Estética Los Ángeles" a
                // 7xl parte por la mitad y deja letras sueltas colgando.
                profile.name.length > 28
                  ? "text-3xl sm:text-4xl md:text-5xl"
                  : profile.name.length > 18
                    ? "text-4xl sm:text-5xl md:text-6xl"
                    : "text-5xl sm:text-6xl md:text-7xl",
              )}
            >
              {/* Anima por palabras y no por letras: con `per="char"` cada letra es
                  un span suelto y un nombre largo se parte por la mitad
                  ("Bar/bería" en una barbería real de Alcalá). */}
              <TextEffect
                as="span"
                per="word"
                preset="fade-in-blur"
                speedSegment={2.4}
                delay={0.2}
                className="block"
              >
                {profile.name}
              </TextEffect>
            </h1>

            {/* La palabra que va rotando cuenta lo que se hace aquí sin ocupar
                cuatro líneas de texto. Sin especialidades no hay frase: un
                "Especialistas en" a medias es peor que no decir nada. */}
            {profile.specialties.length > 0 && (
              <div className="flex flex-wrap items-baseline gap-x-2 text-lg text-white/80">
                <span>Especialistas en</span>
                <WordRotate
                  words={profile.specialties}
                  duration={2200}
                  className="font-display text-2xl text-primary"
                />
              </div>
            )}

            <p className="flex items-center gap-2 text-white/85">
              <MapPin className="h-4 w-4 shrink-0 text-primary" /> {profile.address}
            </p>
            {profile.about ? <p className="max-w-md text-white/70">{profile.about}</p> : null}

            {isV2 ? (
              // v2: tres botones del mismo peso — reservar, llamar, cómo
              // llegar. Cambio priorizado del informe: el dueño quiere que
              // sin cita y por teléfono sigan siendo caminos igual de
              // válidos, no un botón grande y dos enlaces sueltos.
              <div className="grid grid-cols-1 gap-2.5 pt-2 sm:grid-cols-3 sm:gap-3">
                <Button asChild size="lg" className="w-full rounded-full px-6 font-medium">
                  <Link
                    to="/s/$salonSlug/book"
                    params={{ salonSlug }}
                    search={(prev) => prev}
                    className="gap-2"
                  >
                    Reservar por internet <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full border-white/30 bg-white/10 px-6 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
                >
                  <a href={`tel:${profile.phone.replace(/\s/g, "")}`} className="gap-2">
                    <Phone className="h-4 w-4" /> Llamar
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full border-white/30 bg-white/10 px-6 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
                >
                  <a href={directionsUrl} target="_blank" rel="noreferrer" className="gap-2">
                    <Navigation className="h-4 w-4" /> Cómo llegar
                  </a>
                </Button>
              </div>
            ) : (
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
                    search={(prev) => prev}
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
            )}

            {/* Línea honesta: quien atiende sin cita y por teléfono no debe
                leer la web como si eso no contara. */}
            {isV2 && (
              <p className="pt-1 text-sm text-white/65">
                También puedes venir sin cita o llamar: la agenda la lleva{" "}
                {soloUno ? employees[0].name : `el equipo de ${profile.name}`}
                {soloUno ? ", de " + profile.name + "." : "."}
              </p>
            )}
          </AnimatedGroup>
        </div>
      </section>

      {/* Barra de info rápida */}
      <section className="border-y border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 text-sm">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Clock className="h-4 w-4 shrink-0 text-primary" /> {estadoHoy}
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
          items={cintaDeSalon(profile.tagline, profile.specialties)}
          velocity={28}
          className="font-display text-xl text-muted-foreground/70 sm:text-2xl"
        />
      </div>

      {/* Servicios destacados */}
      <section
        id="servicios"
        className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-5 py-16 md:py-24"
      >
        <SectionHeading eyebrow="Más reservados" title="Servicios destacados" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featuredIds.map((id, i) => {
            const s = serviceMap[id];
            if (!s) return null;
            const label = { name: s.name, description: s.description };
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
                    search={(prev) => ({ ...prev, service: id })}
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

      {/* Catálogo completo */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-5 py-16 md:py-24">
          <SectionHeading eyebrow="El menú completo" title="Todos los servicios" />
          <Reveal>
            <Accordion
              type="single"
              collapsible
              defaultValue={categoryOrder[0]}
              className="divide-y divide-border/40"
            >
              {categoryOrder.map((cat) => {
                const items = activeServices.filter((s) => (s.category ?? "Otros") === cat);
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
                          const label = { name: s.name, description: s.description };
                          return (
                            <Link
                              key={s.id}
                              to="/s/$salonSlug/book"
                              params={{ salonSlug }}
                              search={(prev) => ({ ...prev, service: s.id })}
                              className="group flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-muted/30"
                            >
                              <div className="min-w-0">
                                <p className="font-medium">{label.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {s.durationMin} min
                                  {servicioLlevaSenal(reglaDeSenal, s) ? " · con señal" : ""}
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
      <WorkGallery photos={galleryPhotosFor(profile)} tipo={profile.tagline} />

      {/* Equipo */}
      <section id="equipo" className="border-t border-border/40 bg-card">
        <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-5 py-16 md:py-24">
          <SectionHeading eyebrow="Equipo" title="Quién te va a atender" className="mb-12" />
          {soloUno && soloPro ? (
            // Con un solo profesional, la rejilla de tres fichas de
            // TeamShowcase no tiene sentido: una presentación de una sola
            // persona, con foto grande si la hay.
            <Reveal>
              <SoloProfessional
                name={soloPro.name}
                specialty={soloPro.specialty}
                yearsExperience={soloPro.yearsExperience}
                photo={showsRealPhotos(tipo) ? fotoDe(soloPro) : undefined}
                employeeId={soloPro.id}
              />
            </Reveal>
          ) : (
            /* Retratos grandes en vez de avatares pequeños: en una barbería
               la cara del que te va a cortar es parte de lo que se vende. */
            <Reveal>
              {employees.every((e) => fotoDe(e) === placeholderAvatar(e.name, e.id)) ? (
                // Sin ninguna foto, el collage de retratos solo enseñaba letras
                // gigantes montadas unas sobre otras: fichas sencillas y legibles.
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {employees.map((e, i) => (
                    <li key={e.id} className="flex items-center gap-4 rounded-[20px] border border-lino bg-background p-5">
                      <span
                        className="grid size-16 shrink-0 place-items-center rounded-full border border-cafe/30 font-display text-2xl text-cafe"
                        style={{ background: `var(--pro-${(i % 4) + 1})` }}
                        aria-hidden="true"
                      >
                        {e.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <b className="block font-display text-xl font-medium">{e.name}</b>
                        <span className="block text-sm text-muted-foreground">{e.specialty}</span>
                        <span className="block text-[13px] text-cafe-suave tabular-nums">{e.yearsExperience} años de experiencia</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
              <TeamShowcase
                members={employees.map((e) => ({
                  id: e.id,
                  name: e.name,
                  role: `${e.specialty} · ${e.yearsExperience} años`,
                  image: fotoDe(e),
                }))}
              />
              )}
            </Reveal>
          )}
        </div>
      </section>

      {/* Reseñas.
          Auditoría de UX, hallazgo C3: la web de un salón REAL no puede
          enseñar dos reseñas inventadas con la etiqueta "Ejemplo" a su propio
          cliente — es lo que le pasaba a Adam, que en Google tiene 132
          reseñas de verdad. Un salón real usa la nota y el número que ya trae
          su perfil, con un enlace a su ficha; si no tiene ninguno, no se
          enseña nada inventado. Las demos de venta (más abajo) siguen
          exactamente igual que siempre: las siguen enseñando, marcadas. */}
      {isRealSalon ? (
        hasGoogleReviews ? (
          <section id="resenas" className="border-t border-border/40 bg-card">
            <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-5 py-16 text-center md:py-24">
              <p className="text-xs uppercase tracking-[0.25em] text-primary">Reseñas</p>
              <h2 className="mt-2 font-display text-3xl md:text-4xl">Lo que dicen en Google</h2>
              <div className="mt-6 flex items-center justify-center gap-2">
                <span className="flex" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      className={cn(
                        "h-5 w-5",
                        j < Math.round(profile.rating)
                          ? "fill-primary text-primary"
                          : "text-muted-foreground/30",
                      )}
                    />
                  ))}
                </span>
                <span className="font-display text-2xl">{profile.rating}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.reviewCount} reseñas en Google
              </p>
              <Button asChild variant="outline" className="mt-6 rounded-full">
                <a href={googleReviewsUrl} target="_blank" rel="noreferrer">
                  Ver reseñas en Google
                </a>
              </Button>
            </div>
          </section>
        ) : null
      ) : (
        <section
          id="resenas"
          className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-5 py-16 md:py-24"
        >
          <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-primary">Reseñas</p>
              <h2 className="mt-2 font-display text-3xl md:text-4xl">
                Lo que dicen de nosotros
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Star className="h-4 w-4 fill-primary text-primary" />
              <span className="font-medium">{profile.rating}</span>
              <span className="text-muted-foreground">· {profile.reviewCount} reseñas</span>
            </div>
          </Reveal>
          <Reveal className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" /> Reseñas de ejemplo — sustitúyelas por las
            reseñas reales de tu salón.
          </Reveal>

          {/* Muro en dos filas que se cruzan. Se para al pasar el ratón para
              poder leer la que te interese. */}
          <Reveal className="relative [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]">
            <Marquee pauseOnHover className="[--duration:38s] [--gap:1.25rem]">
              {reviews.map((r) => (
                <ReviewCard key={r.name} {...r} />
              ))}
            </Marquee>
            <Marquee reverse pauseOnHover className="mt-5 [--duration:44s] [--gap:1.25rem]">
              {[...reviews].reverse().map((r) => (
                <ReviewCard key={r.name} {...r} />
              ))}
            </Marquee>
            {/* Sin degradados pintados (DESIGN.md): el borde del carrusel se
                recorta con una máscara, así las tarjetas no se cortan en seco. */}
          </Reveal>
        </section>
      )}

      {/* Preguntas frecuentes */}
      <section id="faq" className="border-t border-border/40 bg-card">
        <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-5 py-16 md:py-24">
          <SectionHeading eyebrow="Antes de venir" title="Preguntas frecuentes" />
          <Reveal>
            <Accordion type="single" collapsible className="divide-y divide-border/40">
              {faq.map((item) => (
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
        <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-5 py-16 md:py-24">
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
                {weekSchedule(profile.openingHours).map((d, i) => {
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
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-nata" />
        <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-5 py-20 text-center md:py-28">
          <Reveal className="flex flex-col items-center">
            <h2 className="font-display text-3xl md:text-5xl">
              ¿Nos vemos pronto?
            </h2>
            <p className="mt-3 text-muted-foreground">
              {soloUno
                ? "Elige servicio y hora en menos de un minuto."
                : `Elige servicio, ${professionalWord(tipo)} y hora en menos de un minuto.`}
            </p>

            {/* Caras reales del equipo en barbería; avatar de iniciales en el resto. */}
            <div className="mt-7 flex flex-col items-center gap-2">
              <AvatarCircles avatarUrls={TEAM_AVATARS} />
              <p className="text-xs text-muted-foreground">
                {soloUno
                  ? `Te atiende ${employees[0].name} · ${totalTeamYears} años de oficio`
                  : `${employees.length} ${professionalWord(tipo, true)} · ${totalTeamYears} años de oficio${entreElEquipo}`}
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
                search={(prev) => prev}
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
