import { redirect } from "@tanstack/react-router";
import { hostActual } from "@/lib/host-actual";
import { useSalonStore } from "@/lib/store";
import { aplicarPrecedenciaDeEnlace } from "@/lib/precedencia-enlace-panel-store";
import { DEMO_PARAM, decodeDemoProfile } from "@/lib/demo-profile";
import { slugDeAcceso } from "@/lib/identidad-slug";
import { accesoPanel, permitidoEnRuta, salirPorRevocacion } from "@/lib/acceso-actual-panel";

/**
 * Puerta del panel (antes `beforeLoad` de /app). Vive en su propio módulo para
 * que la landing pública no cargue la store ni el control de acceso: se importa
 * en dinámico solo al entrar en /app.
 */
export async function puertaDelPanel(location: { search: unknown; pathname: string }) {
  // La URL manda sobre lo guardado: un ?s= de otro salón descarta la demo anterior.
  aplicarPrecedenciaDeEnlace(location.search as Record<string, unknown>);
  // Un perfil de demo es autocontenido: jamás se consulta el slug que
  // quedara guardado (p. ej. PeluChic) antes de aplicarlo. De otro modo una
  // respuesta tardía de esa consulta podría pisar el equipo y la carta del
  // enlace con datos de la demo anterior.
  const demo = decodeDemoProfile(
    typeof (location.search as Record<string, unknown>)?.[DEMO_PARAM] === "string"
      ? ((location.search as Record<string, unknown>)[DEMO_PARAM] as string)
      : undefined,
  );
  if (demo) return;
  const desdeUrl = (location.search as Record<string, unknown>)?.s;
  const slug = slugDeAcceso({
    slugDesdeUrl: desdeUrl,
    hostname: hostActual(),
    slugGuardado: useSalonStore.getState().salonProfile.slug,
  });
  if (!slug) return;
  try {
    // Rendimiento (21-oct): el acceso se pregunta una vez por salón y se
    // reutiliza (refresco de fondo a los 60 s); la pantalla se decide aquí
    // con la membresía ya cargada. Los DATOS los protege cada función.
    const acc = await accesoPanel.obtener(slug, () => salirPorRevocacion(slug));
    const { real, permitido, miembro } = acc;
    if (real && !permitido) throw redirect({ to: "/login", search: { s: slug }, replace: true });
    if (!permitidoEnRuta(acc, location.pathname) && location.pathname !== "/app") {
      throw redirect({ to: "/app", search: { s: slug }, replace: true });
    }
    // Rol y nombre de quien entra (lote 8): para usePermisos() y el saludo.
    // Lote 16: solo si cambia. Cada `set` de la store reescribe entera la
    // copia local (~1,3 MB en la demo), y esto corría en cada navegación.
    const actual = useSalonStore.getState().miembro ?? null;
    if (JSON.stringify(actual) !== JSON.stringify(miembro ?? null)) {
      useSalonStore.getState().setMiembro(miembro ?? null);
    }
  } catch (err) {
    // El `redirect` de TanStack se lanza como excepción: hay que dejarlo
    // pasar. Cualquier otro fallo se ignora y decide `GuardiaDelPanel`.
    if (err && typeof err === "object" && "isRedirect" in err) throw err;
    console.error("No se pudo comprobar el acceso al panel:", err);
  }
}
