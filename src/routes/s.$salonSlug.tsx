import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { useDisplayProfile } from "@/lib/use-display-profile";
import { DEMO_PARAM, blankDemoProfile, decodeDemoProfile } from "@/lib/demo-profile";
import { weekSchedule } from "@/lib/opening-hours";
import { useBusinessType } from "@/lib/use-display-profile";
import { BUSINESS_LABEL, inferBusinessType, professionalWord } from "@/lib/business-type";
import { Instagram, MapPin, Phone, Lock, Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollProgress } from "@/components/magicui/scroll-progress";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/s/$salonSlug")({
  head: ({ match }) => {
    // El título y la vista previa del enlace (WhatsApp, iMessage) se generan en
    // el servidor, antes de que el navegador aplique la demo: hay que leer el
    // salón del propio enlace, o todas las demos se compartían como el salón de
    // ejemplo por defecto.
    const raw = (match.search as Record<string, unknown> | undefined)?.[DEMO_PARAM];
    const fromUrl = decodeDemoProfile(typeof raw === "string" ? raw : undefined);
    const name = fromUrl?.name?.trim() || useSalonStore.getState().salonProfile.name;
    const tipo = BUSINESS_LABEL[inferBusinessType(fromUrl?.tagline, fromUrl?.name)];
    const description = fromUrl
      ? `${tipo} · Reserva tu cita en ${name} en segundos, sin llamar.`
      : `Reserva tu cita en ${name} en segundos.`;
    return {
      meta: [
        { title: `${name} — Reserva online` },
        { name: "description", content: description },
        { property: "og:title", content: name },
        { property: "og:description", content: description },
        { name: "twitter:title", content: name },
        { name: "twitter:description", content: description },
      ],
    };
  },
  component: SalonLayout,
});

/** Anclas de la home pública. Una sola fuente para el menú de escritorio y el de móvil. */
const NAV_LINKS = [
  { href: "#servicios", label: "Servicios" },
  { href: "#galeria", label: "Galería" },
  { href: "#equipo", label: "Equipo" },
  { href: "#resenas", label: "Reseñas" },
  { href: "#faq", label: "FAQ" },
  { href: "#ubicacion", label: "Cómo llegar" },
];

function SalonLayout() {
  const { salonSlug } = Route.useParams();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onBooking =
    path.includes("/book") || path.includes("/confirmation") || path.includes("/waitlist");
  const profile = useDisplayProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const demoRaw = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.[DEMO_PARAM],
  });
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const applyBusinessType = useSalonStore((s) => s.applyBusinessType);
  const tipo = useBusinessType();

  // Abrir el enlace de una demo la convierte en el salón activo de este
  // navegador. La personalización viaja en el enlace, pero el acceso barbero,
  // el panel y la vuelta a la web no lo llevan: sin esto, en cuanto se pulsaba
  // "Acceso barbero" todo volvía a ser el salón de ejemplo delante del cliente.
  //
  // Junto al perfil se aplica también el tipo de negocio: equipo, catálogo,
  // clientes y citas de ejemplo pasan a hablar el idioma de esta demo (ver
  // `applyBusinessType` en lib/store.ts) en vez de quedarse en barbería.
  useEffect(() => {
    const fromUrl = decodeDemoProfile(typeof demoRaw === "string" ? demoRaw : undefined);
    if (!fromUrl) return;
    updateSalonProfile({ ...blankDemoProfile(), ...fromUrl });
    applyBusinessType(inferBusinessType(fromUrl.tagline, fromUrl.name));
  }, [demoRaw, updateSalonProfile, applyBusinessType]);

  useEffect(() => {
    document.title = `${profile.name} — Reserva online`;
  }, [profile.name]);

  // El dosier comercial imprimible (`/dosier`) es una página A4 propia, no
  // una vista más de la web pública: nada de cabecera ni pie de la web, ni en
  // pantalla ni al imprimir. Los hooks de arriba siguen ejecutándose igual
  // (el perfil de la demo se aplica al store), solo cambia lo que se pinta.
  const onDosier = path.includes("/dosier");
  if (onDosier) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        {/* Barra de avance de lectura, pegada al borde inferior de la cabecera. */}
        <ScrollProgress className="absolute inset-x-0 bottom-0 top-auto h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/s/$salonSlug"
              params={{ salonSlug }}
              className="flex min-w-0 items-center gap-2"
            >
              <Logo />
              <div className="min-w-0 leading-tight">
                <p className="truncate font-display text-base">{profile.name}</p>
                {profile.tagline ? (
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {profile.tagline}
                  </p>
                ) : null}
              </div>
            </Link>
            <Link
              to="/login"
              className="ml-2 hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted sm:inline-flex"
            >
              <Lock className="h-3 w-3" />
              Acceso {professionalWord(tipo)}
            </Link>
          </div>
          {!onBooking && (
            <nav className="hidden items-center gap-6 text-sm lg:flex">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="relative text-muted-foreground transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-primary after:transition-all hover:text-foreground hover:after:w-full motion-reduce:after:transition-none"
                >
                  {l.label}
                </a>
              ))}
            </nav>
          )}
          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle />
            {!onBooking && (
              <>
                {/* Menú móvil */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      aria-label="Abrir menú"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[280px]">
                    <SheetTitle className="sr-only">Menú</SheetTitle>
                    <nav className="flex flex-col gap-1 pt-8">
                      {NAV_LINKS.map((l) => (
                        <a
                          key={l.href}
                          href={l.href}
                          className="rounded-lg px-3 py-2.5 text-base text-foreground transition-colors hover:bg-muted hover:text-primary"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {l.label}
                        </a>
                      ))}
                    </nav>
                  </SheetContent>
                </Sheet>

                <Button asChild size="sm" className="shrink-0 rounded-full px-4">
                  <Link to="/s/$salonSlug/book" params={{ salonSlug }}>
                    Reservar
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mt-24 border-t border-border/60 bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <Logo />
              <span className="font-display text-lg">{profile.name}</span>
            </div>
            {profile.about ? (
              <p className="mt-4 max-w-sm text-sm text-muted-foreground">{profile.about}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Visítanos</p>
            <p className="mt-3 flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {profile.address}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 shrink-0 text-primary" />
              {profile.phone}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm">
              <Instagram className="h-4 w-4 shrink-0 text-primary" />
              {profile.instagram}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Horario</p>
            {weekSchedule(profile.openingHours).map((d) => (
              <p key={d.label} className="mt-2 flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{d.label}</span>
                <span>{d.value}</span>
              </p>
            ))}
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
            <p>© {profile.name}</p>
            <p>Privacidad · Términos · Política de cancelación</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
