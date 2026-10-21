/**
 * El cableado real de `autorizacion.ts`: Supabase de verdad y la cabecera de
 * verdad de la petición que está en curso.
 *
 * Va en un fichero `.server.ts` porque lee la service role key y las cabeceras
 * de la petición. Vite excluye estos ficheros del bundle del navegador.
 *
 * La lógica NO está aquí, está en `autorizacion.ts`, que no importa nada de
 * esto y por eso se puede probar. Aquí solo se enchufan los cables.
 */
import { getRequestHeader } from "@tanstack/react-start/server";

import {
  AccesoDenegado,
  exigirMando,
  exigirPermiso,
  extraerBearer,
  resolverAcceso,
  type Acceso,
  type DepsAutorizacion,
} from "./autorizacion";
import type { AccionId } from "../permisos";
import { getSupabaseServerClient } from "../supabase.server";

/**
 * Las dependencias de verdad.
 *
 * Si no hay Supabase configurado, todo slug se comporta como demo: es el
 * mismo criterio que ya seguía `getSalonProfile`, y es el correcto — sin base
 * de datos no hay salones reales, solo demos, y una demo no pide nada.
 */
function depsReales(): DepsAutorizacion {
  const supabase = getSupabaseServerClient();
  return {
    esSalonReal: async (slug) => {
      if (!supabase) return false;
      const { data, error } = await supabase
        .from("salons")
        .select("slug")
        .eq("slug", slug)
        .maybeSingle();
      if (error) {
        // Fail-closed: si no se puede saber si el salón es real, se lanza y
        // `resolverAcceso` lo trata como ajeno. Devolver false lo habría
        // convertido en "demo", que manda sobre el salón (auditoría 18-oct).
        throw new Error(`esSalonReal: ${error.message}`);
      }
      return Boolean(data);
    },

    tokenDeLaPeticion: () => {
      try {
        return extraerBearer(getRequestHeader("authorization"));
      } catch {
        // Fuera de una petición (por ejemplo, en una prueba) no hay cabeceras.
        return null;
      }
    },

    usuarioDelToken: async (token) => {
      if (!supabase) return null;
      // `getUser(token)` va a Supabase a validar la firma y la caducidad. No
      // se decodifica el token aquí a mano: un token se puede escribir, lo que
      // no se puede es firmarlo.
      const { data, error } = await supabase.auth.getUser(token);
      if (error) return null;
      if (!data.user) return null;
      // Solo se leen claims DESPUÉS de validar la firma con Auth.
      try {
        const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
        if (typeof claims.session_id !== "string") return null;
        const { data: vigente, error: fallo } = await supabase.rpc("sesion_usuario_vigente", {
          usuario: data.user.id, sesion: claims.session_id,
        });
        return !fallo && vigente === true ? data.user.id : null;
      } catch { return null; }
    },

    esMiembro: async (userId, slug) => {
      if (!supabase) return false;
      const { data, error } = await supabase
        .from("salon_members")
        .select("user_id")
        .eq("user_id", userId)
        .eq("salon_slug", slug)
        .maybeSingle();
      if (error) {
        // Incluye el caso "la tabla todavía no existe porque no se ha
        // aplicado supabase/schema.sql". Aquí NO se degrada con elegancia a
        // "pues pasa": sin la tabla no se puede demostrar pertenencia, y sin
        // demostrarla no se entra.
        console.error("esMiembro:", error.message);
        return false;
      }
      return Boolean(data);
    },

    ficha: async (userId, slug) => {
      if (!supabase) return null;
      // Se comprueban rol y estado en cada petición, sin caché de permisos.
      // Una ficha que no se puede leer se rechaza en resolverAcceso.
      const { data, error } = await supabase
        .from("salon_members")
        .select("*")
        .eq("user_id", userId)
        .eq("salon_slug", slug)
        .maybeSingle();
      if (error || !data) return null;
      const f = data as Record<string, unknown>;
      const texto = (k: string) => (typeof f[k] === "string" && f[k] ? (f[k] as string) : null);
      return {
        rol: texto("rol"),
        employeeId: texto("employee_id"),
        displayName: texto("display_name"),
        estado: texto("estado"),
        // `select(*)` mantiene compatibilidad si aún no se aplicó la
        // migración: una columna ausente simplemente llega como undefined.
        permisosExtra: f.permisos_extra,
      };
    },
  };
}

/** Qué es quien llama respecto a este salón. No lanza nunca. */
export function acceso(slug: string): Promise<Acceso> {
  return resolverAcceso(slug, depsReales());
}

/**
 * Lo mismo, pero cortando si no manda sobre el salón. Para todo lo del dueño.
 *
 * Una DEMO no pasa por aquí (A1, auditoría 18-oct-2026): "demo" significa "este
 * slug no existe en salons", y eso no puede dar mando de gerente a quien no
 * tiene sesión. Las demos viven en el navegador y nunca llaman a estas
 * funciones. Quien necesite tratar la demo con un aviso usa `exigirAccesoOdemo`.
 */
export async function exigirAcceso(slug: string): Promise<Acceso> {
  const a = await exigirMando(slug, depsReales());
  if (a.tipo === "demo") throw new AccesoDenegado(slug);
  return a;
}

/** Como `exigirAcceso`, pero deja pasar a la demo para que la función responda "no hago nada". */
export function exigirAccesoOdemo(slug: string): Promise<Acceso> {
  return exigirMando(slug, depsReales());
}

/** Exige además el permiso de la acción (lote 8). `sobreEmployeeId`: la profesional afectada. */
export async function exigirPermisoEn(
  slug: string,
  accion: AccionId,
  sobreEmployeeId?: string | null,
): Promise<Acceso> {
  const a = await exigirPermiso(slug, accion, depsReales(), sobreEmployeeId);
  if (a.tipo === "demo") throw new AccesoDenegado(slug);
  return a;
}

/**
 * El usuario de la sesión que trae la petición, sin mirar ningún salón. Lo
 * usa aceptar una invitación: quien acepta todavía no es miembro.
 */
export async function usuarioDeLaPeticion(): Promise<string | null> {
  const d = depsReales();
  const token = d.tokenDeLaPeticion();
  if (!token) return null;
  try {
    return await d.usuarioDelToken(token);
  } catch {
    return null;
  }
}
