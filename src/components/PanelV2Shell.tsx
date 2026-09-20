import { useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Users,
  MoreHorizontal,
  Home,
  Scissors,
  ChartColumn,
  Megaphone,
  Clock,
  Settings,
  Globe,
  ArrowUpRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { salon } from "@/lib/mock/salon";
import { useSalonStore } from "@/lib/store";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Cromo v2 del panel: barra inferior de 4 iconos en móvil, sidebar estrecha
 * a partir de tablet (patrón Squire/Treatwell Pro — ver el informe de
 * referencias). Envuelve TODAS las rutas `/app/*`; el contenido de cada
 * pantalla (Hoy, Agenda, Clientes…) decide su propia acción principal, así
 * que este cromo no añade más botones que el cambio de tema y el asistente.
 *
 * Solo se monta cuando `panelV2` está activo (ver routes/app.tsx) — el
 * `DashboardLayout` de siempre no se toca.
 *
 * El corte está en `lg` (1024 px) y no en `xl` (1280) a propósito: un iPad en
 * vertical mide exactamente 1024 y es donde más se usa este panel. Con el
 * corte en `xl`, ese mismo iPad enseñaba barra inferior en v2 y barra lateral
 * en v1, así que el layout parecía depender de por dónde habías entrado
 * (salón real con `?s=` o demo con `?d=`) en vez de del ancho de la pantalla.
 * Ahora los dos cromos cambian en el mismo punto: solo manda el ancho.
 */

/**
 * Alto real de la barra inferior fija, con el hueco del gesto de iOS dentro.
 * El valor vive en `--alto-barra-fija` (styles.css) para que la barra y el
 * hueco que le reserva el contenido no puedan desincronizarse: la clase
 * `hueco-barra-fija` usa esa misma variable. Es lo que impide que el último
 * botón de cualquier pantalla (el "Guardar cambios" de Ajustes fue el que lo
 * destapó) acabe debajo de la barra.
 */
const ALTO_BARRA_INFERIOR = "var(--alto-barra-fija)";

type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };

const MAIN_ITEMS: NavItem[] = [
  { to: "/app", label: "Hoy", icon: Home, exact: true },
  { to: "/app/calendar", label: "Agenda", icon: CalendarDays },
  { to: "/app/clients", label: "Clientes", icon: Users },
];

const MORE_ITEMS: NavItem[] = [
  { to: "/app/web", label: "Mi web", icon: Globe },
  { to: "/app/waitlist", label: "Lista de espera", icon: Clock },
  { to: "/app/services", label: "Servicios", icon: Scissors },
  { to: "/app/employees", label: "Equipo", icon: Users },
  { to: "/app/insights", label: "Analítica", icon: ChartColumn },
  { to: "/app/marketing", label: "Marketing", icon: Megaphone },
  { to: "/app/settings", label: "Ajustes", icon: Settings },
];

const ALL_SIDEBAR_ITEMS = [...MAIN_ITEMS, ...MORE_ITEMS];

/**
 * Pantallas que no están en el menú pero sí tienen nombre propio. Sin esto la
 * barra de arriba ponía "Panel" en Citas mientras el título de la página
 * ponía "Citas": dos nombres para la misma pantalla.
 */
const TITULOS_EXTRA: Record<string, string> = {
  "/app/appointments": "Citas",
  "/app/demos": "Demos",
};

function isActive(to: string, path: string, exact?: boolean) {
  return exact ? path === to : path === to || path.startsWith(to + "/");
}

export function PanelV2Shell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const [moreOpen, setMoreOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const activeMain = MAIN_ITEMS.find((i) => isActive(i.to, path, i.exact));
  const activeMore = MORE_ITEMS.find((i) => isActive(i.to, path));
  const title = activeMain?.label ?? activeMore?.label ?? TITULOS_EXTRA[path] ?? "Panel";

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar estrecha — de iPad (≥1024px) para arriba. */}
      <aside className="hidden w-20 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground lg:flex">
        <Link to="/app" className="mb-6 flex items-center justify-center" title={salonName}>
          <Logo />
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-1">
          {ALL_SIDEBAR_ITEMS.map((item) => {
            const active = isActive(item.to, path, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex w-16 flex-col items-center gap-1 rounded-lg py-2.5 text-center transition-colors",
                  active
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[9px] leading-tight font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <Link
          to="/s/$salonSlug"
          params={{ salonSlug: salon.slug }}
          className="mt-3 flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-center text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          title="Ver sitio público"
        >
          <ArrowUpRight className="h-4 w-4" />
          <span className="text-[9px] leading-tight">Web</span>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="truncate font-display text-lg">{title}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{salonName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setAssistantOpen(true)}
              aria-label="Asistente del salón"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </header>

        {/* El hueco de abajo es el alto de la barra fija más un respiro
            (`hueco-barra-fija`, una sola variable compartida con la barra).
            A partir de 1024 px la barra desaparece y la propia clase se
            queda en un margen normal. Vale
            para TODAS las pantallas del panel, no solo Ajustes: cualquiera
            puede acabar con un botón en la última línea. */}
        <main className="hueco-barra-fija min-w-0 flex-1 px-4 py-5 sm:px-6">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior — solo móvil y tablet pequeña (<1024px). */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur lg:hidden"
        style={{ minHeight: ALTO_BARRA_INFERIOR }}
      >
        {MAIN_ITEMS.map((item) => {
          const active = isActive(item.to, path, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                activeMore ? "text-primary" : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              Más
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Más</SheetTitle>
              <SheetDescription className="sr-only">Resto de secciones del panel</SheetDescription>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-2 px-4 pb-6">
              {MORE_ITEMS.map((item) => {
                const active = isActive(item.to, path);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                to="/s/$salonSlug"
                params={{ salonSlug: salon.slug }}
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center gap-2 rounded-xl border border-border/60 px-3 py-4 text-center text-xs font-medium text-muted-foreground hover:bg-muted/50"
              >
                <ArrowUpRight className="h-5 w-5" />
                Ver sitio público
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </nav>

      <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/60 px-4 py-4 text-left">
            <SheetTitle className="font-display text-lg">Asistente del salón</SheetTitle>
            <SheetDescription>
              Consulta tus datos en lenguaje natural. Calcula sobre tus reservas reales: no es un
              modelo de lenguaje y no inventa cifras.
            </SheetDescription>
          </SheetHeader>
          <AssistantPanel className="flex-1" />
        </SheetContent>
      </Sheet>
    </div>
  );
}
