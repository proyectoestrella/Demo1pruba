/**
 * Fachada ligera del cliente de Supabase del navegador.
 *
 * `@supabase/supabase-js` pesa ~190 KB sin comprimir y la web pública no lo
 * necesita: sus visitantes no tienen sesión. Aquí solo se decide si hace falta
 * cargarlo (hay sesión guardada o se vuelve de un enlace mágico) y se importa
 * en dinámico; el resto de la lógica vive en `supabase-cliente.ts`.
 */
/** La URL del proyecto y la clave pública. Públicas a propósito: viajan al navegador. */
export const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const CLAVE_PUBLICA = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** ¿Está la sesión configurada en este despliegue? */
export function hayAuthConfigurada(): boolean {
  return Boolean(URL_SUPABASE && CLAVE_PUBLICA);
}

function puedeHaberSesion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem("sishow-sesion")) return true;
  } catch {
    /* almacenamiento bloqueado: se trata como sin sesión guardada */
  }
  return /access_token|[?&]code=|refresh_token/.test(window.location.hash + window.location.search);
}

/** Token de la sesión actual o `null`. No carga Supabase si no hay sesión posible. */
export async function tokenDeAcceso(): Promise<string | null> {
  if (!puedeHaberSesion()) return null;
  const { tokenDeAcceso: leer } = await import("./supabase-cliente");
  return leer();
}

/** Renueva el token a la fuerza (carga Supabase solo si puede haber sesión). Nunca cierra sesión. */
export async function refrescarSesion(): Promise<boolean> {
  if (!puedeHaberSesion()) return false;
  const { refrescarSesion: r } = await import("./supabase-cliente");
  return r();
}
