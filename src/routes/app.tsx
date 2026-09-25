import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
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
  Compass,
  Globe,
  Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelPublicLink } from "@/lib/panel-public-link";
import { useSalonStore } from "@/lib/store";
import { useRealSalon } from "@/lib/use-real-salon";
import { usePanelRefresh } from "@/lib/use-panel-refresh";
import { useSyncPanelV2FromUrl, usePanelV2 } from "@/lib/use-panel-v2";
import {
  DEMO_PARAM,
  blankDemoProfile,
  decodeDemoProfile,
  moduloVisible,
  type ModuloOcultable,
} from "@/lib/demo-profile";
import { inferBusinessType } from "@/lib/business-type";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { PanelV2Shell } from "@/components/PanelV2Shell";
import { BuscadorGlobal } from "@/components/BuscadorGlobal";
import { GuardiaDelPanel } from "@/components/GuardiaDelPanel";
import { BotonCerrarSesion } from "@/components/BotonCerrarSesion";
import { accesoAlPanel } from "@/lib/api/salons.functions";
import { hasSeenTour, startTour } from "@/lib/tour";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/app")({
  /**
   * La puerta, antes de que el panel llegue a existir.
   *
   * Corta la navegación a `/app` cuando el salón es de pago y quien entra no
   * pertenece a él: no se monta ningún componente, así que no hay nada que
   * parpadee. Esto cubre el caso de moverse por la aplicación.
   *
   * En el servidor NO se comprueba —y es deliberado—: la sesión del dueño vive
   * en su navegador, no viaja en la petición del documento, así que aquí
   * dentro TODO el mundo parecería un desconocido y hasta el dueño acabaría en
   * la pantalla de acceso. De la carga directa de la URL se encarga
   * `GuardiaDelPanel`, que no pinta el panel hasta saberlo.
   *
   * Y por si las dos fallaran: ninguna de las dos es la que protege los datos.
   * Eso lo hace cada función de servidor por su cuenta.
   */
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const desdeUrl = (location.search as Record<string, unknown>)?.s;
    const slug =
      typeof desdeUrl === "string" && desdeUrl
        ? desdeUrl
        : useSalonStore.getState().salonProfile.slug;
    if (!slug) return;
    try {
      const { real, permitido, miembro } = await accesoAlPanel({ data: { slug } });
      if (real && !permitido) throw redirect({ to: "/login", replace: true });
      // Rol y nombre de quien entra (lote 8): para usePermisos() y el saludo.
      useSalonStore.getState().setMiembro(miembro ?? null);
    } catch (err) {
      // El `redirect` de TanStack se lanza como excepción: hay que dejarlo
      // pasar. Cualquier otro fallo se ignora y decide `GuardiaDelPanel`.
      if (err && typeof err === "object" && "isRedirect" in err) throw err;
      console.error("No se pudo comprobar el acceso al panel:", err);
    }
  },
  head: () => ({
    meta: [{ title: `Dashboard · ${useSalonStore.getState().salonProfile.name}` }],
    // Manifest propio del panel ("siShow · Panel", start_url /app?v=2) además
    // del de la web pública en __root.tsx, que se queda tal cual. Solo cambia
    // qué icono de "Añadir a pantalla de inicio" instala quien lo abre desde
    // aquí — no afecta a nada de /s/*.
    links: [{ rel: "manifest", href: "/manifest-panel.webmanifest" }],
  }),
  component: DashboardLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  /** Módulo que esta demo puede ocultar (ver `demo-profile.ts`). Ausente = siempre visible. */
  modulo?: ModuloOcultable;
};

/** Nav grouped into logical clusters, each with its own faint uppercase heading. */
const navGroups: { label: string; items: NavItem[] }[] = [
  { label: "General", items: [{ to: "/app", label: "Hoy", icon: LayoutDashboard, exact: true }, { to: "/app/hoja", label: "Hoja del día", icon: ListChecks }] },
  {
    label: "Agenda",
    items: [
      { to: "/app/calendar", label: "Calendario", icon: Calendar },
      { to: "/app/appointments", label: "Citas", icon: ListChecks },
      { to: "/app/waitlist", label: "Lista de espera", icon: Clock, modulo: "lista-espera" },
    ],
  },
  {
    label: "Negocio",
    items: [
      { to: "/app/clients", label: "Clientes", icon: Users },
      { to: "/app/employees", label: "Equipo", icon: Users, modulo: "equipo" },
      { to: "/app/services", label: "Servicios", icon: Scissors },
      { to: "/app/web", label: "Mi web", icon: Globe },
    ],
  },
  {
    label: "Crecimiento",
    items: [
      { to: "/app/insights", label: "Analítica", icon: ChartColumn },
      { to: "/app/marketing", label: "Marketing", icon: Megaphone, modulo: "marketing" },
    ],
  },
];

