import { AvisoHuecoLiberado } from "@/components/AvisoHuecoLiberado";
import { hostActual, slugSalonDelHost } from "@/lib/host-actual";
// Escucha `beforeinstallprompt` desde que se entra al panel (ver lib/instalar-panel).
import "@/lib/instalar-panel";
import { conRegistroEnPausa } from "@/lib/store";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { menosMovimiento } from "@/lib/movimiento-panel";
import { sincronizarColores } from "@/lib/colores-elegidos";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { useRealSalon } from "@/lib/use-real-salon";
import { aplicarPrecedenciaDeEnlace } from "@/lib/precedencia-enlace-panel-store";
import { usePanelRefresh } from "@/lib/use-panel-refresh";
import { useSyncPanelV2FromUrl, usePanelV2 } from "@/lib/use-panel-v2";
import { DEMO_PARAM, blankDemoProfile, decodeDemoProfile } from "@/lib/demo-profile";
import { inferBusinessType } from "@/lib/business-type";
import { useDemoRegistradaAlDia } from "@/lib/demos/aplicar";
import { GuardiaDelPanel } from "@/components/GuardiaDelPanel";
import { FichasGlobales } from "@/components/FichasGlobales";
import { accesoPanel, permitidoEnRuta, salirPorRevocacion } from "@/lib/acceso-actual-panel";
import { hasSeenTour, markTourSeen, startTour } from "@/lib/tour";
import {
  BarraInferior,
  CabeceraArena,
  MenuLateral,
  TODOS_LOS_ITEMS,
  estaActivo,
} from "@/components/ArenaShell";
import { FranjaVerComo } from "@/components/VerComo";
import { SinPermiso } from "@/components/SinPermiso";
import { instalarAtajoDeshacer, instalarRegistro } from "@/lib/deshacer-maqueta";
import { usePlanSalon, usePuede, useTienePlan } from "@/lib/accesos-panel";
import { rutaIncluidaEnPlan } from "@/lib/plan-basico";
import { useRedirigirSiRutaSinPermiso } from "@/lib/route-guards";
import { useHayPanelLateral } from "@/lib/panel-lateral";
import { slugResolvibleDelPanel } from "@/lib/slug-panel";
import { cn } from "@/lib/utils";
import { manifestDelAcceso, slugDeAcceso } from "@/lib/identidad-slug";
import { perfilGuardado } from "@/lib/perfil-ref";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NewAppointmentDialog = lazy(() =>
  import("@/components/NewAppointmentDialog").then((m) => ({ default: m.NewAppointmentDialog })),
);
const AssistantPanel = lazy(() =>
  import("@/components/assistant/AssistantPanel").then((m) => ({ default: m.AssistantPanel })),
);
const PanelV2Shell = lazy(() =>
  import("@/components/PanelV2Shell").then((m) => ({ default: m.PanelV2Shell })),
);

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
  beforeLoad: async ({ location, matches }) => {
    if (typeof window === "undefined") return;
    // Móvil (22-oct): el router no pide el código de la sección hasta que
    // termina esta puerta (módulo + comprobación de acceso = dos viajes en
    // serie). Se pide ya, en paralelo: en 4G lento es ~1 s menos de espera.
    precargarCodigoDeRutas(Route, matches);
    const { puertaDelPanel } = await import("@/lib/app-puerta");
    return puertaDelPanel(location);
  },
  head: ({ match }) => ({
    meta: [{ title: `Dashboard · ${perfilGuardado()?.name ?? "siShow"}` }],
    // Identidad de instalación propia; el scope incluye login y aceptar.
    links: [
      {
        rel: "manifest",
        href: manifestDelAcceso(
          slugDeAcceso({
            slugDesdeUrl: (match.search as Record<string, unknown>)?.s,
            hostname: hostActual(),
            slugGuardado: perfilGuardado()?.slug,
          }),
        ),
      },
    ],
  }),
  component: DashboardLayout,
});

type RutaConCodigo = {
  id: string;
  options?: { component?: { preload?: () => unknown } };
  children?: unknown;
};

