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
  exigirMando,
  extraerBearer,
  resolverAcceso,
  type Acceso,
  type DepsAutorizacion,
} from "./autorizacion";
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
        // Ojo con el criterio: si no se puede saber si el salón es real, se
        // responde que NO lo es. Suena raro, pero es lo seguro aquí: un salón
        // tratado como demo no recibe ningún dato de Supabase, porque quien
        // los sirve es esa misma base de datos que acaba de fallar. Lo que no
        // puede pasar es lo contrario —quedarse sin poder comprobar la
        // pertenencia y aun así servir datos reales.
        console.error("esSalonReal:", error.message);
        return false;
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
      return data.user?.id ?? null;
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
  };
}

/** Qué es quien llama respecto a este salón. No lanza nunca. */
export function acceso(slug: string): Promise<Acceso> {
  return resolverAcceso(slug, depsReales());
}

/** Lo mismo, pero cortando si no manda sobre el salón. Para todo lo del dueño. */
export function exigirAcceso(slug: string): Promise<Acceso> {
  return exigirMando(slug, depsReales());
}