const settingsItem: NavItem = { to: "/app/settings", label: "Ajustes", icon: Settings };
/** Flat list of every nav item, for matching the active route regardless of grouping. */
const allNavItems: NavItem[] = [...navGroups.flatMap((g) => g.items), settingsItem];

function isActive(item: NavItem, path: string) {
  return item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/");
}

/** Grupos de navegación tras aplicar los módulos ocultos de esta demo, sin grupos vacíos. */
function useVisibleNavGroups() {
  const modulosOcultos = useSalonStore((s) => s.salonProfile.modulosOcultos);
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.modulo || moduloVisible({ modulosOcultos }, item.modulo),
      ),
    }))
    .filter((group) => group.items.length > 0);
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
  const visibleGroups = useVisibleNavGroups();
  return (
    <nav data-tour="nav" className="flex flex-1 flex-col space-y-4 overflow-y-auto px-3 py-3">
      {visibleGroups.map((group) => (
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
      <div className="mt-auto space-y-0.5 border-t border-sidebar-border pt-3">
        <NavLink item={settingsItem} active={isActive(settingsItem, path)} onNavigate={onNavigate} />
        <BotonCerrarSesion />
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
  const publicLink = usePanelPublicLink();
  return (
    <div className="border-t border-sidebar-border p-4">
      <a
        href={publicLink}
        className="flex items-center justify-between rounded-lg bg-sidebar-accent/50 px-3 py-2 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent"
      >
        Ver sitio público <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

/**
 * El panel también acepta el negocio en su propio enlace (`/app?d=…`), igual
 * que la web pública. Hace falta para instalarlo en el iPad como app aparte:
 * cada icono de «Añadir a pantalla de inicio» tiene su almacenamiento propio,
 * así que el panel abierto desde su icono no ve el salón que se abrió en la
 * web, y sin esto saldría el salón de ejemplo delante del cliente.
 */
function useApplyDemoFromUrl() {
  const demoRaw = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.[DEMO_PARAM],
  });
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const applyBusinessType = useSalonStore((s) => s.applyBusinessType);
  const markDemoActive = useSalonStore((s) => s.markDemoActive);
  useEffect(() => {
    const fromUrl = decodeDemoProfile(typeof demoRaw === "string" ? demoRaw : undefined);
    if (!fromUrl) return;
    // Un salón real ya resuelto manda sobre el enlace — ver el mismo guardia en
    // s.$salonSlug.tsx y `useRealSalon`.
    if (useSalonStore.getState().realSalonSlug) return;
    updateSalonProfile({ ...blankDemoProfile(), ...fromUrl });
    // Las mismas opciones que aplica la web pública (s.$salonSlug.tsx): sin
    // `duracionFlexible` aquí, abrir el panel directamente por `/app?d=…`
    // resembraba la agenda SIN la clienta de la duración flexible.
    applyBusinessType(inferBusinessType(fromUrl.tagline, fromUrl.name), {
      team: fromUrl.team,
      menu: fromUrl.menu,
      noShowFeeEur: fromUrl.noShowFeeEur,
      smartSpread: fromUrl.smartSpread,
      duracionFlexible: fromUrl.duracionFlexible,
    });
    markDemoActive();
  }, [demoRaw, updateSalonProfile, applyBusinessType, markDemoActive]);
}

/**
 * Qué salón está gestionando este panel.
 *
 * `/app` no lleva el salón en la ruta, así que se mira, por este orden:
 *   1. `?s=<slug>` — lo que pone el botón "Acceso barbero" de la web pública.
 *      Es lo único que funciona en un dispositivo recién estrenado, sin nada
 *      guardado: la URL estable del panel de un salón real.
 *   2. El slug del perfil que ya hubiera en este navegador, para que una
 *      recarga de `/app` a secas siga entrando a la misma agenda.
 *
 * Para las demos de venta ninguno de los dos existe en `salons`, así que la
 * consulta devuelve null y el panel sigue siendo el de siempre.
 */
function useSalonSlugDelPanel(): string | undefined {
  const desdeUrl = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.s,
  });
  const guardado = useSalonStore((s) => s.salonProfile.slug);
  return typeof desdeUrl === "string" && desdeUrl ? desdeUrl : guardado || undefined;
}

/**
 * Mantiene el `<title>` de la pestaña al día con el salón que hay cargado.
 *
 * El `head()` de la ruta se evalúa UNA sola vez, al definirse el módulo, con
 * lo que hubiera en la store en ese momento — que en una pestaña recién
 * abierta es siempre el salón de ejemplo. Resultado: el panel de un salón
 * real se quedaba anunciando "Dashboard · Barbería Pepe" en la pestaña, en
 * los enlaces compartidos y en cualquier captura, aunque llevara rato
 * enseñando los datos correctos. Aquí se corrige en cuanto llega el nombre.
 */
function useTituloDelPanel() {
  const salonName = useSalonStore((s) => s.salonProfile.name);
  useEffect(() => {
    if (typeof document === "undefined" || !salonName) return;
    document.title = `Panel · ${salonName}`;
  }, [salonName]);
}

function DashboardLayout() {
  // Sincroniza `?v=2`/`?v=1` con la preferencia guardada del panel — tiene
  // que correr para TODAS las rutas /app/*, entren o no por aquí primero.
  useSyncPanelV2FromUrl();
  useApplyDemoFromUrl();
  useTituloDelPanel();
  const slug = useSalonSlugDelPanel();

  // Nada de lo de dentro se monta hasta que se sabe quién está entrando: ni
  // el armazón del panel, ni la consulta que trae la agenda.
  return (
    <GuardiaDelPanel slug={slug}>
      <PanelAutorizado slug={slug} />
    </GuardiaDelPanel>
  );
}

/** El panel, ya con el acceso comprobado. */
function PanelAutorizado({ slug }: { slug?: string }) {
  // Si este panel gestiona un salón real, aquí es donde deja de ser una copia
  // local y pasa a leer y escribir en Supabase. Si no, no hace nada.
  useRealSalon(slug, "panel");
  const realSlug = useSalonStore((s) => s.realSalonSlug);
  const refresco = usePanelRefresh(realSlug);
  const panelV2 = usePanelV2();

  return <>
    {panelV2 ? <PanelV2Shell /> : <DashboardLayoutV1 />}
    {refresco && <span className="indicador-refresco fixed bottom-3 right-3 z-10 rounded-full border border-border bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm max-lg:bottom-20">{refresco}</span>}
  </>;
}

/** El panel de siempre, sin tocar — se activa cuando `panelV2` está desactivado. */
function DashboardLayoutV1() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const salonInitial = salonName.trim().charAt(0).toUpperCase() || "?";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newApptOpen, setNewApptOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [path]);

  // Primera visita al panel: se ofrece el tour una sola vez. Solo en la home
  // (/app), que es donde están anclados casi todos los pasos.
  //
  // La espera no es un respiro cualquiera: los KPIs cuentan hasta su cifra
  // durante ~1,2 s, y mientras cuentan cambian de ancho. Si el tour abre su
  // foco encima de una tarjeta que todavía se está moviendo, el recuadro
  // resaltado queda descuadrado respecto al elemento. Se arranca cuando los
  // números ya se han asentado.
  useEffect(() => {
    if (path !== "/app" || hasSeenTour()) return;
    const t = setTimeout(startTour, 1900);
    return () => clearTimeout(t);
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
            <BuscadorGlobal />
            <div className="hidden md:block">
              <ViewSwitcher mode="dashboard" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={startTour}
              title="Ver el tour guiado del panel"
              aria-label="Ver el tour guiado del panel"
            >
              <Compass className="h-4 w-4" />
            </Button>
            <Button
              data-tour="assistant"
              variant="outline"
              size="sm"
              onClick={() => setAssistantOpen(true)}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden md:inline">Asistente</span>
            </Button>
            <ThemeToggle />
            <Button
              data-tour="new-appointment"
              size="sm"
              onClick={() => setNewApptOpen(true)}
              className="gap-1.5"
            >
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

      <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border/60 px-4 py-4 text-left">
            <SheetTitle className="font-display text-lg">Asistente del salón</SheetTitle>
            <SheetDescription>
              Consulta tus datos en lenguaje natural. Calcula sobre tus reservas
              reales: no es un modelo de lenguaje y no inventa cifras.
            </SheetDescription>
          </SheetHeader>
          <AssistantPanel className="flex-1" />
        </SheetContent>
      </Sheet>
    </div>
  );
}
