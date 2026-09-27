import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutGrid, Maximize, Minimize } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AvisosDeSincronizacion } from "@/components/AvisosDeSincronizacion";
import { SimboloSishow } from "@/components/web/Marca";
import { IMAGEN_SOCIAL, SITIO_URL } from "@/lib/sishow-web";
import { zonaDeRuta } from "@/lib/zona-web";

import appCss from "../styles.css?url";

/**
 * Página no encontrada, en español y con la identidad de siShow (integración
 * 7; antes decía «Page not found»). «Volver al inicio» es un enlace normal a
 * `/`: en sishow.es lleva a la web oficial y en el subdominio de un salón, a
 * la web de ese salón.
 */
function NotFoundComponent() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="max-w-md text-center">
        <SimboloSishow size={56} className="mx-auto" />
        <p className="mt-8 text-sm font-semibold tracking-[0.12em] text-muted-foreground">ERROR 404</p>
        <h1 className="mt-2 font-display text-4xl leading-tight">Esta página no existe</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Puede que el enlace esté mal copiado o que la página ya no esté. Si venías a pedir cita, vuelve al enlace
          que te mandó tu salón.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="max-w-md text-center">
        <SimboloSishow size={56} className="mx-auto" />
        <h1 className="mt-8 font-display text-3xl leading-tight">Esta página no ha cargado</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Algo ha fallado por nuestra parte. Prueba otra vez en un momento.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Volver a intentarlo
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-input bg-background px-6 text-sm font-semibold hover:bg-accent"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => {
    // Integración 7: lo global del <head> sin rastro de «Trimly» ni de Lovable,
    // en español, y sin leer la store del panel (antes el título salía del
    // salón guardado en el proceso del servidor, «… — Premium hair salon booking»).
    // Cada página pisa título, descripción e imagen con los suyos: la web
    // oficial (cabezaWeb) y la del salón (s.$salonSlug.tsx).
    const ruta = matches[matches.length - 1]?.pathname ?? "/";
    const zona = zonaDeRuta(ruta);
    const titulo = "siShow — Reservas y agenda para tu salón";
    const descripcion =
      "siShow: reservas por internet y agenda para peluquerías, barberías y centros de belleza. Tus clientas reservan solas; tú, a lo tuyo.";
    const imagen = `${SITIO_URL}${IMAGEN_SOCIAL.ruta}`;
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        // Instalable en el iPad desde "Añadir a pantalla de inicio": se abre a
        // pantalla completa, sin barra del navegador ni el dominio de pruebas.
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black" },
        { name: "apple-mobile-web-app-title", content: "siShow" },
        { name: "theme-color", content: "#111113" },
        { title: titulo },
        { name: "description", content: descripcion },
        { property: "og:title", content: titulo },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "siShow" },
        { property: "og:locale", content: "es_ES" },
        { name: "twitter:title", content: titulo },
        { property: "og:description", content: descripcion },
        { name: "twitter:description", content: descripcion },
        { property: "og:image", content: imagen },
        { name: "twitter:image", content: imagen },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        // Fuentes autoalojadas (ver styles.css): se precarga solo el texto
        // (Manrope, latín), que es lo que se pinta primero en todas las páginas.
        { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/manrope-latin.woff2", crossOrigin: "anonymous" },
        // El manifiesto instala la app del rutero (start_url /rutero): solo en
        // el panel. En la web oficial o la de un salón, «Añadir a pantalla de
        // inicio» no puede llevar a una clienta a una herramienta interna.
        ...(zona === "panel" ? [{ rel: "manifest", href: "/manifest.webmanifest" }] : []),
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
        // Sin esto el navegador pedía /favicon.ico (404 en la consola).
        { rel: "icon", href: "/web/favicon.svg", type: "image/svg+xml" },
        { rel: "icon", href: "/web/favicon-32.png", type: "image/png", sizes: "32x32" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// Solo hay modo claro (identidad «Arena», ver DESIGN.md). Quien tuviera
// guardada la preferencia «dark» del panel antiguo la pierde aquí, para que
// ningún navegador arranque con la clase `dark` heredada.
const THEME_ANTI_FLASH_SCRIPT = `
(function () {
  try {
    document.documentElement.classList.remove("dark");
    if (window.localStorage.getItem("trimly-theme") !== null) window.localStorage.removeItem("trimly-theme");
  } catch (e) {}
})();
`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: THEME_ANTI_FLASH_SCRIPT }} />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <ControlesIpad />
      {/* Lote 12: abajo, como mucho tres a la vez; en móvil, por encima de la barra inferior. */}
      <Toaster position="bottom-center" visibleToasts={3} mobileOffset={{ bottom: 92 }} />
      {/* Lo que NO se ha guardado tiene que verse: ver lib/avisos-sync.ts. */}
      <AvisosDeSincronizacion />
    </QueryClientProvider>
  );
}

