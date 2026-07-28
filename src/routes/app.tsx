import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  Sparkles,
  Megaphone,
  Clock,
  Settings,
  ListChecks,
  ArrowUpRight,
  Menu,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { salon } from "@/lib/mock/salon";
import { useSalonStore } from "@/lib/store";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: `Dashboard · ${useSalonStore.getState().salonProfile.name}` }],
  }),
  component: DashboardLayout,
});

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/app", label: "Inicio", icon: LayoutDashboard, exact: true },
  { to: "/app/calendar", label: "Calendario", icon: Calendar },
  { to: "/app/appointments", label: "Citas", icon: ListChecks },
  { to: "/app/clients", label: "Clientes", icon: Users },
  { to: "/app/employees", label: "Equipo", icon: Users },
  { to: "/app/services", label: "Servicios", icon: Scissors },
  { to: "/app/insights", label: "Analítica IA", icon: Sparkles },
  { to: "/app/marketing", label: "Marketing", icon: Megaphone },
  { to: "/app/waitlist", label: "Lista de espera", icon: Clock },
  { to: "/app/settings", label: "Ajustes", icon: Settings },
];

function SidebarNav({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-2">
      {nav.map((item) => {
        const active = item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            {active && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />}
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  const name = useSalonStore((s) => s.salonProfile.name);
  return (
    <div className="flex items-center gap-2 px-6 py-6">
      <div className="h-8 w-8 rounded-full bg-primary" />
      <div className="leading-tight">
        <p className="font-display text-base">{name}</p>
        <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Salon OS</p>
      </div>
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-sidebar-border p-4">
      <Link
        to="/s/$salonSlug"
        params={{ salonSlug: salon.slug }}
        className="flex items-center justify-between rounded-lg bg-sidebar-accent/50 px-3 py-2 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent"
      >
        Ver sitio público <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function DashboardLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newApptOpen, setNewApptOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [path]);

  const activeItem = nav.find((item) => (item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/")));

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar — fixed, never scrolls with content */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarBrand />
        <SidebarNav path={path} />
        <SidebarFooter />
      </aside>

      {/* Mobile sidebar — Sheet overlay, doesn't occupy layout space */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="flex w-72 flex-col border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <SidebarBrand />
          <SidebarNav path={path} onNavigate={() => setMobileNavOpen(false)} />
          <SidebarFooter />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <p className="truncate text-sm font-medium text-foreground sm:hidden">{activeItem?.label ?? "Panel"}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {new Date().toLocaleDateString("es", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden md:block">
              <ViewSwitcher mode="dashboard" />
            </div>
            <Button size="sm" onClick={() => setNewApptOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva cita</span>
            </Button>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              M
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <NewAppointmentDialog open={newApptOpen} onOpenChange={setNewApptOpen} />
    </div>
  );
}
