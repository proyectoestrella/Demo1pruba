import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  ChartColumn,
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
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: `Dashboard · ${useSalonStore.getState().salonProfile.name}` }],
  }),
  component: DashboardLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

/** Nav grouped into logical clusters, each with its own faint uppercase heading. */
const navGroups: { label: string; items: NavItem[] }[] = [
  { label: "General", items: [{ to: "/app", label: "Inicio", icon: LayoutDashboard, exact: true }] },
  {
    label: "Agenda",
    items: [
      { to: "/app/calendar", label: "Calendario", icon: Calendar },
      { to: "/app/appointments", label: "Citas", icon: ListChecks },
      { to: "/app/waitlist", label: "Lista de espera", icon: Clock },
    ],
  },
  {
    label: "Negocio",
    items: [
      { to: "/app/clients", label: "Clientes", icon: Users },
      { to: "/app/employees", label: "Equipo", icon: Users },
      { to: "/app/services", label: "Servicios", icon: Scissors },
    ],
  },
  {
    label: "Crecimiento",
    items: [
      { to: "/app/insights", label: "Analítica", icon: ChartColumn },
      { to: "/app/marketing", label: "Marketing", icon: Megaphone },
    ],
  },
];

const settingsItem: NavItem = { to: "/app/settings", label: "Ajustes", icon: Settings };
/** Flat list of every nav item, for matching the active route regardless of grouping. */
const allNavItems: NavItem[] = [...navGroups.flatMap((g) => g.items), settingsItem];

function isActive(item: NavItem, path: string) {
  return item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/");
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-primary font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />}
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function SidebarNav({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col space-y-4 overflow-y-auto px-3 py-3">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/35">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink key={item.to} item={item} active={isActive(item, path)} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-auto border-t border-sidebar-border pt-3">
        <NavLink item={settingsItem} active={isActive(settingsItem, path)} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}

function SidebarBrand() {
  const name = useSalonStore((s) => s.salonProfile.name);
  return (
    <div className="flex items-center gap-2 border-b border-sidebar-border px-6 py-5">
      <Logo />
      <div className="min-w-0 leading-tight">
        <p className="truncate font-display text-base">{name}</p>
        <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Panel de gestión</p>
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
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const salonInitial = salonName.trim().charAt(0).toUpperCase() || "?";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newApptOpen, setNewApptOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [path]);

  const activeItem = allNavItems.find((item) => isActive(item, path));

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
            <ThemeToggle />
            <Button size="sm" onClick={() => setNewApptOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva cita</span>
            </Button>
            <div className="ml-1 flex items-center border-l border-border pl-2 sm:pl-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground ring-2 ring-border"
                title={salonName}
              >
                {salonInitial}
              </div>
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
