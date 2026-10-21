import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Bell,
  Calendar,
  CalendarCheck,
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
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSalonStore } from "@/lib/store";
import { usePanelPublicLink } from "@/lib/panel-public-link";
import { moduloVisibleEnPanel, type ModuloOcultable } from "@/lib/demo-profile";
import { BuscadorGlobal } from "@/components/BuscadorGlobal";
import { BotonCerrarSesion } from "@/components/BotonCerrarSesion";
import { BotonHistorial } from "@/components/HojaHistorial";
import { TOTAL_PASOS, useProgresoPrimerosPasos } from "@/components/PrimerosPasos";
import { Button } from "@/components/ui/button";
import { AvatarSalon } from "@/components/AvatarSalon";
import { IconoSiShow, LetrasSiShow } from "@/components/MarcaSiShow";
import { VerComo, PlanContratado } from "@/components/VerComo";
import { AjustesCalendarios } from "@/components/AjustesCalendarios";
import { API_CALENDARIOS, alcanceCalendario, useCalendariosActivos } from "@/lib/calendarios-panel";
import { insigniaDeRuta } from "@/lib/plan";
import {
  useCitasVisibles,
  useMiembroActual,
  usePermisos,
  usePlanSalon,
  useTienePlan,
  veRuta,
} from "@/lib/accesos-panel";
import { rutaIncluidaEnPlan } from "@/lib/plan-basico";
import { NOMBRE_ROL } from "@/lib/accesos-maqueta";
import { useBusinessType } from "@/lib/use-display-profile";
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
 * cabecera beige con el buscador de clientas, el asistente, la campana y
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
      { to: "/app/calendar", label: "Calendario", icon: Calendar },
      { to: "/app/appointments", label: "Citas", icon: ListChecks },
      { to: "/app/waitlist", label: "Lista de espera", icon: Clock, modulo: "lista-espera" },
      { to: "/app/clients", label: "Clientas", icon: Users },
      { to: "/app/hoja", label: "Hoja del día", icon: FileText },
    ],
  },
  {
    label: "Salón",
    items: [
      { to: "/app/employees", label: "Equipo", icon: UsersRound, modulo: "equipo" },
      { to: "/app/services", label: "Servicios y precios", icon: Scissors },
      { to: "/app/caja", label: "Caja del día", icon: Wallet },
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

/** En una barbería se habla de «clientes», no de «clientas». */
function EtiquetaNav({ label }: { label: string }) {
  const tipo = useBusinessType();
  return <>{tipo === "barberia" && label === "Clientas" ? "Clientes" : label}</>;
}

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

/** Lo que el menú enseña: lo que la demo no oculta y lo que el rol puede ver (lote 11). */
function useGruposVisibles() {
  const modulosOcultos = useSalonStore((s) => s.salonProfile.modulosOcultos);
  const permisos = usePermisos();
  const plan = usePlanSalon();
  const visible = (i: NavItem) =>
    (!i.modulo || moduloVisibleEnPanel({ modulosOcultos }, i.modulo)) &&
    veRuta(permisos, i.to) &&
    rutaIncluidaEnPlan(i.to, plan);
  return GRUPOS_NAV.map((g) => ({
    ...g,
    items: g.items
      .filter(visible)
      .map((i) => (i.hijos ? { ...i, hijos: i.hijos.filter(visible) } : i)),
  })).filter((g) => g.items.length > 0);
}

/** Solicitudes por confirmar: el contador verde junto a «Hoy» (las que le tocan a quien mira). */
function useSolicitudesPendientes() {
  return useCitasVisibles().filter((a) => a.status === "pending").length;
}

/** Los cuatro de la barra inferior: los de siempre que pueda ver, completados con los primeros que vea. */
function useBarraMovil(grupos: { items: NavItem[] }[]): NavItem[] {
  const permisos = usePermisos();
  const plan = usePlanSalon();
  const fijos = BARRA_MOVIL.filter(
    (i) => veRuta(permisos, i.to) && rutaIncluidaEnPlan(i.to, plan),
  );
  const resto = grupos.flatMap((g) => g.items).filter((i) => !fijos.some((f) => f.to === i.to));
  return [...fijos, ...resto].slice(0, 4);
}

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Avatar con iniciales de una persona (el del salón es `AvatarSalon`). */
export function AvatarPersona({ nombre, size = 34 }: { nombre: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-salvia-clara text-[12px] font-extrabold text-hoja-tinta"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {iniciales(nombre)}
    </span>
  );
}

function Marca({ compacta = false }: { compacta?: boolean }) {
  const name = useSalonStore((s) => s.salonProfile.name);
  return (
    <Link to="/app" className="flex items-center gap-2.5 hover:text-foreground">
      <AvatarSalon
        size={compacta ? 32 : 40}
        claseInicial="bg-primary font-display font-medium text-primary-foreground"
      />
      <span className="min-w-0 leading-tight">
        <strong
          className={cn("block truncate", compacta ? "text-sm font-extrabold" : "text-[15px]")}
        >
          {name}
        </strong>
        {!compacta && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <LetrasSiShow className="h-3.5 shrink-0" />
          </span>
        )}
        {compacta && <LetrasSiShow className="mt-0.5 h-3" />}
      </span>
    </Link>
  );
}

/** Insignia discreta, a la derecha: solo en lo que el plan del salón aún no tiene. */
function InsigniaPlan({ nombre }: { nombre: string }) {
  return (
    <span className="ml-auto rounded-full bg-arena px-2 py-0.5 text-[10.5px] font-bold text-cafe-medio">
      {nombre}
    </span>
  );
}

function EnlaceNav({
  item,
  active,
  contador,
  onNavigate,
  hijo = false,
}: {
  item: NavItem;
  active: boolean;
  contador?: number;
  onNavigate?: () => void;
  hijo?: boolean;
}) {
  const insignia = insigniaDeRuta(item.to, usePlanSalon());
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[40px] shrink-0 items-center gap-[11px] rounded-full border px-3 text-sm font-semibold transition-colors",
        hijo && "ml-7 h-9 text-[13px]",
        active
          ? "border-transparent bg-[#303030] text-white"
          : "border-transparent text-cafe-medio hover:bg-white/70 hover:text-cafe",
      )}
    >
      <item.icon className={cn("size-[18px] shrink-0", active && "text-white")} strokeWidth={1.6} />
      <EtiquetaNav label={item.label} />
      {insignia && <InsigniaPlan nombre={insignia} />}
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
  const permisos = usePermisos();
  if (oculto || progreso >= TOTAL_PASOS || permisos.rol !== "gerente") return null;
  const faltan = pendientes
    .slice(0, 2)
    .map((p) => p.toLowerCase())
    .join(" y ");
  // Una sola línea con su barra: guía la primera semana sin empujar el menú
  // a un scroll. Lo que falta sale al pasar el ratón.
  return (
    <Link
      to="/app/settings"
      title={`Te faltan ${faltan}`}
      className="mb-2 block rounded-2xl bg-salvia-clara px-3 py-2 text-xs hover:text-foreground [@media(max-height:820px)]:hidden"
    >
      <b className="block text-hoja-tinta">
        Primeros pasos · {progreso} de {TOTAL_PASOS}
      </b>
      <span
        className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-superficie"
        aria-hidden="true"
      >
        <i
          className="block bg-hoja"
          style={{ width: `${Math.round((progreso / TOTAL_PASOS) * 100)}%` }}
        />
      </span>
    </Link>
  );
}

