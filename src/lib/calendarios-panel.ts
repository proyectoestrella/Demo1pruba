/**
 * Calendarios externos en el panel (lote 14c), según docs/contrato-calendarios.md
 * de BACKEND. Aquí solo lo de pantalla: tipos del contrato, qué filas se
 * enseñan a quién y los textos. Las funciones de servidor
 * (`calendario-externo.functions.ts`) llegan por parámetro a la pantalla: no
 * hay maqueta. Todo detrás de `profile.calendariosExternosActivo`.
 */
import { alcance, type AccionId, type Permisos } from "./permisos";
import { useEffect, useMemo, useState } from "react";
import { useSalonStore } from "./store";
import {
  ajustarConexionCalendario,
  conectarApple,
  desconectarCalendario,
  iniciarConexionGoogle,
  listarConexionesCalendario,
  listarOcupadoExterno,
  sincronizarCalendarios,
} from "./api/calendario-externo.functions";
import type { Appointment } from "./mock/types";

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

/* ---------- lo ocupado en calendarios externos, en el calendario del panel ---------- */


/** Prefijo de los bloques que vienen de fuera: se pintan rayados y no se abren. */
export const PREFIJO_EXTERNO = "ext-";
export const esBloqueExterno = (a: Pick<Appointment, "id">) => a.id.startsWith(PREFIJO_EXTERNO);

/** Un hueco ocupado fuera, como bloqueo de pantalla (sin título ni clienta). Sin profesional = todo el salón. */
export function bloquesDeOcupado(ocupado: OcupadoExterno[], equipoIds: string[]): Appointment[] {
  return ocupado.flatMap((o, i) => {
    const duracion = Math.max(5, Math.round((Date.parse(o.fin) - Date.parse(o.inicio)) / 60_000));
    const para = o.employeeId ? [o.employeeId] : equipoIds;
    return para.map((employeeId) => ({
      id: `${PREFIJO_EXTERNO}${i}-${employeeId}`,
      clientId: "",
      clientName: "",
      serviceIds: [],
      employeeId,
      start: o.inicio,
      duration: duracion,
      priceEur: 0,
      status: "blocked",
      note: `Ocupado (${NOMBRE_PROVEEDOR[o.proveedor].split(" ")[0]})`,
    }) as unknown as Appointment);
  });
}

/** ¿Están activados los calendarios externos en este salón (real)? */
export function useCalendariosActivos(): { activo: boolean; slug: string | null } {
  const slug = useSalonStore((s) => s.realSalonSlug);
  const flag = useSalonStore((s) => !!s.salonProfile.calendariosExternosActivo);
  return { activo: !!slug && flag, slug };
}

/**
 * Los bloques «Ocupado (Google)» de un rango para el calendario (14c). Solo
 * con los calendarios activados en un salón real; en otro caso, ninguno.
 */
export function useOcupadoExterno(desde: string, hasta: string, equipoIds: string[]): Appointment[] {
  const { activo, slug } = useCalendariosActivos();
  const [ocupado, setOcupado] = useState<OcupadoExterno[]>([]);
  useEffect(() => {
    if (!activo || !slug) return setOcupado([]);
    let vivo = true;
    listarOcupadoExterno({ data: { slug, desde, hasta } }).then(
      (r) => vivo && setOcupado(r as OcupadoExterno[]),
      () => vivo && setOcupado([]),
    );
    return () => {
      vivo = false;
    };
  }, [activo, slug, desde, hasta]);
  const clave = equipoIds.join(",");
  return useMemo(() => bloquesDeOcupado(ocupado, equipoIds), [ocupado, clave]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Al abrir Hoy o el Calendario: que Apple (sin webhook) se ponga al día. Sin esperar la respuesta. */
export function useSincronizarCalendarios() {
  const { activo, slug } = useCalendariosActivos();
  useEffect(() => {
    if (activo && slug) void sincronizarCalendarios({ data: { slug } }).catch(() => undefined);
  }, [activo, slug]);
}

/** Las funciones de servidor reales con la forma que usa la pantalla (`{ data }` por dentro). */
export const API_CALENDARIOS: ApiCalendarios = {
  listarConexionesCalendario: (d) => listarConexionesCalendario({ data: d }) as Promise<ConexionCalendario[]>,
  iniciarConexionGoogle: (d) => iniciarConexionGoogle({ data: d }),
  conectarApple: (d) => conectarApple({ data: d }),
  desconectarCalendario: (d) => desconectarCalendario({ data: d }) as Promise<{ ok: true }>,
  ajustarConexionCalendario: (d) => ajustarConexionCalendario({ data: d }) as Promise<{ ok: true }>,
  listarOcupadoExterno: (d) => listarOcupadoExterno({ data: d }) as Promise<OcupadoExterno[]>,
};
