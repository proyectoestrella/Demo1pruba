import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { salon } from "@/lib/mock/salon";
import { useSalonStore } from "@/lib/store";
import { Instagram, MapPin, Phone, Lock, Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export const Route = createFileRoute("/s/$salonSlug")({
  head: () => {
    const name = useSalonStore.getState().salonProfile.name;
    return {
      meta: [
        { title: `${name} — Reserva online` },
        { name: "description", content: `Reserva tu cita en ${name} en segundos.` },
        { property: "og:title", content: name },
        { property: "og:description", content: `Reserva tu cita en ${name} en segundos.` },
      ],
    };
  },
  component: SalonLayout,
});

const DAY_LABEL_ES: Record<string, string> = {
  "Mon–Fri": "Lunes a viernes",
  Saturday: "Sábado",
  Sunday: "Domingo",
};

const SALON_ABOUT_ES =
  "Barbería de toda la vida en el corazón de la ciudad. Tres profesionales, una misma obsesión: que salgas de aquí sintiéndote como nuevo.";

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
  const profile = useSalonStore((s) => s.salonProfile);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
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
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Barbería
                </p>
              </div>
            </Link>
            <Link
              to="/login"
              className="ml-2 hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted sm:inline-flex"
            >
              <Lock className="h-3 w-3" />
              Acceso barbero
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
                    <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
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
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">{SALON_ABOUT_ES}</p>
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
            {salon.hours.map((h) => (
              <p key={h.day} className="mt-2 flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{DAY_LABEL_ES[h.day] ?? h.day}</span>
                <span>{h.value === "Closed" ? "Cerrado" : h.value}</span>
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
