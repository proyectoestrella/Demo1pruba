/**
 * El cableado real del módulo de calendarios externos: Supabase de verdad,
 * `fetch` de verdad, cifrado de verdad. La lógica vive en los ficheros puros
 * de al lado (`servicio-sincronizacion.ts`, `mapeo-eventos.ts`, `google-*.ts`,
 * `apple-caldav.ts`); aquí solo se enchufan. Mismo criterio que
 * `autorizacion.server.ts` / `autorizacion.ts`.
 *
 * Lo llaman `src/lib/api/calendario-externo.functions.ts` (con permisos ya
 * comprobados) y las rutas `src/routes/api.calendario-externo.*` (callback,
 * webhook, cron).
 */
import { randomUUID } from "node:crypto";
import { getSupabaseServerClient } from "../supabase.server";
import { getConfigCalendarios } from "../config.server";
import { cifrarCredencial, descifrarCredencial } from "./cifrado";
import {
  CalDAVNoDisponible,
  CredencialCalDAVInvalida,
  borrarEventoCalDAV,
  descubrirCalendarioPrincipal,
  guardarEvento,
  leerCtag,
  leerEvento,
  listarRecursos,
  type CredencialCalDAV,
} from "./apple-caldav";
import {
  EventoGoogleNoExiste,
  actualizarEvento as actualizarEventoGoogle,
  borrarEvento as borrarEventoGoogle,
  comoEventoExternoListado,
  crearEvento as crearEventoGoogle,
  iniciarWatch,
  listarEventosIncremental,
  pararWatch,
} from "./google-calendar";
import {
  codificarEstado,
  correoDeLaCuenta,
  decodificarEstado,
  intercambiarCodigo,
  refrescarToken,
  urlDeAutorizacion,
  type ConfigGoogle,
} from "./google-oauth";
import { citaIdDeIcs, eventoGoogleDeCita, fechasDeIcs, icsDeCita, resumenDeIcs } from "./mapeo-eventos";
import {
  diffBloqueosExternos,
  sincronizarCitaSaliente,
  type AdaptadorCalendario,
  type DepsMapeo,
  type DiffBloqueos,
  type EventoExternoListado,
  type ResultadoSincronizacion,
} from "./servicio-sincronizacion";
import type {
  BloqueoExterno,
  CitaParaCalendario,
  ConexionCalendario,
  Credencial,
  CredencialApple,
  CredencialGoogle,
  EstadoConexion,
  MapeoEvento,
  OcupadoExterno,
  ProveedorCalendario,
  ResultadoConexionApple,
} from "./tipos";

type Supabase = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

function requerirDb(): Supabase {
  const db = getSupabaseServerClient();
  if (!db) throw new Error("Calendarios externos no disponible (falta configurar Supabase).");
  return db;
}

/** Mismo criterio que `faltaEsquema` en salons.functions.ts: la tabla puede no estar aplicada aún. */
function tablaNoExiste(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (["PGRST204", "PGRST205", "42703", "42P01"].includes(error.code ?? "")) return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("could not find") || msg.includes("schema cache");
}

// -----------------------------------------------------------------------
// Filas ↔ tipos
// -----------------------------------------------------------------------

interface FilaConexion {
  id: string;
  salon_slug: string;
  employee_id: string | null;
  proveedor: ProveedorCalendario;
  estado: EstadoConexion;
  credencial_cifrada: string;
  cuenta: string | null;
  calendario_externo_id: string | null;
  calendario_nombre: string | null;
  sync_token: string | null;
  ctag: string | null;
  canal_watch_id: string | null;
  canal_recurso_id: string | null;
  canal_caduca: string | null;
  ultimo_error: string | null;
  ultimo_error_en: string | null;
  ultima_sincronizacion: string | null;
  bloquear_huecos: boolean;
  escribir_citas: boolean;
  creada: string;
  actualizada: string;
}

function filaAConexion(f: FilaConexion): ConexionCalendario {
  return {
    id: f.id,
    salonSlug: f.salon_slug,
    employeeId: f.employee_id,
    proveedor: f.proveedor,
    estado: f.estado,
    cuenta: f.cuenta,
    calendarioExternoId: f.calendario_externo_id,
    calendarioNombre: f.calendario_nombre,
    syncToken: f.sync_token,
    ctag: f.ctag,
    canalWatchId: f.canal_watch_id,
    canalRecursoId: f.canal_recurso_id,
    canalCaduca: f.canal_caduca,
    ultimoError: f.ultimo_error,
    ultimoErrorEn: f.ultimo_error_en,
    ultimaSincronizacion: f.ultima_sincronizacion,
    bloquearHuecos: f.bloquear_huecos,
    escribirCitas: f.escribir_citas,
    creada: f.creada,
    actualizada: f.actualizada,
  };
}

