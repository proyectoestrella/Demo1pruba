/**
 * Instalar el panel en el dispositivo (PWA), sin depender de React.
 *
 * - Android/Chrome/Edge: el navegador ofrece `beforeinstallprompt`; se guarda
 *   aquí en cuanto llega (aunque el aviso aún no esté en pantalla) para que el
 *   botón «Instalar» abra la instalación nativa de un toque.
 * - iPhone/iPad: no hay API; se enseñan los dos pasos de Safari.
 * - Ya instalada (display-mode standalone o `navigator.standalone`): nada.
 *
 * La tarjeta de Hoy se puede cerrar: no vuelve en ese aparato en 30 días, y
 * nunca tras instalar. En Ajustes › Accesos queda siempre una fila fija.
 */
export type InvitacionInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export type Plataforma = "android" | "ios" | "escritorio" | "otro";

export const CLAVE_DESCARTADO = "sishow-instalar-descartado";
const CLAVE_INSTALADO = "sishow-instalar-instalado";
const CLAVE_DEMO_VENTA = "sishow-instalar-demo-venta";
const CLAVE_FORZADO = "sishow-instalar-forzado";
const CLAVE_RECHAZADO = "sishow-instalar-rechazado";
const DIAS_DESCARTE = 30;

type Estado = { invitacion: InvitacionInstalar | null; instalada: boolean; hojaAbierta: boolean };
let estado: Estado = { invitacion: null, instalada: false, hojaAbierta: false };
const oyentes = new Set<() => void>();

function cambiar(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  for (const o of oyentes) o();
}

export function suscribirInstalar(o: () => void): () => void {
  oyentes.add(o);
  return () => oyentes.delete(o);
}
export const estadoInstalar = (): Estado => estado;
const ESTADO_SERVIDOR: Estado = { invitacion: null, instalada: true, hojaAbierta: false };
export const estadoInstalarServidor = (): Estado => ESTADO_SERVIDOR;

export function estaInstalada(): boolean {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    estado.instalada ||
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true
  );
}

export function plataformaInstalar(): Plataforma {
  if (typeof navigator === "undefined") return "otro";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  const tactil = window.matchMedia?.("(hover: none) and (pointer: coarse)").matches === true;
  if (/Android/i.test(ua) || (tactil && estado.invitacion)) return "android";
  return tactil ? "otro" : "escritorio";
}

/** Móvil o tablet táctil: donde tiene sentido el aviso automático. */
export function esDispositivoTactil(): boolean {
  if (typeof window === "undefined") return false;
  return plataformaInstalar() === "ios" || window.matchMedia?.("(hover: none) and (pointer: coarse)").matches === true;
}

function leer(clave: string, almacen: "local" | "session" = "local"): string | null {
  try {
    return (almacen === "local" ? window.localStorage : window.sessionStorage).getItem(clave);
  } catch {
    return null;
  }
}
function escribir(clave: string, valor: string, almacen: "local" | "session" = "local") {
  try {
    (almacen === "local" ? window.localStorage : window.sessionStorage).setItem(clave, valor);
  } catch {
    // Sin almacenamiento (modo privado): el aviso puede repetirse, nada más.
  }
}

/** Cerrada con la × hace menos de 30 días, o ya instalada alguna vez. */
export function avisoDescartado(slug: string | undefined): boolean {
  if (leer(CLAVE_INSTALADO) || leer(CLAVE_RECHAZADO, "session")) return true;
  const fecha = Number(leer(`${CLAVE_DESCARTADO}:${slug ?? "panel"}`));
  return Number.isFinite(fecha) && fecha > 0 && Date.now() - fecha < DIAS_DESCARTE * 86_400_000;
}
export const descartarAviso = (slug: string | undefined) =>
  escribir(`${CLAVE_DESCARTADO}:${slug ?? "panel"}`, String(Date.now()));

/**
 * Demo de venta abierta con `?d=`, o cualquier demo: la tarjeta no sale sola
 * (la URL puede perder el parámetro al navegar, por eso se recuerda en la
 * sesión). `?instalar=1` la pide a propósito. La fila de Ajustes, siempre.
 */
export function esDemoDeVenta(search: string): boolean {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(search);
  if (p.has("d") || p.get("acceso") === "demo") {
    escribir(CLAVE_DEMO_VENTA, "1", "session");
    return true;
  }
  return leer(CLAVE_DEMO_VENTA, "session") === "1";
}
export function pedidoPorUrl(search: string): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(search).get("instalar") === "1") escribir(CLAVE_FORZADO, "1", "session");
  return leer(CLAVE_FORZADO, "session") === "1";
}

/** iPhone o iPad con un navegador que no es Safari: Añadir a inicio solo es fiable desde Safari. */
export const iosSinSafari = () =>
  typeof navigator !== "undefined" && plataformaInstalar() === "ios" && /CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

export const abrirHojaInstalar = () => cambiar({ hojaAbierta: true });
export const cerrarHojaInstalar = () => cambiar({ hojaAbierta: false });

/** Abre la instalación nativa si el navegador la ofrece. Devuelve si se pudo. */
export async function lanzarInstalacionNativa(): Promise<"aceptada" | "rechazada" | "no-disponible"> {
  const inv = estado.invitacion;
  if (!inv) return "no-disponible";
  try {
    await inv.prompt();
    const eleccion = await inv.userChoice;
    // Una invitación solo sirve una vez.
    cambiar({ invitacion: null });
    if (eleccion.outcome === "accepted") {
      escribir(CLAVE_INSTALADO, "1");
      cambiar({ instalada: true });
      return "aceptada";
    }
    // Rechazada: la tarjeta se retira durante esta sesión.
    escribir(CLAVE_RECHAZADO, "1", "session");
    cambiar({});
    return "rechazada";
  } catch {
    cambiar({ invitacion: null });
    return "no-disponible";
  }
}

let escuchando = false;
/** Se llama una vez al cargar el panel: escucha al navegador y registra el worker. */
export function prepararInstalacion() {
  if (escuchando || typeof window === "undefined") return;
  escuchando = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    cambiar({ invitacion: e as InvitacionInstalar });
  });
  window.addEventListener("appinstalled", () => {
    escribir(CLAVE_INSTALADO, "1");
    cambiar({ instalada: true, invitacion: null });
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", (e) => {
    if (e.matches) cambiar({ instalada: true });
  });
  // Worker mínimo, sin `fetch` (auditoría D3): solo el panel, no la web pública.
  if ("serviceWorker" in navigator)
    void navigator.serviceWorker.register("/panel-sw.js", { scope: "/app" }).catch(() => {});
}

if (typeof window !== "undefined") prepararInstalacion();
