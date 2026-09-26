import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { DEMO_PARAM } from "@/lib/demo-profile";
import { logoDelSalon } from "@/lib/logo-salon";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Instagram,
  MapPin,
  Navigation,
  Phone,
  Star,
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
import { useMemo } from "react";
import { isOpenNow, todayOpenInfo, weekSchedule } from "@/lib/opening-hours";
import { useClientNow } from "@/lib/use-client-now";
import { galleryPhotosFor } from "@/lib/demo-photos";
import { useImagenConRespaldo } from "@/lib/imagen-rota";
import heroImg from "@/assets/hero-salon.jpg";
import heroSalonImg from "@/assets/gallery-salon.jpg";
import { WorkGallery } from "@/components/WorkGallery";
import { MobileBookingBar } from "@/components/MobileBookingBar";
import { Reveal } from "@/components/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { TeamShowcase } from "@/components/twentyfirst/team-showcase";
import { cn } from "@/lib/utils";
import { CONTENEDOR_WEB, SECCION_WEB, listaConY, notaEs } from "@/lib/web-publica";
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

/** Estrellas de una nota, legibles por lector de pantalla como una sola imagen. */
function Estrellas({ nota, className }: { nota: number; className?: string }) {
  return (
    <span role="img" aria-label={`${notaEs(nota)} de 5 estrellas`} className={cn("flex gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, j) => (
        <Star
          key={j}
          aria-hidden="true"
          className={cn("h-4 w-4", j < Math.round(nota) ? "fill-moca text-moca" : "text-taupe")}
        />
      ))}
    </span>
  );
}

