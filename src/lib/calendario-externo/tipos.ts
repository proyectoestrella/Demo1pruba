/**
 * Tipos compartidos del módulo de calendarios externos (lote 13).
 *
 * Puro: sin Supabase, sin `fetch`, sin `node:crypto`. Lo importan tanto la
 * capa de dominio (google-*, apple-caldav, servicio-sincronizacion) como la
 * capa de API (`src/lib/api/calendario-externo.functions.ts`).
 */

export type ProveedorCalendario = "google" | "apple";
export type EstadoConexion = "activa" | "error" | "desconectada";

/** Una fila de `calendario_conexiones`, ya con la credencial DESCIFRADA. */
export interface ConexionCalendario {
  id: string;
  salonSlug: string;
  /** null = conexión de todo el salón (calendario compartido). */
  employeeId: string | null;
  proveedor: ProveedorCalendario;
  estado: EstadoConexion;
  /** El email de la cuenta (Google) o el Apple ID (Apple). */
  cuenta: string | null;
  /** Google: calendarId a usar (normalmente "primary"). Apple: href del calendario. */
  calendarioExternoId: string | null;
  /** El nombre del calendario tal y como lo devuelve el proveedor ("Noelia", "Trabajo"). */
  calendarioNombre: string | null;
  /** Google: syncToken de la última sincronización incremental. */
  syncToken: string | null;
  /** Apple: ctag del calendario en la última sincronización. */
  ctag: string | null;
  canalWatchId: string | null;
  canalRecursoId: string | null;
  canalCaduca: string | null;
  ultimoError: string | null;
  ultimoErrorEn: string | null;
  /** Cuándo terminó con éxito la última sincronización (push o polling). */
  ultimaSincronizacion: string | null;
  /**
   * Los dos interruptores de v1 (pedidos por FRONTEND, 26/09):
   *   - `bloquearHuecos`: si está apagado, lo ocupado en el calendario externo
   *     NO cuenta para bloquear huecos de reserva ni se importa como bloqueo.
   *   - `escribirCitas`: si está apagado, las citas de siShow no se escriben
   *     en el calendario externo (la conexión sigue viva para lo demás).
   * Los dos por defecto `true`: conectar un calendario hace las dos cosas
   * salvo que se apague explícitamente una.
   */
  bloquearHuecos: boolean;
  escribirCitas: boolean;
  creada: string;
  actualizada: string;
}

/** Un hueco ocupado por un calendario externo, sin título ni detalle (lo que ve `listarOcupadoExterno`). */
export interface OcupadoExterno {
  employeeId: string | null;
  inicio: string;
  fin: string;
  proveedor: ProveedorCalendario;
}

/** La credencial en claro, tal y como viaja DENTRO del cifrado (nunca fuera de él). */
export type CredencialGoogle = { tipo: "google"; refreshToken: string; cuenta: string };
export type CredencialApple = { tipo: "apple"; appleId: string; appPassword: string };
export type Credencial = CredencialGoogle | CredencialApple;

/** Una cita de siShow tal y como la necesita este módulo para pintar el evento externo. */
export interface CitaParaCalendario {
  /** El id estable de la cita (uuid o local_id): con lo que se guarda el mapeo. */
  id: string;
  clientName: string;
  service: string;
  employeeId: string;
  start: string;
  duration: number;
  status: string;
  note?: string | null;
  direccion?: string | null;
}

/** El mapeo cita ↔ evento externo, una fila de `calendario_mapeo_eventos`. */
export interface MapeoEvento {
  id: string;
  conexionId: string;
  citaId: string;
  eventoExternoId: string;
  /** Apple: el ETag del recurso; Google no lo usa (usa `etag` propio en la respuesta, no lo guardamos). */
  etag: string | null;
  icalUid: string;
}

/** Un bloque ocupado importado del calendario externo (no nace en siShow). */
export interface BloqueoExterno {
  conexionId: string;
  salonSlug: string;
  employeeId: string | null;
  eventoExternoId: string;
  startAt: string;
  endAt: string;
  resumen: string | null;
}

/** El resultado de intentar conectar Apple: nunca lanza, siempre dice qué pasó. */
export type ResultadoConexionApple = { ok: true } | { ok: false; error: string };

/** UID estable e id de eco: con esto se reconoce "esto lo escribió siShow" al releer el calendario externo. */
export function icalUidDeCita(citaId: string): string {
  return `${citaId}@sishow.app`;
}
