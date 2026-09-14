import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutGrid, Maximize, Minimize } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { useSalonStore } from "@/lib/store";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try refreshing.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const fallbackTitle = `${useSalonStore.getState().salonProfile.name} — Premium hair salon booking`;
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        // Instalable en el iPad desde "Añadir a pantalla de inicio": se abre a
        // pantalla completa, sin barra del navegador ni el dominio de pruebas.
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black" },
        { name: "apple-mobile-web-app-title", content: "Trimly" },
        { name: "theme-color", content: "#111113" },
        { title: fallbackTitle },
        {
          name: "description",
          content:
            "Premium booking platform for hair salons and barbershops. Book in seconds, manage your salon like an operating system.",
        },
        { property: "og:title", content: fallbackTitle },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: fallbackTitle },
        {
          name: "description",
          content: "Trimly is a barber booking and business dashboard for independent barbers.",
        },
        {
          property: "og:description",
          content: "Trimly is a barber booking and business dashboard for independent barbers.",
        },
        {
          name: "twitter:description",
          content: "Trimly is a barber booking and business dashboard for independent barbers.",
        },
        {
          property: "og:image",
          content:
            "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1f9f21d7-b627-4fc9-a76d-ebf1f67d7d96/id-preview-8062d78c--8482e4c5-95d6-4696-a2e1-c9514fc10a7b.lovable.app-1779993805471.png",
        },
        {
          name: "twitter:image",
          content:
            "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1f9f21d7-b627-4fc9-a76d-ebf1f67d7d96/id-preview-8062d78c--8482e4c5-95d6-4696-a2e1-c9514fc10a7b.lovable.app-1779993805471.png",
        },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=Inter+Tight:wght@300;400;500;600;700&display=swap",
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// Runs before hydration to avoid a flash of the wrong theme / SSR-vs-client
// class mismatch: the server always renders `<html class="dark">` (dark is
// the default), and this script removes the class as early as possible if
// the visitor previously chose light mode.
const THEME_ANTI_FLASH_SCRIPT = `
(function () {
  try {
    if (window.localStorage.getItem("trimly-theme") === "light") {
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {}
})();
`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
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
      <Toaster position="top-center" />
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
    setTablet(navigator.maxTouchPoints > 1 && window.innerWidth >= 700);
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

  const verVolver = (app || enPantallaCompleta) && path !== "/rutero";
  const verPantalla = !app && tablet && puede;
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
