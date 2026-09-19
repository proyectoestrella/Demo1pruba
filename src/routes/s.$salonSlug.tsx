import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { useRealSalon, useRealSalonSlug } from "@/lib/use-real-salon";
import { useDisplayProfile } from "@/lib/use-display-profile";
import { DEMO_PARAM, blankDemoProfile, decodeDemoProfile } from "@/lib/demo-profile";
import { weekSchedule } from "@/lib/opening-hours";
import { useBusinessType } from "@/lib/use-display-profile";
import { BUSINESS_LABEL, inferBusinessType, professionalWord } from "@/lib/business-type";
import { Instagram, MapPin, Phone, Lock, Menu, TriangleAlert } from "lucide-react";
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
    //
    // Un salón REAL (URL corta, sin `?d=`) no trae el nombre en el enlace: el
    // servidor no puede saberlo sin llamar a Supabase desde aquí. Antes se
    // caía al perfil de ejemplo guardado en este proceso ("Barbería Pepe"),
    // que es justo el salón equivocado que vio Adam en la auditoría de UX. Un
    // título neutro es honesto sobre lo que se sabe en este punto; el
    // `useEffect` de más abajo lo corrige en cuanto llega el dato real.
    const raw = (match.search as Record<string, unknown> | undefined)?.[DEMO_PARAM];
    const fromUrl = decodeDemoProfile(typeof raw === "string" ? raw : undefined);
    const name = fromUrl?.name?.trim();
    const description = name
      ? `${BUSINESS_LABEL[inferBusinessType(fromUrl?.tagline, fromUrl?.name)]} · Reserva tu cita en ${name} en segundos, sin llamar.`
      : "Reserva tu cita en segundos, sin llamar.";
    const title = name ? `${name} — Reserva online` : "Reserva online";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: name ?? title },
        { property: "og:description", content: description },
        { name: "twitter:title", content: name ?? title },
        { name: "twitter:description", content: description },
      ],
    };
  },
  component: SalonLayout,
});

/** Prefijo de la clave de sessionStorage que guarda el `?d=` de la demo activa, por slug. */
const DEMO_SESSION_PREFIX = "trimly-demo-link:";

