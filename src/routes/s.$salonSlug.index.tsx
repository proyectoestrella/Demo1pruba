import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Instagram, MapPin, Phone, Scissors, Star } from "lucide-react";
import { services, serviceMap, employees, salon, requiresDeposit } from "@/lib/mock/salon";
import { useSalonStore } from "@/lib/store";
import heroImg from "@/assets/hero-salon.jpg";
import { StylistAvatar } from "@/components/StylistAvatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { SERVICE_ES, CATEGORY_LABELS, CATEGORY_ORDER, EMPLOYEE_ES, eur } from "@/lib/copy";

export const Route = createFileRoute("/s/$salonSlug/")({
  component: SalonHome,
});

const SALON_ABOUT_ES =
  "Barbería de toda la vida en el corazón de la ciudad. Tres profesionales, una misma obsesión: que salgas de aquí sintiéndote como nuevo.";

const FEATURED_IDS = ["haircut", "color", "highlights", "keratin"];

const REVIEWS = [
  { name: "Marta R.", rating: 5, quote: "Salgo distinta cada vez. Inés entiende exactamente lo que le pido." },
  { name: "Carlos M.", rating: 5, quote: "El mejor arreglo de barba de Madrid, sin discusión." },
  { name: "Elena G.", rating: 5, quote: "Ambiente cuidado y muy puntuales con la hora de la cita." },
];
const AGGREGATE_RATING = 4.8;
const REVIEW_COUNT = 312;

const WEEK_DAYS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function todayOpenInfo(hours: typeof salon.hours) {
  const dow = new Date().getDay();
  const entry =
    dow === 0 ? hours.find((h) => h.day === "Sunday") : dow === 6 ? hours.find((h) => h.day === "Saturday") : hours.find((h) => h.day === "Mon–Fri");
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

function fullWeekSchedule(hours: typeof salon.hours) {
  const weekday = hours.find((h) => h.day === "Mon–Fri")?.value ?? "—";
  const sat = hours.find((h) => h.day === "Saturday")?.value ?? "—";
  const sun = hours.find((h) => h.day === "Sunday")?.value ?? "—";
  return WEEK_DAYS_ES.map((label, i) => ({
    label,
    value: i < 5 ? weekday : i === 5 ? sat : sun === "Closed" ? "Cerrado" : sun,
  }));
}

function SalonHome() {
  const { salonSlug } = Route.useParams();
  const profile = useSalonStore((s) => s.salonProfile);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-2 md:items-center md:py-20">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Star className="h-4 w-4 fill-primary text-primary" /> {AGGREGATE_RATING}
              </span>
              <span className="text-muted-foreground">· {REVIEW_COUNT} reseñas</span>
            </div>
            <h1 className="font-display text-5xl leading-[1.05] md:text-6xl">{profile.name}</h1>
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-primary" /> {profile.address}
            </p>
            <p className="max-w-md text-lg text-muted-foreground">{SALON_ABOUT_ES}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/s/$salonSlug/book"
                params={{ salonSlug }}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Reservar <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#servicios"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium hover:bg-accent"
              >
                Ver servicios
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden rounded-3xl border border-border shadow-2xl">
              <img src={heroImg} alt={`Interior de ${profile.name}`} className="h-full w-full object-cover" width={1920} height={1280} />
            </div>
          </div>
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
          <span className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0 text-primary" /> {profile.phone}
          </span>
        </div>
      </section>

      {/* Servicios destacados */}
      <section id="servicios" className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-primary">Más reservados</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">Servicios destacados</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_IDS.map((id) => {
            const s = serviceMap[id];
            if (!s) return null;
            const label = SERVICE_ES[id] ?? { name: s.name, description: s.description };
            return (
              <Link
                key={id}
                to="/s/$salonSlug/book"
                params={{ salonSlug }}
                search={{ service: id }}
                className="group flex flex-col rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40 hover:bg-muted/20"
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
            );
          })}
        </div>
      </section>

      {/* Catálogo completo */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.25em] text-primary">El menú completo</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">Todos los servicios</h2>
          </div>
          <Accordion type="single" collapsible defaultValue={CATEGORY_ORDER[0]} className="divide-y divide-border/40">
            {CATEGORY_ORDER.map((cat) => {
              const items = services.filter((s) => s.active !== false && (CATEGORY_LABELS[s.id] ?? "Otros") === cat);
              if (!items.length) return null;
              return (
                <AccordionItem key={cat} value={cat} className="border-b-0">
                  <AccordionTrigger className="py-4 text-base font-display font-medium hover:no-underline">{cat}</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pb-2">
                      {items.map((s) => {
                        const label = SERVICE_ES[s.id] ?? { name: s.name, description: s.description };
                        return (
                          <Link
                            key={s.id}
                            to="/s/$salonSlug/book"
                            params={{ salonSlug }}
                            search={{ service: s.id }}
                            className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-muted/30"
                          >
                            <div className="min-w-0">
                              <p className="font-medium">{label.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {s.durationMin} min{requiresDeposit(s.durationMin) ? " · requiere depósito" : ""}
                              </p>
                            </div>
                            <span className="shrink-0 font-display text-lg">{eur(s.priceEur)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </section>

      {/* Equipo */}
      <section id="equipo" className="border-t border-border/40 bg-card">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-primary">Equipo</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">El equipo</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {employees.map((e) => (
              <div key={e.id} className="flex flex-col items-center rounded-2xl border border-border/60 bg-background p-8 text-center">
                <StylistAvatar name={e.name} employeeId={e.id} size="lg" />
                <h3 className="mt-5 font-display text-xl">{e.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{EMPLOYEE_ES[e.id]?.specialty ?? e.specialty}</p>
                <p className="mt-4 text-xs uppercase tracking-widest text-primary">{e.yearsExperience} años de experiencia</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reseñas */}
      <section id="resenas" className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary">Reseñas</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">Lo que dicen nuestros clientes</h2>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-primary text-primary" />
            <span className="font-medium">{AGGREGATE_RATING}</span>
            <span className="text-muted-foreground">· {REVIEW_COUNT} reseñas</span>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <div key={r.name} className="rounded-2xl border border-border/60 bg-card p-6">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn("h-3.5 w-3.5", i < r.rating ? "fill-primary text-primary" : "text-muted-foreground/30")} />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground">&ldquo;{r.quote}&rdquo;</p>
              <p className="mt-4 text-xs font-medium text-muted-foreground">{r.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ubicación + horario */}
      <section id="ubicacion" className="border-t border-border/40 bg-card">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-primary">Ubicación y horario</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">Te esperamos aquí</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background p-6">
              <p className="flex items-start gap-3 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {profile.address}</p>
              <p className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 shrink-0 text-primary" /> {profile.phone}</p>
              <p className="flex items-center gap-3 text-sm"><Instagram className="h-4 w-4 shrink-0 text-primary" /> {profile.instagram}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background p-6">
              <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Horario</p>
              <div className="divide-y divide-border/40">
                {fullWeekSchedule(salon.hours).map((d) => (
                  <div key={d.label} className="flex justify-between py-2 text-sm">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-5xl px-6 py-16 text-center md:py-24">
        <h2 className="font-display text-3xl md:text-4xl">¿Nos vemos pronto?</h2>
        <p className="mt-3 text-muted-foreground">Elige servicio, estilista y hora en menos de un minuto.</p>
        <Link
          to="/s/$salonSlug/book"
          params={{ salonSlug }}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reservar ahora <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