function filaABloqueo(f: { conexion_id: string; salon_slug: string; employee_id: string | null; evento_externo_id: string; start_at: string; end_at: string; resumen: string | null }): BloqueoExterno {
  return { conexionId: f.conexion_id, salonSlug: f.salon_slug, employeeId: f.employee_id, eventoExternoId: f.evento_externo_id, startAt: f.start_at, endAt: f.end_at, resumen: f.resumen };
}

function filaAMapeo(f: { id: string; conexion_id: string; cita_id: string; evento_externo_id: string; etag: string | null; ical_uid: string }): MapeoEvento {
  return { id: f.id, conexionId: f.conexion_id, citaId: f.cita_id, eventoExternoId: f.evento_externo_id, etag: f.etag, icalUid: f.ical_uid };
}

// -----------------------------------------------------------------------
// Lectura de conexiones (para el panel)
// -----------------------------------------------------------------------

/** Una conexión concreta (para comprobar de quién es antes de dejar tocarla — nunca te fíes del `employeeId` que manda el navegador). */
export async function obtenerConexion(salonSlug: string, conexionId: string): Promise<ConexionCalendario | null> {
  const db = getSupabaseServerClient();
  if (!db) return null;
  const { data, error } = await db.from("calendario_conexiones").select("*").eq("id", conexionId).eq("salon_slug", salonSlug).maybeSingle();
  if (error) {
    if (tablaNoExiste(error)) return null;
    throw new Error(`calendario-externo (obtener conexión): ${error.message}`);
  }
  return data ? filaAConexion(data as FilaConexion) : null;
}

export async function listarConexiones(salonSlug: string): Promise<ConexionCalendario[]> {
  const db = getSupabaseServerClient();
  if (!db) return [];
  const { data, error } = await db.from("calendario_conexiones").select("*").eq("salon_slug", salonSlug).order("creada");
  if (error) {
    if (tablaNoExiste(error)) return [];
    throw new Error(`calendario-externo (listar): ${error.message}`);
  }
  return ((data ?? []) as FilaConexion[]).map(filaAConexion);
}

async function buscarConexionExistente(db: Supabase, salonSlug: string, employeeId: string | null, proveedor: ProveedorCalendario): Promise<string | undefined> {
  let q = db.from("calendario_conexiones").select("id").eq("salon_slug", salonSlug).eq("proveedor", proveedor);
  q = employeeId === null ? q.is("employee_id", null) : q.eq("employee_id", employeeId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`calendario-externo (buscar conexión): ${error.message}`);
  return (data as { id: string } | null)?.id;
}

/** Inserta o actualiza (búsqueda manual, no ON CONFLICT: la unicidad es sobre una expresión con `coalesce`). */
async function guardarConexion(
  db: Supabase,
  salonSlug: string,
  employeeId: string | null,
  proveedor: ProveedorCalendario,
  campos: Record<string, unknown>,
): Promise<string> {
  const existenteId = await buscarConexionExistente(db, salonSlug, employeeId, proveedor);
  if (existenteId) {
    const { error } = await db.from("calendario_conexiones").update(campos).eq("id", existenteId);
    if (error) throw new Error(`calendario-externo (actualizar conexión): ${error.message}`);
    return existenteId;
  }
  const { data, error } = await db
    .from("calendario_conexiones")
    .insert({ salon_slug: salonSlug, employee_id: employeeId, proveedor, ...campos })
    .select("id")
    .single();
  if (error) throw new Error(`calendario-externo (crear conexión): ${error.message}`);
  return (data as { id: string }).id;
}

// -----------------------------------------------------------------------
// Google: iniciar y completar el OAuth
// -----------------------------------------------------------------------

