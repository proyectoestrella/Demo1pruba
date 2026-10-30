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
import { createHash } from "node:crypto";

import { getRequestHeader } from "@tanstack/react-start/server";

import {
  AccesoDenegado,
  exigirMando,
  exigirPermiso,
  extraerBearer,
  resolverAcceso,
  resolverAccesoConMotivo,
  type Acceso,
  type DepsAutorizacion,
  VerificacionNoDisponible,
} from "./autorizacion";
import type { AccionId } from "../permisos";
import { getSupabaseServerClient } from "../supabase.server";

/*
 * Cachés cortas en memoria de la instancia (rendimiento, 21-oct). Cada
 * petición autenticada hacía 5 viajes EN SERIE a Supabase (salón, getUser,
 * sesion_usuario_vigente, membresía y ficha: la misma fila leída dos veces).
 *
 *   - Sesión validada: se recuerda SESION_TTL_MS por hash SHA-256 del token
 *     completo (firma incluida: un token inventado no casa con nada guardado).
 *     Consecuencia aceptada: cerrar sesión en remoto tarda como mucho ese TTL
 *     en cortar el acceso en una instancia que ya la tenía validada.
 *   - Salón real: solo se recuerda el SÍ (SALON_TTL_MS). Un "no" nunca se
 *     guarda: tratar como demo un salón real daría mando a cualquiera.
 *   - Membresía y rol: NO se cachean. Una sola lectura por petición, que
 *     comparten `esMiembro` y `ficha`. Una baja corta los datos al instante.
 */
export const SESION_TTL_MS = 45_000;
export const SALON_TTL_MS = 5 * 60_000;
const MAX_ENTRADAS = 1000;
const sesiones = new Map<string, { userId: string; hasta: number }>();
const salonesReales = new Map<string, number>();

function recordar<V>(m: Map<string, V>, k: string, v: V) {
  if (m.size >= MAX_ENTRADAS) {
    const primera = m.keys().next().value;
    if (primera !== undefined) m.delete(primera);
  }
  m.set(k, v);
}

const huella = (token: string) => createHash("sha256").update(token).digest("hex");

/** Cerrar sesiones desde Accesos: en ESTA instancia surte efecto al momento. */
export function olvidarSesionesDe(userId: string) {
  for (const [k, v] of sesiones) if (v.userId === userId) sesiones.delete(k);
}

/** Vacía las cachés de esta instancia (pruebas). */
export function olvidarCachesDeAutorizacion() {
  sesiones.clear();
  salonesReales.clear();
}

/**
 * Las dependencias de verdad.
 *
 * Si no hay Supabase configurado, todo slug se comporta como demo: es el
 * mismo criterio que ya seguía `getSalonProfile`, y es el correcto — sin base
 * de datos no hay salones reales, solo demos, y una demo no pide nada.
 */
function depsReales(): DepsAutorizacion {
  const supabase = getSupabaseServerClient();
  // La fila de salon_members, leída una vez por petición.
  const filas = new Map<string, Promise<Record<string, unknown> | null>>();
  const fila = (userId: string, slug: string) => {
    const k = `${userId}\u0000${slug}`;
    let p = filas.get(k);
    if (!p) {
      p = (async () => {
        if (!supabase) return null;
        const { data, error } = await supabase
          .from("salon_members")
          .select("*")
          .eq("user_id", userId)
          .eq("salon_slug", slug)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return (data as Record<string, unknown> | null) ?? null;
      })();
      filas.set(k, p);
    }
    return p;
  };
  return {
    esSalonReal: async (slug) => {
      if (!supabase) return false;
      const hasta = salonesReales.get(slug);
      if (hasta && hasta > Date.now()) return true;
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
      if (data) recordar(salonesReales, slug, Date.now() + SALON_TTL_MS);
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
      const h = huella(token);
      const guardada = sesiones.get(h);
      if (guardada && guardada.hasta > Date.now()) return guardada.userId;
      // `getUser(token)` va a Supabase a validar la firma y la caducidad. No
      // se decodifica el token aquí a mano: un token se puede escribir, lo que
      // no se puede es firmarlo.
      const { data, error } = await supabase.auth.getUser(token);
      if (error) {
        // 4xx (salvo 429): Supabase dice que el token no vale (caducado,
        // sesión borrada) → sin sesión. Red caída, 5xx o 429: no se sabe, y
        // no es lo mismo que una baja.
        const st = (error as { status?: number }).status;
        if (typeof st === "number" && st >= 400 && st < 500 && st !== 429) return null;
        throw new VerificacionNoDisponible(`getUser: ${error.message}`);
      }
      if (!data.user) return null;
      // Solo se leen claims DESPUÉS de validar la firma con Auth.
      try {
        const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
        if (typeof claims.session_id !== "string") return null;
        const { data: vigente, error: fallo } = await supabase.rpc("sesion_usuario_vigente", {
          usuario: data.user.id, sesion: claims.session_id,
        });
        if (fallo) throw new VerificacionNoDisponible(`sesion_usuario_vigente: ${fallo.message}`);
        if (vigente !== true) return null;
        // Nunca más allá de la caducidad del propio token.
        const exp = typeof claims.exp === "number" ? claims.exp * 1000 : 0;
        const hasta = Math.min(Date.now() + SESION_TTL_MS, exp || Date.now() + SESION_TTL_MS);
        recordar(sesiones, h, { userId: data.user.id, hasta });
        return data.user.id;
      } catch (err) { if (err instanceof VerificacionNoDisponible) throw err; return null; }
    },

    esMiembro: async (userId, slug) => {
      if (!supabase) return false;
      try {
        return Boolean(await fila(userId, slug));
      } catch (err) {
        // Incluye el caso "la tabla todavía no existe porque no se ha
        // aplicado supabase/schema.sql". Aquí NO se degrada con elegancia a
        // "pues pasa": sin la tabla no se puede demostrar pertenencia, y sin
        // demostrarla no se entra.
        console.error("esMiembro:", err instanceof Error ? err.message : err);
        // Se lanza (no `false`): «no se pudo leer» no es «ya no es miembro».
        // `resolverAccesoConMotivo` lo traduce a `no_verificable` (sigue sin
        // dar acceso, pero el cliente no lo toma por una baja).
        throw new VerificacionNoDisponible("esMiembro");
      }
    },

    ficha: async (userId, slug) => {
      if (!supabase) return null;
      // Se comprueban rol y estado en cada petición, sin caché de permisos
      // entre peticiones (la fila es la misma que acaba de leer esMiembro).
      // Una ficha que no se puede leer se rechaza en resolverAcceso.
      let f: Record<string, unknown> | null;
      try { f = await fila(userId, slug); } catch { return null; }
      if (!f) return null;
      const texto = (k: string) => (typeof f![k] === "string" && f![k] ? (f![k] as string) : null);
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

/** Como `acceso`, con el motivo de la negativa (solo lo usa `accesoAlPanel`). */
export function accesoConMotivo(slug: string) {
  return resolverAccesoConMotivo(slug, depsReales());
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
