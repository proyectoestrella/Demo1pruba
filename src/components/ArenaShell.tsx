import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Bell,
  Calendar,
  ChartColumn,
  Clock,
  Compass,
  FileText,
  Globe,
  Home,
  ListChecks,
  Megaphone,
  MoreHorizontal,
  Plus,
  Scissors,
  Settings,
  Sparkles,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSalonStore } from "@/lib/store";
import { usePanelPublicLink } from "@/lib/panel-public-link";
import { moduloVisible, type ModuloOcultable } from "@/lib/demo-profile";
import { BuscadorGlobal } from "@/components/BuscadorGlobal";
import { BotonCerrarSesion } from "@/components/BotonCerrarSesion";
import { TOTAL_PASOS, useProgresoPrimerosPasos } from "@/components/PrimerosPasos";
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
 * Armazón «Arena» del panel (ver DESIGN.md): menú lateral en nata de 244 px,
 * cabecera blanca con el buscador de clientas, el asistente, la campana y
 * «Nueva cita»; por debajo de 768 px, barra inferior de cinco apartados y un
 * botón «+» flotante. Solo presentación: las rutas son las de siempre.
 */

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Módulo que esta demo puede ocultar (ver `demo-profile.ts`). Ausente = siempre visible. */
  modulo?: ModuloOcultable;
  /** Subapartados que solo se despliegan cuando este apartado o uno de ellos está activo. */
  hijos?: NavItem[];
};

export const GRUPOS_NAV: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { to: "/app", label: "Hoy", icon: Home, exact: true },
      {
        to: "/app/calendar",
        label: "Calendario",
        icon: Calendar,
        hijos: [
          { to: "/app/appointments", label: "Citas", icon: ListChecks },
          { to: "/app/waitlist", label: "Lista de espera", icon: Clock, modulo: "lista-espera" },
        ],
      },
      { to: "/app/clients", label: "Clientas", icon: Users },
      { to: "/app/hoja", label: "Hoja del día", icon: FileText },
    ],
  },
  {
    label: "Salón",
    items: [
      { to: "/app/employees", label: "Equipo", icon: UsersRound, modulo: "equipo" },
      { to: "/app/services", label: "Servicios y precios", icon: Scissors },
      { to: "/app/web", label: "Mi página de reservas", icon: Globe },
      { to: "/app/settings", label: "Ajustes", icon: Settings },
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

/** Los cuatro apartados con sitio en la barra inferior del móvil; el resto va en «Más». */
const BARRA_MOVIL: NavItem[] = [
  { to: "/app", label: "Hoy", icon: Home, exact: true },
  { to: "/app/calendar", label: "Calendario", icon: Calendar },
  { to: "/app/clients", label: "Clientas", icon: Users },
  { to: "/app/web", label: "Mi página", icon: Globe },
];

/** Todos los apartados, con los subapartados aplanados. */
export const TODOS_LOS_ITEMS: NavItem[] = GRUPOS_NAV.flatMap((g) =>
  g.items.flatMap((i) => [i, ...(i.hijos ?? [])]),
);

export function estaActivo(item: NavItem, path: string) {
  return item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/");
}

/** Activo él mismo o alguno de sus subapartados: así Calendario se queda abierto en Citas. */
export function estaActivoConHijos(item: NavItem, path: string) {
  return estaActivo(item, path) || (item.hijos ?? []).some((h) => estaActivo(h, path));
}

function useGruposVisibles() {
  const modulosOcultos = useSalonStore((s) => s.salonProfile.modulosOcultos);
  const visible = (i: NavItem) => !i.modulo || moduloVisible({ modulosOcultos }, i.modulo);
  return GRUPOS_NAV.map((g) => ({
    ...g,
    items: g.items.filter(visible).map((i) => (i.hijos ? { ...i, hijos: i.hijos.filter(visible) } : i)),
  })).filter((g) => g.items.length > 0);
}

/** Solicitudes por confirmar: el contador verde junto a «Hoy». */
function useSolicitudesPendientes() {
  return useSalonStore((s) => s.appointments.filter((a) => a.status === "pending").length);
}

/** «siShow · Madrid»: la ciudad sale de la dirección del salón, si la hay. */
function ciudadDe(direccion: string | undefined): string {
  const ultimo = (direccion ?? "").split(",").pop()?.trim() ?? "";
  const sinCp = ultimo.replace(/^\d{4,5}\s+/, "").trim();
  return sinCp;
}

function Marca({ compacta = false }: { compacta?: boolean }) {
  const name = useSalonStore((s) => s.salonProfile.name);
  const address = useSalonStore((s) => s.salonProfile.address);
  const inicial = name.trim().charAt(0).toUpperCase() || "?";
  const ciudad = ciudadDe(address);
  return (
    <Link to="/app" className="flex items-center gap-2.5 hover:text-foreground">
      <b
        className={cn(
          "grid shrink-0 place-items-center rounded-xl bg-primary font-display font-medium text-primary-foreground",
          compacta ? "size-8 text-base" : "size-[38px] text-[19px]",
        )}
        aria-hidden="true"
      >
        {inicial}
      </b>
      <span className="min-w-0 leading-tight">
        <strong className={cn("block truncate", compacta ? "text-sm font-extrabold" : "text-[15px]")}>{name}</strong>
        {!compacta && (
          <span className="block truncate text-xs text-muted-foreground">
            siShow{ciudad ? ` · ${ciudad}` : ""}
          </span>
        )}
      </span>
    </Link>
  );
}

function EnlaceNav({ item, active, contador, onNavigate, hijo = false }: { item: NavItem; active: boolean; contador?: number; onNavigate?: () => void; hijo?: boolean }) {
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-[11px] rounded-xl border px-3 text-sm font-semibold transition-colors",
        hijo && "ml-7 h-9 text-[13px]",
        active
          ? "border-border bg-card text-foreground shadow-[var(--sombra-tarjeta)]"
          : "border-transparent text-cafe-medio hover:bg-arena hover:text-cafe-medio",
      )}
    >
      <item.icon className={cn("size-[18px] shrink-0", active && "text-primary")} strokeWidth={1.6} />
      {item.label}
      {!!contador && (
        <span className="ml-auto rounded-full bg-salvia-clara px-2 text-[11px] font-bold tabular-nums text-hoja-tinta">
          {contador}
        </span>
      )}
    </Link>
  );
}