function configGoogleOCorta(): ConfigGoogle {
  const cfg = getConfigCalendarios();
  if (!cfg.googleClientId || !cfg.googleClientSecret || !cfg.googleRedirectUri) {
    throw new Error("Falta configurar Google Calendar (GOOGLE_CALENDAR_CLIENT_ID/SECRET/REDIRECT_URI). Ver docs/pruebas-calendario-para-tomas.md.");
  }
  return { clientId: cfg.googleClientId, clientSecret: cfg.googleClientSecret, redirectUri: cfg.googleRedirectUri };
}

function claveCifradoOCorta(): string {
  const cfg = getConfigCalendarios();
  if (!cfg.claveCifrado) throw new Error("Falta configurar CALENDARIO_CLAVE_CIFRADO.");
  return cfg.claveCifrado;
}

export function iniciarConexionGoogle(args: { salonSlug: string; employeeId: string | null; userId: string }): { url: string } {
  const config = configGoogleOCorta();
  const state = codificarEstado({ salonSlug: args.salonSlug, employeeId: args.employeeId, userId: args.userId }, claveCifradoOCorta());
  return { url: urlDeAutorizacion(config, state) };
}

export interface ResultadoCallbackGoogle {
  ok: boolean;
  salonSlug?: string;
  error?: string;
}

