import { useEffect, useState } from "react";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { useRealSalon } from "@/lib/use-real-salon";
import { usePanelRefresh } from "@/lib/use-panel-refresh";
import { useSyncPanelV2FromUrl, usePanelV2 } from "@/lib/use-panel-v2";
import {
  DEMO_PARAM,
  blankDemoProfile,
  decodeDemoProfile,
} from "@/lib/demo-profile";
import { inferBusinessType } from "@/lib/business-type";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { PanelV2Shell } from "@/components/PanelV2Shell";
import { GuardiaDelPanel } from "@/components/GuardiaDelPanel";
import { accesoAlPanel } from "@/lib/api/salons.functions";
import { hasSeenTour, startTour } from "@/lib/tour";
import { BarraInferior, CabeceraArena, MenuLateral } from "@/components/ArenaShell";
import { useHayPanelLateral } from "@/lib/panel-lateral";
import { cn } from "@/lib/utils";
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
      const { real, permitido } = await accesoAlPanel({ data: { slug } });
      if (real && !permitido) throw redirect({ to: "/login", replace: true });
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

/**
 * El cromo «Arena» del panel (DESIGN.md): menú lateral, cabecera y, en móvil,
 * barra inferior. Es el que se ve por defecto; `?v=2` sigue llevando al
 * PanelV2Shell. La lógica (tour, asistente, nueva cita) es la de siempre.
 */
function DashboardLayoutV1() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [newApptOpen, setNewApptOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Con un panel lateral abierto (asistente, ficha, detalle), en PC el
  // contenido deja 440 px a la derecha: el panel empuja, no tapa.
  const conPanel = useHayPanelLateral();

  // Primera visita al panel: se ofrece el tour una sola vez. Solo en la home
  // (/app), que es donde están anclados casi todos los pasos. Se espera a que
  // el contenido esté asentado antes de enfocar nada.
  useEffect(() => {
    if (path !== "/app" || hasSeenTour()) return;
    const t = setTimeout(startTour, 1900);
    return () => clearTimeout(t);
  }, [path]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <MenuLateral path={path} />

      <div
        data-panel={conPanel ? "abierto" : "cerrado"}
        className={cn("group/panel flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out", conPanel && "lg:pr-[440px]")}
      >
        <CabeceraArena
          onAsistente={() => setAssistantOpen(true)}
          onNuevaCita={() => setNewApptOpen(true)}
          onTour={startTour}
        />
        {/* Contenido a todo el ancho con gutter de 28 px; en móvil, 16 px y
            hueco para la barra inferior. El último bloque de cada pantalla
            puede crecer hasta el borde (flex-1). */}
        <main className="flex min-w-0 flex-1 flex-col px-4 pt-4 pb-[100px] md:px-7 md:pt-6 md:pb-7">
          <Outlet />
        </main>
      </div>

      <BarraInferior path={path} onNuevaCita={() => setNewApptOpen(true)} />

      <NewAppointmentDialog open={newApptOpen} onOpenChange={setNewApptOpen} />

      <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0"
        >
          <SheetHeader className="border-b border-border/60 px-4 py-4 text-left">
            <SheetTitle className="text-lg font-extrabold">Asistente del salón</SheetTitle>
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