/** Tarjeta de reseña: rejilla fija, sin marquesina ni máscaras que la corten. */
function ReviewCard({ name, rating, quote, ejemplo }: Review & { ejemplo: boolean }) {
  return (
    <figure className="flex h-full flex-col rounded-[20px] border border-lino bg-card p-5 sm:p-6">
      <Estrellas nota={rating} />
      <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-foreground">
        «{quote}»
      </blockquote>
      <figcaption className="mt-5 flex items-center justify-between gap-3 border-t border-lino pt-4 text-sm">
        <span className="font-semibold text-foreground">{name}</span>
        {ejemplo && <span className="text-xs text-cafe-suave">Reseña de ejemplo</span>}
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
          <img src={photo} alt={name} width={256} height={256} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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

/**
 * Encabezado de sección (lote 17): etiqueta en mayúsculas pequeñas y título en
 * Manrope 800 a 26/32 px, la escala de DESIGN.md. La serif queda para los
 * nombres propios (el salón y las profesionales).
 */
function SectionHeading({
  eyebrow,
  title,
  intro,
  className,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  className?: string;
}) {
  return (
    <Reveal className={cn("mb-8 md:mb-10", className)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cafe-suave">{eyebrow}</p>
      <h2 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight text-foreground md:text-[32px]">
        {title}
      </h2>
      {intro && <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">{intro}</p>}
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
  const totalTeamYears = employees.reduce((sum, e) => sum + e.yearsExperience, 0);
  const especialidades = listaConY(profile.specialties);
  const telefono = profile.phone.replace(/\s/g, "");
  // Día de hoy en el cuadro de horario: solo en el cliente (ver useClientNow),
  // o el servidor en UTC marcaría otro día y la hidratación no lo corrige.
  const hoyIndice = now ? (now.getDay() + 6) % 7 : -1;
  const reseñasVisibles = reviews.slice(0, 3);

  return (
    <>
      {/* ------------------------------------------------------------------
       * Portada. Foto a sangre con velo café al 70 %: el texto blanco más
       * pequeño da ≥ 4,5:1 incluso sobre la zona más clara de la foto (lote
       * 17; con el 60 % y la especialidad en moca se quedaba en 1,15:1).
       * Entrada única de 520 ms desde opacidad 0,4, sin rebotes ni bucles.
       * ---------------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden text-white">
        <img
          // Sin foto propia, o si la propia no carga, se usa una de ejemplo
          // acorde al tipo de negocio (ver useImagenConRespaldo).
          src={portada.src}
          ref={portada.ref}
          onError={portada.onError}
          alt={`Interior de ${profile.name}`}
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          width={1920}
          height={1280}
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 -z-10 bg-cafe/70" aria-hidden="true" />

        <div className={cn(CONTENEDOR_WEB, "flex min-h-[520px] flex-col justify-end pb-12 pt-20 md:min-h-[600px] md:justify-center md:py-24")}>
          <div className="entrada-portada max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex h-8 items-center gap-2 rounded-full bg-white/15 px-3 font-semibold">
                <span
                  className={cn("size-2 rounded-full", openNow ? "bg-salvia" : "bg-white/60")}
                  aria-hidden="true"
                />
                {estadoHoy}
              </span>
              {profile.rating > 0 && (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3">
                  <Star className="h-3.5 w-3.5 fill-white text-white" aria-hidden="true" />
                  <span className="font-semibold tabular-nums">{notaEs(profile.rating)}</span>
                  {profile.reviewCount > 0 && (
                    <span className="text-white/90">· {profile.reviewCount} reseñas</span>
                  )}
                </span>
              )}
            </div>

            <div className="mt-6 flex items-center gap-4">
              {logoPortada && (
                <span className="block size-16 shrink-0 overflow-hidden rounded-full border border-white/50 bg-white md:size-[72px]">
                  <img
                    src={logoPortada}
                    alt={`Logo de ${profile.name}`}
                    width={72}
                    height={72}
                    className="h-full w-full object-cover"
                  />
                </span>
              )}
              <h1
                className={cn(
                  "font-display font-medium leading-[1.05] text-balance",
                  // El tamaño baja con la longitud del nombre para no partirlo.
                  profile.name.length > 28
                    ? "text-3xl sm:text-4xl md:text-5xl"
                    : profile.name.length > 18
                      ? "text-4xl sm:text-5xl md:text-6xl"
                      : "text-5xl sm:text-6xl md:text-7xl",
                )}
              >
                {profile.name}
              </h1>
            </div>

            {especialidades && (
              <p className="mt-5 text-lg text-white md:text-xl">
                Especialistas en <span className="font-semibold">{especialidades}</span>
              </p>
            )}
            {profile.about ? <p className="mt-3 max-w-md text-[15px] text-white/90">{profile.about}</p> : null}

            <p className="mt-4 flex items-start gap-2 text-[15px] text-white/90">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{profile.address}</span>
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-[15px] font-semibold">
                <Link to="/s/$salonSlug/book" params={{ salonSlug }} search={(prev) => prev} className="gap-2">
                  Reservar cita <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              {isV2 ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-white/60 bg-transparent px-6 text-[15px] text-white hover:bg-white/10 hover:text-white"
                >
                  <a href={`tel:${telefono}`} className="gap-2">
                    <Phone className="h-4 w-4" aria-hidden="true" /> Llamar
                  </a>
                </Button>
              ) : (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-white/60 bg-transparent px-6 text-[15px] text-white hover:bg-white/10 hover:text-white"
                >
                  <a href="#carta">Ver precios</a>
                </Button>
              )}
            </div>
            {isV2 && (
              <p className="mt-4 text-sm text-white/90">
                También puedes venir sin cita o llamar: la agenda la lleva{" "}
                {soloUno ? `${employees[0].name}, de ${profile.name}.` : `el equipo de ${profile.name}.`}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Servicios destacados */}
      <section id="servicios" className={cn(CONTENEDOR_WEB, SECCION_WEB)}>
        <SectionHeading
          eyebrow="Lo más pedido"
          title="Servicios destacados"
          intro="Toca uno para reservarlo directamente."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {featuredIds.map((id, i) => {
            const s = serviceMap[id];
            if (!s) return null;
            return (
              <Reveal key={id} delay={i * 60} className="h-full">
                <Link
                  to="/s/$salonSlug/book"
                  params={{ salonSlug }}
                  search={(prev) => ({ ...prev, service: id })}
                  className="elevar group flex h-full flex-col sm:min-h-[132px] rounded-[20px] border border-lino bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold leading-snug text-foreground">{s.name}</h3>
                    <span className="shrink-0 text-lg font-extrabold tabular-nums text-foreground">{eur(s.priceEur)}</span>
                  </div>
                  {s.description ? (
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-cafe-suave tabular-nums">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {s.durationMin} min
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      Reservar <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Carta completa */}
      <section id="carta" className="border-t border-lino bg-card">
        <div className={cn(CONTENEDOR_WEB, SECCION_WEB)}>
          <SectionHeading
            eyebrow="Precios"
            title="Carta completa"
            intro={reglaDeSenal.activa ? "Los servicios marcados «con señal» se confirman con un pequeño adelanto." : undefined}
          />
          <Reveal>
            <Accordion
              type="multiple"
              defaultValue={categoryOrder.slice(0, 1)}
              className="space-y-3"
            >
              {categoryOrder.map((cat) => {
                const items = activeServices.filter((s) => (s.category ?? "Otros") === cat);
                if (!items.length) return null;
                return (
                  <AccordionItem key={cat} value={cat} className="rounded-[20px] border border-lino bg-background px-4 sm:px-5">
                    <AccordionTrigger className="min-h-14 gap-3 py-3 text-base font-bold hover:no-underline">
                      <span className="flex-1 text-left">{cat}</span>
                      <span className="rounded-full bg-beige px-2.5 py-0.5 text-xs font-semibold tabular-nums text-cafe-medio">
                        {items.length} {items.length === 1 ? "servicio" : "servicios"}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <ul className="grid gap-2 lg:grid-cols-2">
                        {items.map((s) => (
                          <li key={s.id}>
                            <Link
                              to="/s/$salonSlug/book"
                              params={{ salonSlug }}
                              search={(prev) => ({ ...prev, service: s.id })}
                              className="group flex min-h-14 items-center justify-between gap-4 rounded-xl border border-lino bg-card px-4 py-3 transition-colors hover:border-lino-fuerte hover:bg-perla"
                            >
                              <span className="min-w-0">
                                <span className="block font-semibold text-foreground">{s.name}</span>
                                <span className="block text-sm text-muted-foreground tabular-nums">
                                  {s.durationMin} min
                                  {servicioLlevaSenal(reglaDeSenal, s) ? " · con señal" : ""}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2 font-extrabold tabular-nums text-foreground">
                                {eur(s.priceEur)}
                                <ChevronRight className="h-4 w-4 text-cafe-suave" aria-hidden="true" />
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* Equipo */}
      {!soloUno || soloPro ? (
        <section id="equipo" className="border-t border-lino">
          <div className={cn(CONTENEDOR_WEB, SECCION_WEB)}>
            <SectionHeading
              eyebrow="Equipo"
              title="Quién te va a atender"
              intro={soloUno ? undefined : `${employees.length} ${professionalWord(tipo, true)} y ${totalTeamYears} años de oficio entre todas. Puedes elegir con quién reservar.`}
            />
            {soloUno && soloPro ? (
              <Reveal>
                <SoloProfessional
                  name={soloPro.name}
                  specialty={soloPro.specialty}
                  yearsExperience={soloPro.yearsExperience}
                  photo={showsRealPhotos(tipo) ? fotoDe(soloPro) : undefined}
                  employeeId={soloPro.id}
                />
              </Reveal>
            ) : employees.every((e) => fotoDe(e) === placeholderAvatar(e.name, e.id)) ? (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {employees.map((e, i) => (
                  <li key={e.id} className="h-full">
                  <Reveal delay={i * 60} className="flex h-full items-center gap-4 rounded-[20px] border border-lino bg-card p-5">
                      <span
                        className="grid size-16 shrink-0 place-items-center rounded-full font-display text-2xl text-cafe"
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
                  </Reveal>
                  </li>
                ))}
              </ul>
            ) : (
              <Reveal>
                <TeamShowcase
                  members={employees.map((e) => ({
                    id: e.id,
                    name: e.name,
                    role: `${e.specialty} · ${e.yearsExperience} años`,
                    image: fotoDe(e),
                  }))}
                />
              </Reveal>
            )}
          </div>
        </section>
      ) : null}

      {/* Galería de trabajos */}
      <WorkGallery photos={galleryPhotosFor(profile)} tipo={profile.tagline} />

      {/* Reseñas. Un salón REAL solo enseña su nota de Google (nunca reseñas
          inventadas); las demos de venta, tres de ejemplo marcadas como tal. */}
      {isRealSalon ? (
        hasGoogleReviews ? (
          <section id="resenas" className="border-t border-lino bg-card">
            <div className={cn(CONTENEDOR_WEB, SECCION_WEB, "text-center")}>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cafe-suave">Reseñas</p>
              <h2 className="mt-2 text-[26px] font-extrabold tracking-tight md:text-[32px]">Lo que dicen en Google</h2>
              <div className="mt-6 flex items-center justify-center gap-2">
                <Estrellas nota={profile.rating} className="[&_svg]:h-5 [&_svg]:w-5" />
                <span className="text-2xl font-extrabold tabular-nums">{notaEs(profile.rating)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{profile.reviewCount} reseñas en Google</p>
              <Button asChild variant="outline" className="mt-6 h-11 rounded-full px-6">
                <a href={googleReviewsUrl} target="_blank" rel="noreferrer">
                  Ver reseñas en Google
                </a>
              </Button>
            </div>
          </section>
        ) : null
      ) : (
        <section id="resenas" className="border-t border-lino bg-card">
          <div className={cn(CONTENEDOR_WEB, SECCION_WEB)}>
            <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cafe-suave">Reseñas</p>
                <h2 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight md:text-[32px]">
                  Lo que dicen las clientas
                </h2>
              </div>
              {profile.rating > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Estrellas nota={profile.rating} />
                  <span className="font-bold tabular-nums">{notaEs(profile.rating)}</span>
                  <span className="text-muted-foreground">· {profile.reviewCount} reseñas</span>
                </div>
              )}
            </Reveal>
            <div className="grid gap-3 md:grid-cols-3">
              {reseñasVisibles.map((r, i) => (
                <Reveal key={r.name} delay={i * 60} className="h-full">
                  <ReviewCard {...r} ejemplo />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Preguntas frecuentes */}
      <section id="faq" className="border-t border-lino">
        <div className={cn(CONTENEDOR_WEB, SECCION_WEB, "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12")}>
          <SectionHeading eyebrow="Antes de venir" title="Preguntas frecuentes" className="lg:mb-0" />
          <Reveal>
            <Accordion type="single" collapsible className="divide-y divide-lino rounded-[20px] border border-lino bg-card px-4 sm:px-5">
              {faq.map((item) => (
                <AccordionItem key={item.q} value={item.q} className="border-b-0">
                  <AccordionTrigger className="min-h-14 gap-3 py-3 text-left text-[15px] font-semibold hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-[15px] leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* Ubicación y horario: sin iframe de Google Maps (se quedaba en blanco
          hasta cargar y restaba rendimiento); un botón abre la ruta. */}
      <section id="ubicacion" className="border-t border-lino bg-card">
        <div className={cn(CONTENEDOR_WEB, SECCION_WEB)}>
          <SectionHeading eyebrow="Ubicación y horario" title="Te esperamos aquí" />
          <div className="grid gap-3 md:grid-cols-2">
            <Reveal className="h-full">
              <div className="flex h-full flex-col rounded-[20px] border border-lino bg-background p-5 sm:p-6">
                <p className="flex items-start gap-3 text-[15px]">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>{profile.address}</span>
                </p>
                <a
                  href={`tel:${telefono}`}
                  className="mt-2 flex min-h-11 items-center gap-3 text-[15px] font-semibold tabular-nums hover:text-primary"
                >
                  <Phone className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /> {profile.phone}
                </a>
                {profile.instagram?.trim() ? (
                  <a
                    href={`https://instagram.com/${profile.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center gap-3 text-[15px] hover:text-primary"
                  >
                    <Instagram className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /> {profile.instagram}
                  </a>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-5">
                  <Button asChild className="h-11 rounded-full px-5">
                    <a href={directionsUrl} target="_blank" rel="noreferrer" className="gap-2">
                      <Navigation className="h-4 w-4" aria-hidden="true" /> Cómo llegar
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-full px-5">
                    <a href={`tel:${telefono}`} className="gap-2">
                      <Phone className="h-4 w-4" aria-hidden="true" /> Llamar
                    </a>
                  </Button>
                </div>
              </div>
            </Reveal>
            <Reveal delay={60} className="h-full">
              <div className="h-full rounded-[20px] border border-lino bg-background p-5 sm:p-6">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-cafe-suave">Horario</p>
                <ul className="divide-y divide-lino">
                  {weekSchedule(profile.openingHours).map((d, i) => (
                    <li
                      key={d.label}
                      className={cn(
                        "flex justify-between gap-4 py-2.5 text-[15px]",
                        i === hoyIndice && "font-bold text-foreground",
                      )}
                    >
                      <span className={cn(i !== hoyIndice && "text-muted-foreground")}>
                        {d.label}
                        {i === hoyIndice && <span className="ml-2 rounded-full bg-salvia-clara px-2 py-0.5 text-xs font-semibold text-hoja-tinta">Hoy</span>}
                      </span>
                      <span className="tabular-nums">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Llamada final */}
      <section className="border-t border-lino">
        <div className={cn(CONTENEDOR_WEB, SECCION_WEB, "text-center")}>
          <Reveal className="flex flex-col items-center">
            <h2 className="text-[26px] font-extrabold tracking-tight md:text-[32px]">¿Te guardamos un hueco?</h2>
            <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
              {soloUno
                ? "Elige servicio y hora en menos de un minuto."
                : `Elige servicio, ${professionalWord(tipo)} y hora en menos de un minuto.`}
            </p>
            <Button asChild size="lg" className="mt-7 h-12 rounded-full px-8 text-[15px] font-semibold">
              <Link to="/s/$salonSlug/book" params={{ salonSlug }} search={(prev) => prev} className="gap-2">
                Reservar cita <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      <MobileBookingBar salonSlug={salonSlug} />
    </>
  );
}