function ProgresoPrimerosPasos() {
  const { progreso, pendientes, oculto } = useProgresoPrimerosPasos();
  if (oculto || progreso >= TOTAL_PASOS) return null;
  const faltan = pendientes.slice(0, 2).map((p) => p.toLowerCase()).join(" y ");
  // Por debajo de 860 px de alto se queda en una línea con su barra: sigue
  // guiando la primera semana sin empujar el menú a un scroll.
  return (
    <Link
      to="/app/settings"
      className="mb-3 block rounded-2xl bg-salvia-clara p-3 text-xs hover:text-foreground [@media(max-height:859px)]:px-3 [@media(max-height:859px)]:py-2"
    >
      <b className="block text-hoja-tinta">
        Primeros pasos · {progreso} de {TOTAL_PASOS}
      </b>
      <span className="text-muted-foreground [@media(max-height:859px)]:hidden">Te faltan {faltan}</span>
      <span className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-card" aria-hidden="true">
        <i className="block bg-hoja" style={{ width: `${Math.round((progreso / TOTAL_PASOS) * 100)}%` }} />
      </span>
    </Link>
  );
}

function BloqueUsuario() {
  const name = useSalonStore((s) => s.salonProfile.name);
  const publicLink = usePanelPublicLink();
  const inicial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-3">
      <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-stylist-mario text-xs font-extrabold" aria-hidden="true">
        {inicial}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <b className="block truncate text-[13px]">{name}</b>
        <a href={publicLink} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          Ver tu web <ArrowUpRight className="size-3" />
        </a>
      </div>
      <BotonCerrarSesion variante="icono" />
    </div>
  );
}

