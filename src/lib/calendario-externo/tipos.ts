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
  /** Google: syncToken de la última sincronización incremental. */
  syncToken: string | null;
  /** Apple: ctag del calendario en la última sincronización. */
  ctag: string | null;
  canalWatchId: string | null;
  canalRecursoId: string | null;
  canalCaduca: string | null;
  ultimoError: string | null;
  ultimoErrorEn: string | null;
  creada: string;
  actualizada: string;
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
