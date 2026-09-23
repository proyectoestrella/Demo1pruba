/**
 * Entrar y salir del panel.
 *
 * Solo hay una forma de entrar: el dueño escribe su correo, le llega un
 * enlace, lo pincha y ya está dentro. No hay contraseñas que recordar, que
 * apuntar en un papel junto a la caja, ni que robar.
 *
 * Y hay una forma de salir que importa mucho más de lo que parece: el iPad del
 * salón guarda en su memoria las citas y las fichas de los clientes —nombres,
 * teléfonos, notas— para funcionar rápido y aguantar un corte de internet. Si
 * "salir" solo cerrara la sesión, todo eso se quedaría ahí dentro. Por eso
 * `cerrarSesion` borra también ese almacén.
 */
import { useEffect, useState } from "react";

import { hayAuthConfigurada, supabaseNavegador } from "./supabase-browser";

/** La clave con la que el almacén del salón guarda las citas y las fichas. Ver lib/store.ts. */
export const CLAVE_ALMACEN_SALON = "trimly-salon-store";
/** La clave con la que Supabase guarda la sesión. Ver lib/supabase-browser.ts. */
export const CLAVE_SESION = "sishow-sesion";

/**
 * Borra del navegador todo lo que sea de este salón.
 *
 * Se exporta aparte de `cerrarSesion` para poder probarla con un
 * `localStorage` de mentira, sin montar Supabase.
 */
export function limpiarDatosLocales(almacen: Pick<Storage, "removeItem">): void {
  almacen.removeItem(CLAVE_ALMACEN_SALON);
  almacen.removeItem(CLAVE_SESION);
}

/**
 * Pide el enlace mágico al correo indicado.
 *
 * `emailRedirectTo` es a dónde vuelve la persona al pincharlo: al panel. Esa
 * URL tiene que estar dada de alta en Supabase (Authentication > URL
 * Configuration > Redirect URLs) o el enlace acaba en la página de inicio sin
 * sesión y sin explicación.
 */
export async function pedirEnlaceMagico(
  correo: string,
  volverA: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const sb = supabaseNavegador();
  if (!sb) {
    return {
      ok: false,
      motivo: "El acceso no está configurado en esta instalación. Avisa a quien te la montó.",
    };
  }
  const { error } = await sb.auth.signInWithOtp({
    email: correo.trim(),
    options: { emailRedirectTo: volverA },
  });
  if (error) {
    console.error("signInWithOtp:", error.message);
    return { ok: false, motivo: "No hemos podido enviar el correo. Inténtalo otra vez en un minuto." };
  }
  return { ok: true };
}

/** Cierra la sesión y deja el navegador sin un solo dato del salón dentro. */
export async function cerrarSesion(): Promise<void> {
  const sb = supabaseNavegador();
  try {
    // `scope: "local"` cierra la sesión de ESTE dispositivo. El móvil del
    // dueño no tiene por qué quedarse fuera porque alguien cierre el iPad.
    if (sb) await sb.auth.signOut({ scope: "local" });
  } catch (err) {
    // Aunque Supabase no responda, el borrado local se hace igual: es
    // justamente el caso en que más importa que no queden datos.
    console.error("No se pudo cerrar la sesión en el servidor:", err);
  }
  if (typeof window !== "undefined") {
    limpiarDatosLocales(window.localStorage);
    // Recarga entera para que ningún componente se quede con las citas ya
    // leídas en memoria. Es la única forma honesta de decir "aquí no queda nada".
    window.location.href = "/login";
  }
}

/** ¿Hay sesión en este navegador? `null` mientras todavía no se sabe. */
export function useSesion(): { cargando: boolean; correo: string | null } {
  const [estado, setEstado] = useState<{ cargando: boolean; correo: string | null }>({
    cargando: hayAuthConfigurada(),
    correo: null,
  });

  useEffect(() => {
    const sb = supabaseNavegador();
    if (!sb) {
      setEstado({ cargando: false, correo: null });
      return;
    }
    let vivo = true;
    void sb.auth.getSession().then(({ data }) => {
      if (vivo) setEstado({ cargando: false, correo: data.session?.user.email ?? null });
    });
    const { data: sub } = sb.auth.onAuthStateChange((_evento, sesion) => {
      if (vivo) setEstado({ cargando: false, correo: sesion?.user.email ?? null });
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return estado;
}
