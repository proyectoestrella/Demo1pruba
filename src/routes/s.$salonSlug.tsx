import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { salon } from "@/lib/mock/salon";
import { useSalonStore } from "@/lib/store";
import { Instagram, MapPin, Phone, Lock } from "lucide-react";

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
  "Un atelier de peluquería moderno en el corazón de la ciudad. Tres artistas, una misma obsesión: que salgas siendo inconfundiblemente tú.";

function SalonLayout() {
  const { salonSlug } = Route.useParams();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onBooking = path.includes("/book") || path.includes("/confirmation") || path.includes("/waitlist");
  const profile = useSalonStore((s) => s.salonProfile);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/s/$salonSlug" params={{ salonSlug }} className="flex min-w-0 items-center gap-2">
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 leading-tight">
                <p className="truncate font-display text-base">{profile.name}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Atelier de peluquería</p>
              </div>
            </Link>
            <Link
              to="/login"
              className="ml-2 hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted sm:inline-flex"
            >
              <Lock className="h-3 w-3" />
              Acceso peluquero
            </Link>
          </div>
          {!onBooking && (
            <nav className="hidden items-center gap-7 text-sm md:flex">
              <a href="#servicios" className="text-muted-foreground hover:text-foreground">Servicios</a>
              <a href="#equipo" className="text-muted-foreground hover:text-foreground">Equipo</a>
              <a href="#resenas" className="text-muted-foreground hover:text-foreground">Reseñas</a>
              <a href="#ubicacion" className="text-muted-foreground hover:text-foreground">Cómo llegar</a>
            </nav>
          )}
          {!onBooking && (
            <Link
              to="/s/$salonSlug/book"
              params={{ salonSlug }}
              className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Reservar
            </Link>
          )}
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mt-24 border-t border-border/60 bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary" />
              <span className="font-display text-lg">{profile.name}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">{SALON_ABOUT_ES}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Visítanos</p>
            <p className="mt-3 flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{profile.address}</p>
            <p className="mt-2 flex items-center gap-2 text-sm"><Phone className="h-4 w-4 shrink-0 text-primary" />{profile.phone}</p>
            <p className="mt-2 flex items-center gap-2 text-sm"><Instagram className="h-4 w-4 shrink-0 text-primary" />{profile.instagram}</p>
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