function demoSessionKey(salonSlug: string): string {
  return `${DEMO_SESSION_PREFIX}${salonSlug}`;
}

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
  const demoRawParam = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.[DEMO_PARAM],
  });
  const demoRawFromUrl = typeof demoRawParam === "string" ? demoRawParam : undefined;
  // El rediseño v2 de la web pública se activa por enlace (`&v=2`), no se
  // guarda: quien abre el mismo enlace sin el parámetro ve la web de siempre.
  // El parser de búsqueda de TanStack Router convierte "2" en el NÚMERO 2, no
  // en la cadena "2" — de ahí el `String(...)` antes de comparar.
  const publicV2 = useRouterState({
    select: (s) => String((s.location.search as Record<string, unknown>)?.v) === "2",
  });
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const applyBusinessType = useSalonStore((s) => s.applyBusinessType);
  const markDemoActive = useSalonStore((s) => s.markDemoActive);
  const tipo = useBusinessType();

  // Auditoría de UX, hallazgo C2: los `Link` del flujo de reserva no
  // propagan el `?d=` (TanStack Router no conserva el `search` si no se le
  // pide explícitamente) y, en un salón real, nunca lo hay. Al perderse, una
  // recarga a mitad del flujo volvía a mostrar lo que hubiera guardado en
  // este navegador de una demo ANTERIOR — el "Barbería Pepe" o el salón
  // cruzado de la auditoría — en vez del salón con el que se empezó.
  //
  // La demo entera vive en el enlace a propósito (ver demo-profile.ts), así
  // que aquí no se guarda el PERFIL, solo la cadena `d=` ya vista de este
  // salón, en sessionStorage (se olvida al cerrar la pestaña, no viaja a
  // otro dispositivo): sirve para sobrevivir a una navegación interna o una
  // recarga dentro de la MISMA visita, no para compartir el enlace roto.
  const [demoRawFromSession, setDemoRawFromSession] = useState<string | undefined>(undefined);
  const [sessionChecked, setSessionChecked] = useState(false);
  useEffect(() => {
    setSessionChecked(false);
    if (typeof window === "undefined") return;
    const key = demoSessionKey(salonSlug);
    try {
      if (demoRawFromUrl) {
        window.sessionStorage.setItem(key, demoRawFromUrl);
        setDemoRawFromSession(demoRawFromUrl);
      } else {
        setDemoRawFromSession(window.sessionStorage.getItem(key) ?? undefined);
      }
    } catch {
      // Modo privado o sessionStorage bloqueado: nos quedamos solo con lo
      // que traiga la URL, como antes de este arreglo.
      setDemoRawFromSession(undefined);
    }
    setSessionChecked(true);
  }, [demoRawFromUrl, salonSlug]);
  // `||`, no `??`: un `?d=` vacío en la URL (nunca lo genera la app, pero un
  // enlace puede llegar recortado así) debe tratarse igual que "ausente" y
  // caer también a sessionStorage, no quedarse con la cadena vacía.
  const demoRaw = demoRawFromUrl || demoRawFromSession;

  // Abrir el enlace de una demo la convierte en el salón activo de este
  // navegador. La personalización viaja en el enlace, pero el acceso barbero,
  // el panel y la vuelta a la web no lo llevan: sin esto, en cuanto se pulsaba
  // "Acceso barbero" todo volvía a ser el salón de ejemplo delante del cliente.
  //
  // Junto al perfil se aplica también el tipo de negocio: equipo, catálogo,
  // clientes y citas de ejemplo pasan a hablar el idioma de esta demo (ver
  // `applyBusinessType` en lib/store.ts) en vez de quedarse en barbería.
  const fromUrl = decodeDemoProfile(demoRaw);
  useEffect(() => {
    if (!fromUrl) return;
    // Si este slug ya se ha resuelto como salón REAL, su perfil manda sobre el
    // del enlace: aplicar aquí el `?d=` lo pisaría y — peor — se lo escribiría
    // encima en Supabase. El enlace de demo de Adam sigue abriendo, pero
    // enseñando su salón de verdad. Ver `useRealSalon`.
    if (useSalonStore.getState().realSalonSlug === salonSlug) return;
    updateSalonProfile({ ...blankDemoProfile(), ...fromUrl });
    applyBusinessType(inferBusinessType(fromUrl.tagline, fromUrl.name), {
      team: fromUrl.team,
      menu: fromUrl.menu,
      noShowFeeEur: fromUrl.noShowFeeEur,
      smartSpread: fromUrl.smartSpread,
    });
    markDemoActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoRaw, salonSlug, updateSalonProfile, applyBusinessType, markDemoActive]);

  // ¿Es este slug un salón real (una fila en `salons`) o una demo de venta?
  // Si es real, su perfil y su agenda vienen de Supabase y pisan el `?d=`; si
  // no, esto no hace nada más y la página se comporta igual que siempre.
  useRealSalon(salonSlug, "publica");
  const realSlug = useRealSalonSlug();

  // Auditoría C2, segunda mitad: ni el enlace ni sessionStorage traen una
  // demo, Y este slug tampoco se ha resuelto como salón real. En vez de
  // seguir enseñando lo último que hubiera en el navegador (que puede ser
  // OTRO salón — el bug original), se avisa con un mensaje claro.
  //
  // `useRealSalon` es fire-and-forget y no expone si sigue comprobando
  // Supabase, así que se da un margen prudencial antes de concluir "no
  // identificado" — evita el falso positivo de un salón real que tarda un
  // instante en resolver. Es una espera deliberadamente generosa: mejor un
  // parpadeo de más que un aviso de menos sobre el salón equivocado.
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    setGraceOver(false);
    const t = setTimeout(() => setGraceOver(true), 1500);
    return () => clearTimeout(t);
  }, [salonSlug]);
  const salonUnresolved =
    sessionChecked && graceOver && !fromUrl && realSlug !== salonSlug;

  useEffect(() => {
    document.title = salonUnresolved ? "Salón no encontrado" : `${profile.name} — Reserva online`;
  }, [profile.name, salonUnresolved]);

  // El dosier comercial imprimible (`/dosier`) es una página A4 propia, no
  // una vista más de la web pública: nada de cabecera ni pie de la web, ni en
  // pantalla ni al imprimir. Los hooks de arriba siguen ejecutándose igual
  // (el perfil de la demo se aplica al store), solo cambia lo que se pinta.
  const onDosier = path.includes("/dosier");
  if (onDosier) {
    return <Outlet />;
  }

  if (salonUnresolved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <TriangleAlert className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="font-display text-2xl">No hemos podido identificar este salón</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          El enlace parece incompleto o ha caducado. Pide al salón que te lo vuelva a mandar, o
          vuelve a la conversación desde la que llegaste.
        </p>
      </div>
    );
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
              <Logo label={profile.name} />
              <div className="min-w-0 leading-tight">
                {/* Nombres largos ("THE BEST SHAVE & BARBER") se partían feo
                    a una línea truncada; con dos líneas dejan de cortar
                    palabras por la mitad (auditoría de UX, hallazgo C5). */}
                <p className="line-clamp-2 font-display text-sm leading-tight sm:text-base">
                  {profile.name}
                </p>
                {profile.tagline ? (
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {profile.tagline}
                  </p>
                ) : null}
              </div>
            </Link>
            {/* v2: entra directo al panel, sin pasar por /login — es el botón que
                ayer no respondió en el iPad durante la demo. v1 sigue yendo a
                /login exactamente igual que siempre. */}
            {publicV2 ? (
              <a
                // El slug viaja al panel (`?s=`) para que un salón real pueda
                // entrar a SU agenda desde un móvil recién estrenado, sin nada
                // guardado. Para una demo de venta el parámetro no existe en
                // `salons` y el panel se comporta exactamente como siempre.
                href={`/app?v=2&acceso=demo&s=${encodeURIComponent(salonSlug)}`}
                className="ml-2 hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted sm:inline-flex"
              >
                <Lock className="h-3 w-3" />
                Acceso {professionalWord(tipo)}
              </a>
            ) : (
              <Link
                to="/login"
                className="ml-2 hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted sm:inline-flex"
              >
                <Lock className="h-3 w-3" />
                Acceso {professionalWord(tipo)}
              </Link>
            )}
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
            {/* 44px de zona táctil (auditoría de UX, hallazgo C9): el
                componente base mide 32px, de sobra en escritorio con ratón
                pero por debajo del mínimo recomendado en móvil. */}
            <ThemeToggle className="h-11 w-11" />
            {!onBooking && (
              <>
                {/* Menú móvil */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 lg:hidden"
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
              <Logo label={profile.name} />
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