/**
 * Quién está dentro: su nombre, su rol y el salón (lote 11). Sin miembro
 * conocido (salón real hasta conectar), el salón como hasta ahora.
 */
function BloqueUsuario() {
  const name = useSalonStore((s) => s.salonProfile.name);
  const miembro = useMiembroActual();
  const permisos = usePermisos();
  const nombre = miembro?.displayName ?? null;
  const calendarios = useCalendariosActivos();
  const [miCalendario, setMiCalendario] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex w-full min-w-0 items-center gap-2.5 rounded-xl text-left">
          {nombre ? <AvatarPersona nombre={nombre} /> : <AvatarSalon size={34} />}
          <span className="min-w-0 flex-1 leading-tight">
            <b className="block truncate text-[13px]">{nombre ?? name}</b>
            {miembro && <span className="block truncate text-xs text-muted-foreground">{NOMBRE_ROL[miembro.rol]}</span>}
          </span>
        </div>
        {/* 14c: la estilista gestiona su calendario desde aquí (no ve Ajustes). */}
        {calendarios.activo && calendarios.slug && alcanceCalendario(permisos) === "propio" && (
          <button
            type="button"
            onClick={() => setMiCalendario(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            Mi calendario <CalendarCheck className="size-3" />
          </button>
        )}
      </div>
      <BotonCerrarSesion variante="icono" />
      {calendarios.slug && (
        <Sheet open={miCalendario} onOpenChange={setMiCalendario}>
          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border px-5 py-4 text-left">
              <SheetTitle className="text-base font-extrabold">Mi calendario</SheetTitle>
              <SheetDescription>
                Tu Google Calendar o el calendario de tu iPhone, cruzado con tus citas.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <AjustesCalendarios api={API_CALENDARIOS} slug={calendarios.slug} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

/** Menú lateral de PC (≥ 768 px). */
export function MenuLateral({ path }: { path: string }) {
  const grupos = useGruposVisibles();
  const pendientes = useSolicitudesPendientes();
  const publicLink = usePanelPublicLink();
  return (
    <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col border-r border-transparent bg-transparent px-3 py-4 md:flex">
      <div className="px-2 pb-3">
        <Marca />
      </div>
      <nav data-tour="nav" className="sin-scrollbar flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {grupos.map((g, gi) => (
          <div key={g.label ?? gi} className="flex flex-col gap-0.5">
            {g.label && (
              <p className="px-3 pt-2.5 pb-1 text-[10.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
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
                {item.to === "/app/web" && (
                  <a href={publicLink} className="ml-10 flex min-h-9 items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                    Ver tu web <ArrowUpRight className="size-3" />
                  </a>
                )}
                {item.hijos &&
                  estaActivoConHijos(item, path) &&
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
        <VerComo apilado className="mb-2 flex" />
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

function BotonTour({ onTour, className }: { onTour?: () => void; className?: string }) {
  if (!onTour) return null;
  return (
    <button
      type="button"
      onClick={onTour}
      title="Ver el tour guiado del panel"
      aria-label="Ver el tour guiado del panel"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border border-input/70 bg-card/70 text-cafe-medio hover:bg-nata",
        className,
      )}
    >
      <Compass className="size-[18px]" strokeWidth={1.6} />
    </button>
  );
}

function BotonAvisos({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => toast("Sin avisos nuevos")}
      title="Avisos"
      aria-label="Avisos"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border border-input/70 bg-card/70 text-cafe-medio hover:bg-nata",
        className,
      )}
    >
      <Bell className="size-[18px]" strokeWidth={1.6} />
    </button>
  );
}

/** Cabecera de píldoras: búsqueda y cita a la izquierda, alineadas con el gutter del contenido; nunca elimina plan ni asistente. */
export function CabeceraArena({ onAsistente, onNuevaCita, onTour }: CabeceraArenaProps) {
  // Sin el plan del asistente (Básico, o mientras se resuelve el salón), el botón no existe.
  const conAsistente = useTienePlan("asistente");
  return (
    <header className="gutter-x relative grid grid-cols-1 items-center gap-2 pt-[calc(10px+var(--seguro-arriba))] pb-2.5 md:sticky md:top-0 md:z-20 md:flex md:h-[calc(71px+var(--seguro-arriba))] md:gap-3 md:pt-[var(--seguro-arriba)] md:pb-0">
      <div className="flex items-center justify-between md:hidden">
        <Marca compacta />
        <div className="flex items-center gap-2">
          {conAsistente && <Button
            data-tour="assistant"
            variant="outline"
            onClick={onAsistente}
            className="size-11 rounded-full border-input/70 bg-card/70 px-0 text-cafe-medio hover:bg-nata"
            aria-label="Asistente"
          >
            <Sparkles className="size-[18px]" strokeWidth={1.6} />
          </Button>}
          <BotonTour onTour={onTour} className="size-11" />
          <BotonHistorial className="size-11" />
          <BotonAvisos className="size-11" />
        </div>
      </div>
      <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:max-w-[560px] md:flex-1">
        <div className="min-w-0 flex-1 md:max-w-[420px]">
          <BuscadorGlobal variante="campo" />
        </div>
        <Button
          data-tour="new-appointment"
          aria-label="Nueva cita"
          title="Nueva cita"
          onClick={onNuevaCita}
          className="hidden h-11 min-w-0 max-w-full shrink-0 gap-1.5 rounded-full px-3 text-[13px] font-bold md:inline-flex md:group-data-[panel=abierto]/panel:size-9 md:group-data-[panel=abierto]/panel:shrink-0 md:group-data-[panel=abierto]/panel:px-0"
        >
          <Plus className="size-4" strokeWidth={1.6} />
          <span className="truncate md:group-data-[panel=abierto]/panel:hidden">Nueva cita</span>
        </Button>
      </div>
      <div className="hidden shrink-0 items-center gap-2 md:ml-auto md:flex">
        <PlanContratado className="hidden 2xl:inline-flex 2xl:group-data-[panel=abierto]/panel:hidden" />
        {conAsistente && <Button
          data-tour="assistant"
          variant="outline"
          onClick={onAsistente}
          className="size-9 rounded-full border-input/70 bg-card/70 px-0 text-cafe-medio hover:bg-nata xl:h-9 xl:w-auto xl:gap-2 xl:px-3 xl:group-data-[panel=abierto]/panel:size-9 xl:group-data-[panel=abierto]/panel:px-0"
          aria-label="Asistente"
        >
          <Sparkles className="size-[18px]" strokeWidth={1.6} />
          <span className="hidden xl:inline xl:group-data-[panel=abierto]/panel:hidden">
            Asistente
          </span>
        </Button>}
        <BotonTour onTour={onTour} />
        <BotonHistorial />
        <BotonAvisos />
      </div>
    </header>
  );
}

/**
 * El «+» flotante se encoge y se aclara (sigue visible y pulsable) cuando taparía un botón o un
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
  const barra = useBarraMovil(grupos);
  const publicLink = usePanelPublicLink();
  const plan = usePlanSalon();
  const [masAbierto, setMasAbierto] = useState(false);
  const apartado = useFabApartado();
  const enBarra = new Set(barra.map((i) => i.to));
  const restantes = grupos
    .flatMap((g) => g.items.flatMap((i) => [i, ...(i.hijos ?? [])]))
    .filter((i) => !enBarra.has(i.to));
  const activoEnMas = restantes.some((i) => estaActivo(i, path));
  const clase = (active: boolean) =>
    cn(
      "flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] font-bold",
      active ? "bg-salvia-clara text-foreground" : "text-muted-foreground",
    );
  return (
    <>
      <button
        type="button"
        onClick={onNuevaCita}
        aria-label="Nueva cita"
        className={cn(
          "fixed right-4 bottom-[88px] z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--sombra-flotante)] transition-[opacity,transform] duration-150 md:hidden",
          apartado && "scale-[.8] opacity-70",
        )}
        data-fab
      >
        <Plus className="size-6" strokeWidth={1.6} />
      </button>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[rgba(48,48,48,.07)] bg-[rgba(255,255,255,.12)] px-1.5 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] backdrop-blur-[12px] md:hidden"
        aria-label="Apartados"
      >
        {barra.map((item) => {
          const active = estaActivo(item, path);
          return (
            <Link key={item.to} to={item.to} className={clase(active)}>
              <item.icon
                className={cn("size-[22px]", active && "text-hoja-tinta")}
                strokeWidth={1.6}
              />
              <EtiquetaNav label={item.label} />
            </Link>
          );
        })}
        <Sheet open={masAbierto} onOpenChange={setMasAbierto}>
          <SheetTrigger asChild>
            <button type="button" aria-label="Más apartados" className={clase(activoEnMas)}>
              <MoreHorizontal
                className={cn("size-[22px]", activoEnMas && "text-hoja-tinta")}
                strokeWidth={1.6}
              />
              Más
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <IconoSiShow size={24} />
                Más
              </SheetTitle>
              <SheetDescription className="sr-only">Resto de apartados del panel</SheetDescription>
            </SheetHeader>
            <div className="space-y-3">
              <BloqueUsuario />
              <VerComo apilado className="flex w-full" />
              <PlanContratado />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {restantes.map((item) => {
                const active = estaActivo(item, path);
                return (
                  <div key={item.to} className="flex flex-col gap-1">
                  <Link
                    to={item.to}
                    onClick={() => setMasAbierto(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center text-xs font-semibold",
                      active
                        ? "border-primary bg-nata text-foreground"
                        : "border-border text-cafe-medio hover:bg-nata",
                    )}
                  >
                    <item.icon className="size-5" strokeWidth={1.6} />
                    <EtiquetaNav label={item.label} />
                    {insigniaDeRuta(item.to, plan) && (
                      <span className="rounded-full bg-arena px-2 py-0.5 text-[10px] font-bold text-cafe-medio">
                        {insigniaDeRuta(item.to, plan)}
                      </span>
                    )}
                  </Link>
                  {item.to === "/app/web" && (
                    <a href={publicLink} onClick={() => setMasAbierto(false)}
                      className="flex min-h-11 items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      Ver tu web <ArrowUpRight className="size-3" />
                    </a>
                  )}
                  </div>
                );
              })}

            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </>
  );
}