/** Pide el código partido (`component.preload`) de las rutas que van a pintarse. */
function precargarCodigoDeRutas(raiz: unknown, matches: { routeId: string }[]) {
  const ids = new Set(matches.map((m) => m.routeId));
  const visitar = (ruta: RutaConCodigo | undefined) => {
    if (!ruta) return;
    if (ids.has(ruta.id)) {
      try {
        void Promise.resolve(ruta.options?.component?.preload?.()).catch(() => {});
      } catch {
        // Si no se puede adelantar, el router lo pedirá a su hora.
      }
    }
    const hijos = ruta.children;
    const lista = Array.isArray(hijos) ? hijos : hijos && typeof hijos === "object" ? Object.values(hijos) : [];
    for (const h of lista) visitar(h as RutaConCodigo);
  };
  visitar(raiz as RutaConCodigo);
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
    // Aplicar el enlace de demo es cargar, no cambiar: sin historial (lote 9b).
    conRegistroEnPausa(() => updateSalonProfile({ ...blankDemoProfile(), ...fromUrl }));
    // Las mismas opciones que aplica la web pública (s.$salonSlug.tsx): sin
    // `duracionFlexible` aquí, abrir el panel directamente por `/app?d=…`
    // resembraba la agenda SIN la clienta de la duración flexible.
    applyBusinessType(inferBusinessType(fromUrl.tagline, fromUrl.name), {
      team: fromUrl.team,
      menu: fromUrl.menu,
      noShowFeeEur: fromUrl.noShowFeeEur,
      smartSpread: fromUrl.smartSpread,
      duracionFlexible: fromUrl.duracionFlexible,
      // Lote P: si hoy el salón cierra, la demo abre igual (ver SalonProfile.demoAbreHoy).
      abrirHoy: true,
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
  const demoRaw = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.[DEMO_PARAM],
  });
  const guardado = useSalonStore((s) => s.salonProfile.slug);
  const demoRegistradaActiva = useSalonStore((s) => s.demoActive && !s.realSalonSlug);
  return slugResolvibleDelPanel({
    slugDesdeUrl: desdeUrl,
    demoRaw,
    slugGuardado: slugSalonDelHost() ?? guardado,
    demoRegistradaActiva,
  });
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

/**
 * `beforeLoad` no corre al hidratar una carga directa de la URL, así que la
 * precedencia «la URL manda sobre lo guardado» se aplica también aquí, antes
 * de pintar y antes de que el panel se monte (la puerta aún está comprobando).
 */
function useAplicarPrecedenciaDelEnlace() {
  const s = useRouterState({ select: (st) => (st.location.search as Record<string, unknown>)?.s });
  const d = useRouterState({
    select: (st) => (st.location.search as Record<string, unknown>)?.[DEMO_PARAM],
  });
  useLayoutEffect(() => {
    aplicarPrecedenciaDeEnlace({ s, d });
  }, [s, d]);
}

/**
 * Con el panel ya pintado y el hilo libre, trae el código de las pantallas
 * principales (solo los trozos, sin ejecutar cargadores ni guardas) para que
 * navegar entre ellas no espere a la red. Es el mismo trabajo que haría el
 * `preload: intent` al pasar el dedo, hecho antes.
 */
function usePrecargarPantallasDelPanel() {
  const router = useRouter();
  useEffect(() => {
    const rutas = ["/app/calendar", "/app/appointments", "/app/clients", "/app/caja", "/app/hoja"];
    const ric: (cb: () => void) => number =
      typeof window.requestIdleCallback === "function"
        ? (cb) => window.requestIdleCallback(cb, { timeout: 4000 })
        : (cb) => window.setTimeout(cb, 1500);
    const cancelar =
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback
        : window.clearTimeout;
    let pendiente: number;
    let i = 0;
    const siguiente = () => {
      const ruta = router.routesByPath[rutas[i++] as keyof typeof router.routesByPath];
      if (ruta) void router.loadRouteChunk(ruta as never)?.catch(() => {});
      // Una por turno: nunca varias a la vez en el mismo fotograma.
      if (i < rutas.length) pendiente = ric(siguiente);
    };
    pendiente = ric(siguiente);
    return () => cancelar(pendiente);
  }, [router]);
}

function DashboardLayout() {
  usePrecargarPantallasDelPanel();
  // La capa clara es exclusiva de esta vista previa: los diálogos con portal
  // la heredan y se restaura al salir hacia la web pública.
  useEffect(() => {
    const raiz = document.documentElement;
    const temaAnterior = raiz.dataset.tema;
    raiz.dataset.tema = "claro";
    return () => {
      if (temaAnterior) raiz.dataset.tema = temaAnterior;
      else delete raiz.dataset.tema;
    };
  }, []);
  // Lote 12: cada acción reversible deja un cambio con «Deshacer» (y Ctrl+Z).
  useEffect(() => {
    instalarRegistro();
    return instalarAtajoDeshacer();
  }, []);
  // Sincroniza `?v=2`/`?v=1` con la preferencia guardada del panel — tiene
  // que correr para TODAS las rutas /app/*, entren o no por aquí primero.
  useSyncPanelV2FromUrl();
  useAplicarPrecedenciaDelEnlace();
  useApplyDemoFromUrl();
  // Lote P: una demo registrada cargada otro día se recarga (su «hoy» caduca).
  const conEnlaceDemo = useRouterState({
    select: (s) => typeof (s.location.search as Record<string, unknown>)?.[DEMO_PARAM] === "string",
  });
  useDemoRegistradaAlDia(conEnlaceDemo);
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
  const plan = usePlanSalon();
  // También cubre el armazón V2; el V1 enseña además el mensaje intermedio
  // mientras esta red de seguridad devuelve a Inicio.
  const path = useRouterState({ select: (s) => s.location.pathname });
  useRedirigirSiRutaSinPermiso(path);

  return (
    <>
      {panelV2 && plan !== "reservas" ? (
        <Suspense
          fallback={<div className="min-h-dvh" aria-busy="true" aria-label="Cargando panel" />}
        >
          <PanelV2Shell />
        </Suspense>
      ) : <DashboardLayoutV1 />}
      <FichasGlobales />
      {refresco && (
        <span className="indicador-refresco fixed bottom-3 right-3 z-10 rounded-full border border-border bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm max-lg:bottom-[calc(var(--alto-barra-fija)+var(--alto-fab-panel)+20px)]">
          {refresco}
        </span>
      )}
    </>
  );
}

/**
 * El cromo «Arena» del panel (DESIGN.md): menú lateral, cabecera y, en móvil,
 * barra inferior. Es el que se ve por defecto; `?v=2` sigue llevando al
 * PanelV2Shell. La lógica (tour, asistente, nueva cita) es la de siempre.
 */
function DashboardLayoutV1() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const contenedorRuta = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (menosMovimiento()) return;
    contenedorRuta.current?.animate?.(
      [
        { opacity: 0.4, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [path]);
  const [newApptOpen, setNewApptOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const realSlug = useSalonStore((s) => s.realSalonSlug);
  // La marca del perfil es del salón y guardarla exige `salon.editar`: solo la
  // leen y la escriben gerente y subencargada. Estilistas y recepción se quedan
  // con la marca del dispositivo, sin parches que el servidor rechazaría.
  const puedeAcc = usePuede();
  const tourEnPerfil = Boolean(realSlug) && puedeAcc("salon.editar");
  const tourVistoEnServidor =
    useSalonStore((s) => s.salonProfile.tourPanelVisto === true) && tourEnPerfil;
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const marcarTourVisto = useCallback(() => {
    // Las demos no escriben esta preferencia. En un salón real viaja como un
    // parche pequeño del perfil y queda disponible en los demás dispositivos.
    if (tourEnPerfil && !useSalonStore.getState().salonProfile.tourPanelVisto) {
      updateSalonProfile({ tourPanelVisto: true });
    }
  }, [tourEnPerfil, updateSalonProfile]);
  const abrirTour = useCallback(() => startTour(marcarTourVisto), [marcarTourVisto]);
  // Con un panel lateral abierto (asistente, ficha, detalle), en PC el
  // contenido deja el ancho del panel a la derecha (--ancho-panel, que la
  // dueña puede cambiar arrastrando su borde): el panel empuja, no tapa.
  const conPanel = useHayPanelLateral();
  // Lote 11: una sección que el rol no ve se sustituye por «Esta parte la lleva…».
  const plan = usePlanSalon();
  const conAsistente = useTienePlan("asistente");
  const permitida = useRedirigirSiRutaSinPermiso(path);
  // Una pantalla que el plan no incluye (Caja, Analítica, Marketing, Lista de
  // espera con el Básico) no existe: ni se pinta ni enseña tarjeta de plan;
  // una URL escrita a mano vuelve a Inicio. Vale igual en salón real y demo.
  const slugPlan = useSalonStore((s) => s.realSalonSlug ?? s.salonProfile.slug);
  const fueraDelPlan = !rutaIncluidaEnPlan(path, plan, slugPlan);
  const navigate = useNavigate();
  useEffect(() => {
    if (fueraDelPlan) void navigate({ to: "/app", replace: true });
  }, [fueraDelPlan, navigate]);
  const seccion = TODOS_LOS_ITEMS.find((i) => estaActivo(i, path))?.label ?? "esta sección";
  // Colores elegidos por la dueña en Ajustes (9h): se sincronizan antes de pintar.
  const coloresServicio = useSalonStore((s) => s.salonProfile.coloresServicio);
  const coloresProfesional = useSalonStore((s) => s.salonProfile.coloresProfesional);
  sincronizarColores(coloresServicio, coloresProfesional);

  // Primera visita al panel: se ofrece el tour una sola vez. Solo en la home
  // (/app), que es donde están anclados casi todos los pasos. Se espera a que
  // el contenido esté asentado antes de enfocar nada.
  useEffect(() => {
    if (tourVistoEnServidor) markTourSeen();
  }, [tourVistoEnServidor]);

  // Migra la marca que ya existía solo en este dispositivo: en cuanto se
  // confirma que es una cuenta real, la conserva también en el perfil.
  useEffect(() => {
    if (tourEnPerfil && !tourVistoEnServidor && hasSeenTour()) {
      updateSalonProfile({ tourPanelVisto: true });
    }
  }, [tourEnPerfil, tourVistoEnServidor, updateSalonProfile]);

  useEffect(() => {
    if (path !== "/app" || hasSeenTour(tourVistoEnServidor)) return;
    // En las demos (sin salón real) el tour no se lanza solo: taparía el panel
    // mientras se enseña, y al volver a Hoy el enlace ya no lleva el ?d= (22-oct).
    // Sigue disponible a mano desde el botón de la cabecera.
    if (!realSlug || new URLSearchParams(window.location.search).has("d")) return;
    const t = setTimeout(() => {
      // La resolución del salón es asíncrona. Volvemos a comprobar la copia
      // remota justo antes de abrir para que un perfil ya marcado no vea un
      // destello del tour durante la hidratación.
      const estado = useSalonStore.getState();
      if (hasSeenTour(tourEnPerfil && estado.salonProfile.tourPanelVisto === true)) return;
      abrirTour();
    }, 1900);
    return () => clearTimeout(t);
  }, [abrirTour, path, realSlug, tourEnPerfil, tourVistoEnServidor]);

  return (
    <div className="panel-marco flex w-auto min-w-0">
      <div
        className={cn(
          "flex min-h-[inherit] min-w-0 flex-1 overflow-visible rounded-[inherit] bg-transparent",
          path === "/app/calendar" && "marco-calendario h-dvh",
        )}
      >
        <MenuLateral path={path} />
        <AvisoHuecoLiberado />

        <div
          data-panel={conPanel ? "abierto" : "cerrado"}
          className={cn(
            "group/panel flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out",
            conPanel && "lg:pr-[var(--ancho-panel,440px)]",
          )}
        >
          <CabeceraArena
            onAsistente={() => setAssistantOpen(true)}
            onNuevaCita={() => setNewApptOpen(true)}
            onTour={abrirTour}
          />
          {/* Contenido a todo el ancho con gutter de 28 px; en móvil, 16 px y
            hueco para la barra inferior. El último bloque de cada pantalla
            puede crecer hasta el borde (flex-1). */}
          <FranjaVerComo />
          <main
            className={cn(
              "hueco-fab-panel flex min-w-0 flex-1 flex-col",
              path === "/app/calendar"
                ? "main-calendario min-h-0 overflow-hidden bg-transparent p-0"
                : "gutter-x pt-[var(--hueco-seccion)]",
            )}
          >
            {/* Lote 16: cada pantalla entra con un fundido y 8 px de desplazamiento
              (180 ms). Con la Web Animations API y sin `key`: remontar el
              contenedor en cada ruta costaba el doble de tiempo al navegar.
              Regla única de maquetación (styles.css): gutter en <main>, ancho
              máximo y ritmo vertical en `.pagina`. */}
            <div
              ref={contenedorRuta}
              data-pagina={path === "/app/calendar" ? undefined : ""}
              className={
                path === "/app/calendar" ? "flex min-h-0 min-w-0 flex-1 flex-col" : "pagina"
              }
            >
              {fueraDelPlan ? null : permitida ? <Outlet /> : <SinPermiso seccion={seccion} />}
            </div>
          </main>
        </div>

        <BarraInferior path={path} onNuevaCita={() => setNewApptOpen(true)} />

        {newApptOpen && (
          <Suspense fallback={null}>
            <NewAppointmentDialog open onOpenChange={setNewApptOpen} />
          </Suspense>
        )}

        {conAsistente && (
          <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
            <SheetContent side="right" panel="asistente" className="flex w-full flex-col gap-0 p-0">
              <SheetHeader className="border-b border-border/60 px-4 py-4 text-left">
                <SheetTitle className="text-lg font-extrabold">Asistente del salón</SheetTitle>
                <SheetDescription>
                  Consulta tus datos en lenguaje natural. Calcula sobre tus reservas reales: no es
                  un modelo de lenguaje y no inventa cifras.
                </SheetDescription>
              </SheetHeader>
              {assistantOpen && (
                <Suspense
                  fallback={
                    <p role="status" className="p-4 text-sm text-muted-foreground">
                      Cargando asistente…
                    </p>
                  }
                >
                  <AssistantPanel className="flex-1" />
                </Suspense>
              )}
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}