/**
 * Controles para enseñar las demos en el iPad sin la barra del navegador.
 *
 * Dos vías, porque en el iPad cada una falla por un motivo distinto:
 * - Instalada desde "Añadir a pantalla de inicio" ya se abre sin barra, pero
 *   no tiene botón de atrás: aquí se ofrece volver a la lista del rutero.
 * - Abierta en Safari o Chrome, un toque en el botón pide pantalla completa al
 *   navegador (API Fullscreen, disponible en iPadOS). Se mantiene mientras se
 *   navega dentro de la web, y se pierde si la página se recarga entera.
 *
 * Solo aparecen en tablet o en modo app: quien abre el enlace en su móvil no
 * ve nada.
 */
type DocFs = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void;
};
type ElFs = HTMLElement & { webkitRequestFullscreen?: () => void };

function ControlesIpad() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const [app, setApp] = useState(false);
  const [tablet, setTablet] = useState(false);
  const [puede, setPuede] = useState(false);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);

  useEffect(() => {
    const d = document as DocFs;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setApp(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
    // iPadOS se presenta como Mac: se distingue por la pantalla táctil.
    setTablet(
      (navigator.maxTouchPoints > 1 || window.matchMedia("(any-pointer: coarse)").matches) &&
        window.innerWidth >= 700,
    );
    setPuede(Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled));
    const sync = () =>
      setEnPantallaCompleta(Boolean(d.fullscreenElement || d.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const alternar = () => {
    const d = document as DocFs;
    const el = document.documentElement as ElFs;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else d.webkitExitFullscreen?.();
    } else if (el.requestFullscreen) {
      void el.requestFullscreen().catch(() => el.webkitRequestFullscreen?.());
    } else {
      el.webkitRequestFullscreen?.();
    }
  };

  // Integración 7: ni en la web oficial ni en la web de reservas de un salón
  // (las ven clientas y dueñas, no son la demo del iPad). En la del salón solo
  // queda «Volver al rutero» si se entró a pantalla completa desde el panel,
  // que es el recorrido de la demo; instalada como app por una clienta, nada.
  const zona = zonaDeRuta(path);
  if (zona === "oficial") return null;
  const verVolver = (zona === "salon" ? enPantallaCompleta : app || enPantallaCompleta) && path !== "/rutero";
  const verPantalla = zona === "panel" && !app && tablet && puede;
  if (!verVolver && !verPantalla) return null;

  const boton =
    "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/70 opacity-60 backdrop-blur transition-opacity hover:opacity-100";
  return (
    <div className="fixed bottom-4 left-4 z-[60] flex gap-2">
      {verVolver && (
        <button
          type="button"
          aria-label="Volver al rutero"
          className={boton}
          onClick={() => void router.navigate({ to: "/rutero" })}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      )}
      {verPantalla && (
        <button
          type="button"
          aria-label={enPantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
          className={boton}
          onClick={alternar}
        >
          {enPantallaCompleta ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