/** Llamado por la ruta de callback (navegación real del navegador, sin sesión: la autorización viaja en `state`). */
export async function completarConexionGoogle(code: string, state: string): Promise<ResultadoCallbackGoogle> {
  let config: ConfigGoogle;
  let clave: string;
  try {
    config = configGoogleOCorta();
    clave = claveCifradoOCorta();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const estado = decodificarEstado(state, clave);
  if (!estado) return { ok: false, error: "El enlace de conexión ha caducado o no es válido. Vuelve a intentarlo desde el panel." };

  let tokens;
  try {
    tokens = await intercambiarCodigo(config, code);
  } catch (err) {
    console.error("calendario-externo (intercambio Google):", err);
    return { ok: false, salonSlug: estado.salonSlug, error: "Google no ha podido confirmar la conexión. Vuelve a intentarlo." };
  }
  if (!tokens.refreshToken) {
    return {
      ok: false,
      salonSlug: estado.salonSlug,
      error: "Google no ha dado un permiso permanente (puede pasar si ya lo habías conectado antes). Quita el acceso de siShow en tu cuenta de Google y vuelve a intentarlo.",
    };
  }
  const cuenta = await correoDeLaCuenta(tokens.accessToken).catch(() => null);
  const db = requerirDb();
  const credencial: CredencialGoogle = { tipo: "google", refreshToken: tokens.refreshToken, cuenta: cuenta ?? "" };
  const conexionId = await guardarConexion(db, estado.salonSlug, estado.employeeId, "google", {
    estado: "activa",
    credencial_cifrada: cifrarCredencial(credencial, clave),
    cuenta,
    calendario_externo_id: "primary",
    calendario_nombre: cuenta,
    ultimo_error: null,
    ultimo_error_en: null,
    creado_por: estado.userId,
    actualizada: new Date().toISOString(),
  });

  // Watch de Google: mejor esfuerzo. Sin URL pública (dev local) o si falla,
  // el polling de respaldo del cron lo cubre igual, más lento.
  const cfg = getConfigCalendarios();
  if (cfg.siteUrl) {
    try {
      const canal = await iniciarWatch(tokens.accessToken, "primary", {
        canalId: randomUUID(),
        address: `${cfg.siteUrl}/api/calendario-externo/google/webhook`,
      });
      await db
        .from("calendario_conexiones")
        .update({
          canal_watch_id: canal.id,
          canal_recurso_id: canal.resourceId,
          canal_caduca: canal.expirationMs ? new Date(canal.expirationMs).toISOString() : null,
        })
        .eq("id", conexionId);
    } catch (err) {
      console.error("calendario-externo (watch inicial):", err);
    }
  }
  return { ok: true, salonSlug: estado.salonSlug };
}

// -----------------------------------------------------------------------
// Apple
// -----------------------------------------------------------------------

export const MENSAJE_APPLE_CREDENCIALES =
  "No hemos podido entrar con esos datos. Revisa el Apple ID y que la contraseña sea la de aplicación, no la normal.";
export const MENSAJE_APPLE_SIN_CALENDARIO = "No hemos encontrado un calendario en esa cuenta de iCloud.";
export const MENSAJE_APPLE_NO_DISPONIBLE = "iCloud no ha respondido. Inténtalo de nuevo en un momento.";

export async function conectarApple(args: {
  salonSlug: string;
  employeeId: string | null;
  appleId: string;
  appPassword: string;
  userId: string;
}): Promise<ResultadoConexionApple> {
  let clave: string;
  try {
    clave = claveCifradoOCorta();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const cfg = getConfigCalendarios();
  const cred: CredencialCalDAV = { appleId: args.appleId, appPassword: args.appPassword, baseUrl: cfg.appleBaseUrl };
  let calendario;
  try {
    calendario = await descubrirCalendarioPrincipal(cred);
  } catch (err) {
    if (err instanceof CredencialCalDAVInvalida) return { ok: false, error: MENSAJE_APPLE_CREDENCIALES };
    if (err instanceof CalDAVNoDisponible) return { ok: false, error: MENSAJE_APPLE_NO_DISPONIBLE };
    console.error("calendario-externo (descubrir Apple):", err);
    return { ok: false, error: MENSAJE_APPLE_NO_DISPONIBLE };
  }
  if (!calendario) return { ok: false, error: MENSAJE_APPLE_SIN_CALENDARIO };

  const db = requerirDb();
  const credencial: CredencialApple = { tipo: "apple", appleId: args.appleId, appPassword: args.appPassword };
  try {
    await guardarConexion(db, args.salonSlug, args.employeeId, "apple", {
      estado: "activa",
      credencial_cifrada: cifrarCredencial(credencial, clave),
      cuenta: null, // Apple no se enseña en el panel (solo Google): ver docs/contrato-calendarios.md §1.
      calendario_externo_id: calendario.href,
      calendario_nombre: calendario.displayName,
      ctag: calendario.ctag,
      ultimo_error: null,
      ultimo_error_en: null,
      creado_por: args.userId,
      actualizada: new Date().toISOString(),
    });
  } catch (err) {
    console.error("calendario-externo (guardar Apple):", err);
    return { ok: false, error: "No se ha podido guardar la conexión. Inténtalo de nuevo." };
  }
  return { ok: true };
}

// -----------------------------------------------------------------------
// Desconectar y ajustar
// -----------------------------------------------------------------------

/** Borra la fila y su credencial cifrada. No borra los eventos que ya se hubieran escrito fuera. */
export async function desconectarCalendario(salonSlug: string, conexionId: string): Promise<{ ok: true }> {
  const db = requerirDb();
  const { data, error } = await db.from("calendario_conexiones").select("*").eq("id", conexionId).eq("salon_slug", salonSlug).maybeSingle();
  if (error) throw new Error(`calendario-externo (desconectar): ${error.message}`);
  const fila = data as FilaConexion | null;
  if (fila?.proveedor === "google" && fila.canal_watch_id && fila.canal_recurso_id) {
    try {
      const clave = claveCifradoOCorta();
      const config = configGoogleOCorta();
      const credencial = descifrarCredencial<CredencialGoogle>(fila.credencial_cifrada, clave);
      const { accessToken } = await refrescarToken(config, credencial.refreshToken);
      await pararWatch(accessToken, { id: fila.canal_watch_id, resourceId: fila.canal_recurso_id });
    } catch (err) {
      console.error("calendario-externo (parar watch al desconectar):", err);
    }
  }
  const { error: errorBorrar } = await db.from("calendario_conexiones").delete().eq("id", conexionId).eq("salon_slug", salonSlug);
  if (errorBorrar) throw new Error(`calendario-externo (desconectar): ${errorBorrar.message}`);
  return { ok: true };
}

export async function ajustarConexionCalendario(
  salonSlug: string,
  conexionId: string,
  cambios: { bloquearHuecos?: boolean; escribirCitas?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = requerirDb();
  const patch: Record<string, unknown> = { actualizada: new Date().toISOString() };
  if (cambios.bloquearHuecos !== undefined) patch.bloquear_huecos = cambios.bloquearHuecos;
  if (cambios.escribirCitas !== undefined) patch.escribir_citas = cambios.escribirCitas;
  const { error } = await db.from("calendario_conexiones").update(patch).eq("id", conexionId).eq("salon_slug", salonSlug);
  if (error) return { ok: false, error: "No se ha podido guardar el cambio. Inténtalo de nuevo." };
  if (cambios.bloquearHuecos === false) {
    const { error: errorLimpiar } = await db.from("calendario_bloqueos_externos").delete().eq("conexion_id", conexionId);
    if (errorLimpiar) console.error("calendario-externo (limpiar bloqueos al apagar):", errorLimpiar.message);
  }
  return { ok: true };
}

// -----------------------------------------------------------------------
// Lo ocupado por lo externo, para la reserva y para pintar en el panel
// -----------------------------------------------------------------------

export async function listarOcupadoExterno(
  salonSlug: string,
  desdeISO: string,
  hastaISO: string,
  alcance: { todo: boolean; miEmployeeId: string | null },
): Promise<OcupadoExterno[]> {
  const db = getSupabaseServerClient();
  if (!db) return [];
  const { data, error } = await db
    .from("calendario_bloqueos_externos")
    .select("employee_id, start_at, end_at, calendario_conexiones(proveedor)")
    .eq("salon_slug", salonSlug)
    .lt("start_at", hastaISO)
    .gt("end_at", desdeISO);
  if (error) {
    if (tablaNoExiste(error)) return [];
    console.error("calendario-externo (listar ocupado):", error.message);
    return [];
  }
  type Fila = { employee_id: string | null; start_at: string; end_at: string; calendario_conexiones: { proveedor: ProveedorCalendario } | { proveedor: ProveedorCalendario }[] | null };
  let filas = (data ?? []) as Fila[];
  if (!alcance.todo) {
    filas = filas.filter((f) => f.employee_id === null || f.employee_id === alcance.miEmployeeId);
  }
  return filas.map((f) => {
    const rel = Array.isArray(f.calendario_conexiones) ? f.calendario_conexiones[0] : f.calendario_conexiones;
    return { employeeId: f.employee_id, inicio: f.start_at, fin: f.end_at, proveedor: rel?.proveedor ?? "google" };
  });
}

/** ¿Hay algo ocupado por lo externo en esta ventana, para esta profesional? Usado por `syncAppointment`. */
export async function hayOcupadoExternoEnHueco(salonSlug: string, employeeId: string, startISO: string, endISO: string): Promise<boolean> {
  const db = getSupabaseServerClient();
  if (!db) return false;
  const { data, error } = await db
    .from("calendario_bloqueos_externos")
    .select("id")
    .eq("salon_slug", salonSlug)
    .or(`employee_id.eq.${employeeId},employee_id.is.null`)
    .lt("start_at", endISO)
    .gt("end_at", startISO)
    .limit(1);
  if (error) {
    if (tablaNoExiste(error)) return false;
    console.error("calendario-externo (comprobar hueco):", error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

// -----------------------------------------------------------------------
// Salida: llevar una cita de siShow al calendario externo
// -----------------------------------------------------------------------

function depsMapeo(db: Supabase): DepsMapeo {
  return {
    async obtenerMapeo(conexionId, citaId) {
      const { data, error } = await db.from("calendario_mapeo_eventos").select("*").eq("conexion_id", conexionId).eq("cita_id", citaId).maybeSingle();
      if (error) throw new Error(`calendario-externo (obtener mapeo): ${error.message}`);
      return data ? filaAMapeo(data as Parameters<typeof filaAMapeo>[0]) : null;
    },
    async guardarMapeo(m) {
      const existente = await db.from("calendario_mapeo_eventos").select("id").eq("conexion_id", m.conexionId).eq("cita_id", m.citaId).maybeSingle();
      if (existente.error) throw new Error(`calendario-externo (guardar mapeo): ${existente.error.message}`);
      const fila = { conexion_id: m.conexionId, cita_id: m.citaId, evento_externo_id: m.eventoExternoId, etag: m.etag, ical_uid: m.icalUid, actualizado: new Date().toISOString() };
      const { error } = existente.data
        ? await db.from("calendario_mapeo_eventos").update(fila).eq("id", (existente.data as { id: string }).id)
        : await db.from("calendario_mapeo_eventos").insert(fila);
      if (error) throw new Error(`calendario-externo (guardar mapeo): ${error.message}`);
    },
    async borrarMapeo(conexionId, citaId) {
      const { error } = await db.from("calendario_mapeo_eventos").delete().eq("conexion_id", conexionId).eq("cita_id", citaId);
      if (error) throw new Error(`calendario-externo (borrar mapeo): ${error.message}`);
    },
  };
}

function adaptadorGoogle(fila: FilaConexion, credencial: CredencialGoogle): AdaptadorCalendario {
  const calendarId = fila.calendario_externo_id ?? "primary";
  const config = configGoogleOCorta();
  async function accessToken(): Promise<string> {
    return (await refrescarToken(config, credencial.refreshToken)).accessToken;
  }
  return {
    async crear(cita: CitaParaCalendario) {
      const token = await accessToken();
      const r = await crearEventoGoogle(token, calendarId, eventoGoogleDeCita(cita));
      return { eventoExternoId: r.id, etag: null };
    },
    async actualizar(eventoExternoId, _etag, cita) {
      const token = await accessToken();
      try {
        await actualizarEventoGoogle(token, calendarId, eventoExternoId, eventoGoogleDeCita(cita));
        return { eventoExternoId, etag: null };
      } catch (err) {
        if (err instanceof EventoGoogleNoExiste) return "no-existe";
        throw err;
      }
    },
    async borrar(eventoExternoId) {
      const token = await accessToken();
      await borrarEventoGoogle(token, calendarId, eventoExternoId);
    },
  };
}

function adaptadorApple(fila: FilaConexion, credencial: CredencialApple): AdaptadorCalendario {
  const cfg = getConfigCalendarios();
  const cred: CredencialCalDAV = { appleId: credencial.appleId, appPassword: credencial.appPassword, baseUrl: cfg.appleBaseUrl };
  const calendarHref = fila.calendario_externo_id ?? "/";
  function hrefDeCita(citaId: string): string {
    const base = calendarHref.endsWith("/") ? calendarHref : `${calendarHref}/`;
    return `${base}sishow-${citaId}.ics`;
  }
  return {
    async crear(cita) {
      const href = hrefDeCita(cita.id);
      const r = await guardarEvento(cred, href, icsDeCita(cita), null);
      return { eventoExternoId: href, etag: r.etag };
    },
    async actualizar(eventoExternoId, etag, cita) {
      const r = await guardarEvento(cred, eventoExternoId, icsDeCita(cita), etag);
      return { eventoExternoId, etag: r.etag };
    },
    async borrar(eventoExternoId, etag) {
      await borrarEventoCalDAV(cred, eventoExternoId, etag);
    },
  };
}

function adaptadorParaConexion(fila: FilaConexion, credencial: Credencial): AdaptadorCalendario {
  return credencial.tipo === "google" ? adaptadorGoogle(fila, credencial) : adaptadorApple(fila, credencial);
}

/**
 * Lleva una cita (creada, movida o cancelada) a todas las conexiones que
 * apliquen: la propia de la profesional Y la del salón entero, si la hay.
 * NUNCA lanza: un fallo del calendario externo no puede tirar la reserva.
 * Cada conexión que falle queda marcada en `estado: 'error'` con el motivo.
 */
export async function procesarCitaParaConexiones(salonSlug: string, cita: CitaParaCalendario, accion: "upsert" | "borrar"): Promise<void> {
  const db = getSupabaseServerClient();
  if (!db) return;
  let filas: FilaConexion[];
  try {
    const { data, error } = await db
      .from("calendario_conexiones")
      .select("*")
      .eq("salon_slug", salonSlug)
      .eq("estado", "activa")
      .or(`employee_id.eq.${cita.employeeId},employee_id.is.null`);
    if (error) {
      if (tablaNoExiste(error)) return;
      console.error("calendario-externo (conexiones para cita):", error.message);
      return;
    }
    filas = (data ?? []) as FilaConexion[];
  } catch (err) {
    console.error("calendario-externo (conexiones para cita):", err);
    return;
  }
  const clave = getConfigCalendarios().claveCifrado;
  if (!clave) return; // sin clave no se puede ni descifrar: no tiene sentido seguir.

  for (const fila of filas) {
    let resultado: ResultadoSincronizacion;
    try {
      const credencial = descifrarCredencial<Credencial>(fila.credencial_cifrada, clave);
      const adaptador = adaptadorParaConexion(fila, credencial);
      resultado = await sincronizarCitaSaliente(cita, accion, { id: fila.id, escribirCitas: fila.escribir_citas }, adaptador, depsMapeo(db));
    } catch (err) {
      resultado = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    try {
      if (resultado.ok) {
        await db.from("calendario_conexiones").update({ estado: "activa", ultimo_error: null, ultimo_error_en: null, ultima_sincronizacion: new Date().toISOString() }).eq("id", fila.id);
      } else {
        console.error(`calendario-externo (sync saliente, conexión ${fila.id}):`, resultado.error);
        await db.from("calendario_conexiones").update({ estado: "error", ultimo_error: resultado.error, ultimo_error_en: new Date().toISOString() }).eq("id", fila.id);
      }
    } catch (err) {
      console.error("calendario-externo (marcar resultado):", err);
    }
  }
}

// -----------------------------------------------------------------------
// Entrada: leer lo que ha cambiado en el calendario externo
// -----------------------------------------------------------------------

async function aplicarDiffBloqueos(db: Supabase, conexionId: string, diff: DiffBloqueos): Promise<void> {
  for (const c of diff.aCrear) {
    const { error } = await db
      .from("calendario_bloqueos_externos")
      .upsert(
        { conexion_id: conexionId, salon_slug: c.salonSlug, employee_id: c.employeeId, evento_externo_id: c.eventoExternoId, start_at: c.startAt, end_at: c.endAt, resumen: c.resumen },
        { onConflict: "conexion_id,evento_externo_id" },
      );
    if (error) console.error("calendario-externo (crear bloqueo):", error.message);
  }
  for (const a of diff.aActualizar) {
    const { error } = await db
      .from("calendario_bloqueos_externos")
      .update({ start_at: a.startAt, end_at: a.endAt, resumen: a.resumen, actualizado: new Date().toISOString() })
      .eq("conexion_id", conexionId)
      .eq("evento_externo_id", a.eventoExternoId);
    if (error) console.error("calendario-externo (actualizar bloqueo):", error.message);
  }
  if (diff.aBorrar.length) {
    const { error } = await db.from("calendario_bloqueos_externos").delete().eq("conexion_id", conexionId).in("evento_externo_id", diff.aBorrar);
    if (error) console.error("calendario-externo (borrar bloqueo):", error.message);
  }
}

async function previosDe(db: Supabase, conexionId: string): Promise<BloqueoExterno[]> {
  const { data, error } = await db.from("calendario_bloqueos_externos").select("*").eq("conexion_id", conexionId);
  if (error) {
    console.error("calendario-externo (leer bloqueos previos):", error.message);
    return [];
  }
  return (data ?? []).map(filaABloqueo);
}

async function sincronizarGoogleEntrante(db: Supabase, fila: FilaConexion, credencial: CredencialGoogle): Promise<Partial<FilaConexion>> {
  const config = configGoogleOCorta();
  const { accessToken } = await refrescarToken(config, credencial.refreshToken);
  const calendarId = fila.calendario_externo_id ?? "primary";

  // Renovar el canal watch si está a menos de 6h de caducar (o no hay).
  const cfg = getConfigCalendarios();
  const caduca = fila.canal_caduca ? Date.parse(fila.canal_caduca) : 0;
  const patch: Partial<FilaConexion> = {};
  if (cfg.siteUrl && (!caduca || caduca - Date.now() < 6 * 60 * 60_000)) {
    try {
      const canal = await iniciarWatch(accessToken, calendarId, { canalId: randomUUID(), address: `${cfg.siteUrl}/api/calendario-externo/google/webhook` });
      patch.canal_watch_id = canal.id;
      patch.canal_recurso_id = canal.resourceId;
      patch.canal_caduca = canal.expirationMs ? new Date(canal.expirationMs).toISOString() : null;
    } catch (err) {
      console.error("calendario-externo (renovar watch):", err);
    }
  }

  let resultado = await listarEventosIncremental(accessToken, calendarId, fila.sync_token);
  if (resultado.necesitaResync) {
    await db.from("calendario_bloqueos_externos").delete().eq("conexion_id", fila.id);
    resultado = await listarEventosIncremental(accessToken, calendarId, null);
    if (resultado.necesitaResync) throw new Error("Google no ha podido completar la sincronización.");
  }
  const eventos: EventoExternoListado[] = resultado.items.map(comoEventoExternoListado);
  const previos = await previosDe(db, fila.id);
  const diff = diffBloqueosExternos(eventos, previos, fila.salon_slug, fila.employee_id, fila.bloquear_huecos);
  await aplicarDiffBloqueos(db, fila.id, diff);
  patch.sync_token = resultado.nextSyncToken;
  return patch;
}

async function sincronizarAppleEntrante(db: Supabase, fila: FilaConexion, credencial: CredencialApple): Promise<Partial<FilaConexion>> {
  const cfg = getConfigCalendarios();
  const cred: CredencialCalDAV = { appleId: credencial.appleId, appPassword: credencial.appPassword, baseUrl: cfg.appleBaseUrl };
  const calendarHref = fila.calendario_externo_id;
  if (!calendarHref) throw new Error("Conexión de Apple sin calendario descubierto.");

  const ctagActual = await leerCtag(cred, calendarHref);
  if (fila.ctag !== null && ctagActual === fila.ctag) return {}; // nada cambió

  const recursos = await listarRecursos(cred, calendarHref);
  const eventos: EventoExternoListado[] = [];
  for (const r of recursos) {
    const ics = await leerEvento(cred, r.href);
    const citaIdPropio = citaIdDeIcs(ics);
    const fechas = fechasDeIcs(ics);
    eventos.push({ eventoExternoId: r.href, intervalo: fechas ? { start: fechas.start, end: fechas.end } : null, resumen: resumenDeIcs(ics), citaIdPropio });
    // Autocuración del ETag de nuestros propios eventos: si Apple lo cambió
    // (p. ej. la profesional lo tocó y lo deshizo), refrescarlo aquí evita
    // que la próxima escritura falle con un conflicto de ETag evitable.
    if (citaIdPropio) {
      await db.from("calendario_mapeo_eventos").update({ etag: r.etag }).eq("conexion_id", fila.id).eq("cita_id", citaIdPropio).neq("etag", r.etag);
    }
  }
  const previos = await previosDe(db, fila.id);
  const diff = diffBloqueosExternos(eventos, previos, fila.salon_slug, fila.employee_id, fila.bloquear_huecos);
  await aplicarDiffBloqueos(db, fila.id, diff);
  return { ctag: ctagActual };
}

/** Sincroniza UNA conexión (llamado desde el webhook de Google o desde el polling del cron). Nunca lanza. */
export async function sincronizarConexionEntrante(fila: FilaConexion): Promise<boolean> {
  const db = requerirDb();
  const clave = getConfigCalendarios().claveCifrado;
  if (!clave) return false;
  try {
    const credencial = descifrarCredencial<Credencial>(fila.credencial_cifrada, clave);
    const patch = credencial.tipo === "google" ? await sincronizarGoogleEntrante(db, fila, credencial) : await sincronizarAppleEntrante(db, fila, credencial);
    await db
      .from("calendario_conexiones")
      .update({ ...patch, estado: "activa", ultimo_error: null, ultimo_error_en: null, ultima_sincronizacion: new Date().toISOString() })
      .eq("id", fila.id);
    return true;
  } catch (err) {
    console.error(`calendario-externo (sync entrante, conexión ${fila.id}):`, err);
    try {
      await db
        .from("calendario_conexiones")
        .update({ estado: "error", ultimo_error: err instanceof Error ? err.message : String(err), ultimo_error_en: new Date().toISOString() })
        .eq("id", fila.id);
    } catch (err2) {
      console.error("calendario-externo (marcar error de sync entrante):", err2);
    }
    return false;
  }
}

/** Recibe el ping de un canal watch de Google ("algo ha cambiado, ve a mirar"). */
export async function procesarNotificacionGoogle(canalId: string): Promise<void> {
  const db = getSupabaseServerClient();
  if (!db || !canalId) return;
  const { data, error } = await db.from("calendario_conexiones").select("*").eq("canal_watch_id", canalId).eq("proveedor", "google").maybeSingle();
  if (error || !data) return;
  await sincronizarConexionEntrante(data as FilaConexion);
}

/** El polling de respaldo (cron cada 5 min): TODAS las conexiones activas, Google incluida (el watch puede fallar). */
export async function sincronizarPollingDeRespaldo(): Promise<{ procesadas: number; errores: number }> {
  const db = getSupabaseServerClient();
  if (!db) return { procesadas: 0, errores: 0 };
  const { data, error } = await db.from("calendario_conexiones").select("*").eq("estado", "activa");
  if (error) {
    if (tablaNoExiste(error)) return { procesadas: 0, errores: 0 };
    console.error("calendario-externo (polling):", error.message);
    return { procesadas: 0, errores: 1 };
  }
  const filas = (data ?? []) as FilaConexion[];
  let errores = 0;
  for (const fila of filas) {
    const ok = await sincronizarConexionEntrante(fila);
    if (!ok) errores += 1;
  }
  return { procesadas: filas.length, errores };
}
