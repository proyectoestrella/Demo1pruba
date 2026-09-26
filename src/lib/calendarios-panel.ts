/**
 * Calendarios externos en el panel (lote 14c), según docs/contrato-calendarios.md
 * de BACKEND. Aquí solo lo de pantalla: tipos del contrato, qué filas se
 * enseñan a quién y los textos. Las funciones de servidor
 * (`calendario-externo.functions.ts`) llegan por parámetro a la pantalla: no
 * hay maqueta. Todo detrás de `profile.calendariosExternosActivo`.
 */
import { alcance, type AccionId, type Permisos } from "./permisos";

export type ProveedorCalendario = "google" | "apple";
export type EstadoConexion = "activa" | "error" | "desconectada";

export interface ConexionCalendario {
  id: string;
  proveedor: ProveedorCalendario;
  employeeId: string | null;
  estado: EstadoConexion;
  cuenta: string | null;
  ultimoError: string | null;
  ultimoErrorEn: string | null;
  creada: string;
  actualizada: string;
  /** Ampliación acordada con BACKEND (26-sep): true por defecto. */
  bloquearHuecos?: boolean;
  escribirCitas?: boolean;
  calendarioNombre?: string | null;
  ultimaSincronizacion?: string | null;
}

export interface OcupadoExterno {
  employeeId: string | null;
  inicio: string;
  fin: string;
  proveedor: ProveedorCalendario;
}

/** Las funciones de servidor del contrato, con sus firmas. */
export interface ApiCalendarios {
  listarConexionesCalendario: (d: { slug: string }) => Promise<ConexionCalendario[]>;
  iniciarConexionGoogle: (d: { slug: string; employeeId?: string | null }) => Promise<{ url: string }>;
  conectarApple: (d: { slug: string; employeeId?: string | null; appleId: string; appPassword: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  desconectarCalendario: (d: { slug: string; conexionId: string }) => Promise<{ ok: true }>;
  ajustarConexionCalendario: (d: { slug: string; conexionId: string; bloquearHuecos: boolean; escribirCitas: boolean }) => Promise<{ ok: true }>;
  listarOcupadoExterno: (d: { slug: string; desde: string; hasta: string }) => Promise<OcupadoExterno[]>;
}

export const NOMBRE_PROVEEDOR: Record<ProveedorCalendario, string> = { google: "Google", apple: "Apple (iCloud)" };

/** El permiso del contrato; hasta que `permisos.ts` lo traiga, gerente y subencargada todo y estilista lo suyo. */
const ACCION = "calendario-externo.gestionar" as AccionId;
export function alcanceCalendario(p: Permisos): "todo" | "propio" | null {
  const a = alcance(p, ACCION);
  if (a) return a;
  if (p.rol === "gerente" || p.rol === "subencargado") return "todo";
  if (p.rol === "estilista") return "propio";
  return null;
}

export interface FilaCalendario {
  employeeId: string | null;
  titulo: string;
  conexiones: ConexionCalendario[];
}

/**
 * Las filas que ve cada uno: con alcance «todo», el calendario del salón y el
 * de cada profesional; con «propio», solo el suyo.
 */
export function filasCalendario(
  p: Permisos,
  miEmployeeId: string | null,
  equipo: Array<{ id: string; name: string }>,
  conexiones: ConexionCalendario[],
): FilaCalendario[] {
  const a = alcanceCalendario(p);
  if (!a) return [];
  const de = (id: string | null) => conexiones.filter((c) => c.employeeId === id && c.estado !== "desconectada");
  if (a === "propio") {
    const yo = equipo.find((e) => e.id === miEmployeeId);
    return yo ? [{ employeeId: yo.id, titulo: "Tu calendario", conexiones: de(yo.id) }] : [];
  }
  return [
    { employeeId: null, titulo: "Calendario del salón", conexiones: de(null) },
    ...equipo.map((e) => ({ employeeId: e.id, titulo: e.name, conexiones: de(e.id) })),
  ];
}

/** Formato de la contraseña de aplicación de Apple: 16 letras en cuatro grupos. */
export function pareceContrasenaDeApp(t: string): boolean {
  return /^[a-z]{4}-?[a-z]{4}-?[a-z]{4}-?[a-z]{4}$/i.test(t.trim());
}

/** Aviso al volver de Google (`/app/settings?calendario=ok|error&motivo=…`). */
export function avisoVueltaGoogle(search: Record<string, unknown>): { ok: boolean; texto: string } | null {
  if (search.calendario === "ok") return { ok: true, texto: "Google Calendar conectado. Tus citas y tus huecos ya se cruzan con él." };
  if (search.calendario === "error") {
    const motivo = typeof search.motivo === "string" && search.motivo ? ` (${search.motivo})` : "";
    return { ok: false, texto: `No se ha podido conectar Google Calendar${motivo}. Inténtalo otra vez.` };
  }
  return null;
}
