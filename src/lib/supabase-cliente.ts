/**
 * El cliente de Supabase DEL NAVEGADOR. Sirve para una sola cosa: la sesión.
 *
 * Aquí no se leen citas ni clientes. Todos los datos del salón siguen pasando
 * por las funciones de servidor (`createServerFn`), que son las únicas que
 * entran con la service role key. Este cliente usa la clave PÚBLICA, la misma
 * que cualquiera puede leer del bundle, y por eso no puede leer nada: las
 * tablas tienen RLS activada y ninguna política.
 *
 * Lo único que hace, entonces:
 *   1. Pedir el enlace mágico al correo del dueño (`signInWithOtp`).
 *   2. Guardar la sesión que llega de vuelta y refrescarla sola.
 *   3. Dar el token de acceso para que el servidor pueda comprobar quién
 *      llama antes de enseñarle nada.
 *
 * La sesión vive en `localStorage` del navegador y la gestiona Supabase, no
 * nosotros. `cerrarSesion()` (ver lib/sesion.ts) la borra y además vacía el
 * almacén del salón, que es lo que de verdad tiene datos de clientes dentro.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** La URL del proyecto y la clave pública. Públicas a propósito: viajan al navegador. */
const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLAVE_PUBLICA = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** ¿Está la sesión configurada en este despliegue? */
export function hayAuthConfigurada(): boolean {
  return Boolean(URL_SUPABASE && CLAVE_PUBLICA);
}

let cliente: SupabaseClient | null = null;

/**
 * El cliente, creado la primera vez que hace falta y reutilizado después.
 *
 * Devuelve `null` —en vez de reventar— cuando faltan las variables o cuando
 * esto se ejecuta en el servidor. Ninguna demo de venta puede quedarse en
 * blanco porque a alguien se le olvide una variable de entorno.
 */
export function supabaseNavegador(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!URL_SUPABASE || !CLAVE_PUBLICA) return null;
  if (!cliente) {
    cliente = createClient(URL_SUPABASE, CLAVE_PUBLICA, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // El enlace mágico vuelve con el token en la parte de la URL que va
        // después de la almohadilla. Sin esto, quien pincha el enlace vuelve
        // a la app sin sesión y no entiende por qué.
        detectSessionInUrl: true,
        storageKey: "sishow-sesion",
      },
    });
  }
  return cliente;
}

/**
 * El token de la sesión actual, o `null` si no hay ninguna.
 *
 * Es lo que se manda al servidor en la cabecera `Authorization` para que
 * pueda comprobar quién está llamando. Nunca se manda el correo ni el id de
 * usuario a pelo: el navegador podría escribir cualquier cosa ahí, y un token
 * firmado no.
 */
export async function tokenDeAcceso(): Promise<string | null> {
  const sb = supabaseNavegador();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