/** Menú lateral de PC (≥ 768 px). */
export function MenuLateral({ path }: { path: string }) {
  const grupos = useGruposVisibles();
  const pendientes = useSolicitudesPendientes();
  return (
    <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col border-r border-border bg-sidebar px-3 py-5 md:flex">
      <div className="px-2 pb-5">
        <Marca />
      </div>
      <nav data-tour="nav" className="sin-scrollbar flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {grupos.map((g, gi) => (
          <div key={g.label ?? gi} className="flex flex-col gap-0.5">
            {g.label && (
              <p className="px-3 pt-3 pb-1.5 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                {g.label}
              </p>
            )}
            {g.items.map((item) => (
              <div key={item.to} className="flex flex-col gap-0.5">
                <EnlaceNav
                  item={item}
                  active={estaActivo(item, path)}
                  contador={item.to === "/app" ? pendientes : undefined}
                />
                {item.hijos && estaActivoConHijos(item, path) &&
                  item.hijos.map((h) => (
                    <EnlaceNav key={h.to} item={h} active={estaActivo(h, path)} hijo />
                  ))}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div className="mt-auto shrink-0 pt-3">
        <ProgresoPrimerosPasos />
        <BloqueUsuario />
      </div>
    </aside>
  );
}

export interface CabeceraArenaProps {
  onAsistente: () => void;
  onNuevaCita: () => void;
  onTour?: () => void;
}

/** Cabecera: buscador, Asistente, campana, Nueva cita. En móvil, marca + asistente y el buscador debajo. */
export function CabeceraArena({ onAsistente, onNuevaCita, onTour }: CabeceraArenaProps) {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur md:flex-nowrap md:gap-3 md:px-8 md:py-3.5">
      <div className="md:hidden">
        <Marca compacta />
      </div>
      <div className="order-last w-full md:order-none md:w-auto md:flex-[0_1_420px]">
        <BuscadorGlobal variante="campo" />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
        <Button
          data-tour="assistant"
          variant="outline"
          onClick={onAsistente}
          className="h-[42px] gap-2 rounded-full border-input bg-card px-0 text-sm font-bold hover:bg-nata md:px-[18px]"
          aria-label="Asistente"
        >
          <Sparkles className="size-[18px]" strokeWidth={1.6} />
          <span className="hidden md:inline">Asistente</span>
        </Button>
        {onTour && (
          <button
            type="button"
            onClick={onTour}
            title="Ver el tour guiado del panel"
            aria-label="Ver el tour guiado del panel"
            className="hidden size-[42px] place-items-center rounded-full border border-input bg-card text-cafe-medio hover:bg-nata md:grid"
          >
            <Compass className="size-[18px]" strokeWidth={1.6} />
          </button>
        )}
        <button
          type="button"
          onClick={() => toast("Sin avisos nuevos")}
          aria-label="Avisos"
          className="hidden size-[42px] place-items-center rounded-full border border-input bg-card text-cafe-medio hover:bg-nata md:grid"
        >
          <Bell className="size-[18px]" strokeWidth={1.6} />
        </button>
        <Button
          data-tour="new-appointment"
          onClick={onNuevaCita}
          className="hidden h-[42px] gap-2 rounded-full px-[18px] text-sm font-bold md:inline-flex"
        >
          <Plus className="size-[18px]" strokeWidth={1.6} />
          Nueva cita
        </Button>
      </div>
    </header>
  );
}

/**
 * El «+» flotante se aparta (se desvanece) cuando taparía un botón o un
 * enlace del contenido: mira qué hay debajo de su centro en cada scroll.
 */
function useFabApartado() {
  const [apartado, setApartado] = useState(false);
  useEffect(() => {
    let marco = 0;
    const mirar = () => {
      marco = 0;
      const fab = document.querySelector<HTMLElement>("[data-fab]");
      if (!fab || getComputedStyle(fab).display === "none") return;
      const r = fab.getBoundingClientRect();
      const puntos: [number, number][] = [
        [r.left + r.width / 2, r.top + r.height / 2],
        [r.left + 6, r.top + 6],
        [r.right - 6, r.top + 6],
        [r.left + 6, r.bottom - 6],
        [r.right - 6, r.bottom - 6],
      ];
      const tapa = puntos.some(([x, y]) =>
        document
          .elementsFromPoint(x, y)
          .filter((el) => el !== fab && !fab.contains(el))
          .some((el) => el.closest("button, a, input, select, textarea, [role=button]")),
      );
      setApartado(tapa);
    };
    const pedir = () => {
      if (!marco) marco = requestAnimationFrame(mirar);
    };
    pedir();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    const obs = new MutationObserver(pedir);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", pedir);
      obs.disconnect();
      if (marco) cancelAnimationFrame(marco);
    };
  }, []);
  return apartado;
}

/** Barra inferior del móvil (< 768 px) con «Más», y el botón «+» flotante. */
export function BarraInferior({ path, onNuevaCita }: { path: string; onNuevaCita: () => void }) {
  const grupos = useGruposVisibles();
  const publicLink = usePanelPublicLink();
  const [masAbierto, setMasAbierto] = useState(false);
  const apartado = useFabApartado();
  const enBarra = new Set(BARRA_MOVIL.map((i) => i.to));
  const restantes = grupos
    .flatMap((g) => g.items.flatMap((i) => [i, ...(i.hijos ?? [])]))
    .filter((i) => !enBarra.has(i.to));
  const activoEnMas = restantes.some((i) => estaActivo(i, path));
  const clase = (active: boolean) =>
    cn(
      "flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] font-bold",
      active ? "bg-nata text-foreground" : "text-muted-foreground",
    );
  return (
    <>
      <button
        type="button"
        onClick={onNuevaCita}
        aria-label="Nueva cita"
        className={cn(
          "fixed right-4 bottom-[88px] z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_rgba(138,100,70,0.35)] transition-[opacity,transform] duration-150 md:hidden",
          apartado && "pointer-events-none scale-[.6] opacity-0",
        )}
        data-fab
      >
        <Plus className="size-6" strokeWidth={1.6} />
      </button>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card px-1.5 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] md:hidden"
        aria-label="Apartados"
      >
        {BARRA_MOVIL.map((item) => {
          const active = estaActivo(item, path);
          return (
            <Link key={item.to} to={item.to} className={clase(active)}>
              <item.icon className={cn("size-[22px]", active && "text-primary")} strokeWidth={1.6} />
              {item.label}
            </Link>
          );
        })}
        <Sheet open={masAbierto} onOpenChange={setMasAbierto}>
          <SheetTrigger asChild>
            <button type="button" className={clase(activoEnMas)}>
              <MoreHorizontal className={cn("size-[22px]", activoEnMas && "text-primary")} strokeWidth={1.6} />
              Más
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Más</SheetTitle>
              <SheetDescription className="sr-only">Resto de apartados del panel</SheetDescription>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-2 px-4 pb-6">
              {restantes.map((item) => {
                const active = estaActivo(item, path);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMasAbierto(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center text-xs font-semibold",
                      active ? "border-primary bg-nata text-foreground" : "border-border text-cafe-medio hover:bg-nata",
                    )}
                  >
                    <item.icon className="size-5" strokeWidth={1.6} />
                    {item.label}
                  </Link>
                );
              })}
              <a
                href={publicLink}
                onClick={() => setMasAbierto(false)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border px-3 py-4 text-center text-xs font-semibold text-cafe-medio hover:bg-nata"
              >
                <ArrowUpRight className="size-5" strokeWidth={1.6} />
                Ver tu web
              </a>
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-border px-3 py-4 text-center text-xs font-semibold text-cafe-medio">
                <BotonCerrarSesion variante="icono" />
                Cerrar sesión
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </>
  );
}
