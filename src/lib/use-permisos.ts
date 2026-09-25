/**
 * Quién mira el panel y qué puede ver y hacer (lote 11). Misma API que la de
 * BACKEND (`docs/contrato-accesos.md`): `useMiembroActual()`, `usePermisos()`.
 * CONECTAR: en un salón real, el miembro viene del servidor; aquí, mientras
 * no llega, un salón real mira como gerente (lo de siempre: todo miembro manda).
 * En una demo, el miembro es el elegido en «Ver como» (por defecto, la gerente).
 */
import { useEffect, useMemo } from "react";
import { useSalonStore } from "./store";
import { useEquipo } from "./use-equipo";
import { useAccesosDemo, type Miembro } from "./accesos-maqueta";
import { permisosDe, puede, vePagina, type AccionId, type PaginaId, type Permisos } from "./permisos";
import type { Appointment, Employee } from "./mock/types";

/** ¿Es una demo (sin login)? */
export function useEsDemo(): boolean {
  return useSalonStore((s) => !s.realSalonSlug);
}

/** El plan del salón. CONECTAR (lote 13): `salonProfile.plan`. */
export function usePlanSalon(): string {
  return useSalonStore((s) => (s.salonProfile as { plan?: string }).plan ?? "todo-incluido");
}

/** El miembro que mira el panel; `null` en un salón real hasta conectar con el servidor. */
export function useMiembroActual(): Miembro | null {
  const esDemo = useEsDemo();
  const equipo = useEquipo();
  const miembros = useAccesosDemo((s) => s.miembros);
  const verComo = useAccesosDemo((s) => s.verComo);
  const asegurar = useAccesosDemo((s) => s.asegurar);
  useEffect(() => {
    if (esDemo) asegurar(equipo);
  }, [esDemo, equipo, asegurar]);
  if (!esDemo || !miembros) return null;
  const activos = miembros.filter((m) => m.estado === "activa");
  return activos.find((m) => m.userId === verComo) ?? activos.find((m) => m.rol === "gerente") ?? null;
}

export function usePermisos(): Permisos {
  const miembro = useMiembroActual();
  return permisosDe(miembro?.rol ?? "gerente");
}

/** La profesional vinculada al miembro (lo «propio» de una estilista). */
export function useMiEmployeeId(): string | null {
  return useMiembroActual()?.employeeId ?? null;
}

/** ¿Puede hacer esta acción? Con `employeeId`, sobre una cita o profesional concreta. */
export function usePuede(): (accion: AccionId, employeeId?: string | null) => boolean {
  const p = usePermisos();
  const mio = useMiEmployeeId();
  return (accion, employeeId) => puede(p, accion, employeeId === undefined ? undefined : { employeeId, miEmployeeId: mio });
}

/** La página de cada ruta del panel. */
const PAGINA_DE_RUTA: Array<[RegExp, PaginaId]> = [
  [/^\/app\/?$/, "hoy"],
  [/^\/app\/calendar/, "calendario"],
  [/^\/app\/appointments/, "citas"],
  [/^\/app\/waitlist/, "lista-espera"],
  [/^\/app\/clients/, "clientas"],
  [/^\/app\/hoja/, "hoja"],
  [/^\/app\/employees/, "equipo"],
  [/^\/app\/services/, "servicios"],
  [/^\/app\/web/, "mi-pagina"],
  [/^\/app\/settings/, "ajustes"],
  [/^\/app\/insights/, "analitica"],
  [/^\/app\/marketing/, "marketing"],
  [/^\/app\/demos/, "demos"],
];

export function paginaDeRuta(path: string): PaginaId | null {
  return PAGINA_DE_RUTA.find(([re]) => re.test(path))?.[1] ?? null;
}

/** ¿Ve esta ruta? `demos` es interna: no pasa por la matriz. */
export function veRuta(p: Permisos, path: string): boolean {
  const pagina = paginaDeRuta(path);
  if (!pagina || pagina === "demos") return true;
  return vePagina(p, pagina);
}

/**
 * Las citas que se PINTAN: todas, o solo las suyas si no tiene `cita.ver-todas`.
 * Las de las demás siguen en la store para no ofrecer horas ocupadas.
 */
export function filtrarCitas(citas: Appointment[], p: Permisos, mio: string | null): Appointment[] {
  if (puede(p, "cita.ver-todas")) return citas;
  return citas.filter((c) => !!mio && c.employeeId === mio);
}

export function useCitasVisibles(): Appointment[] {
  const citas = useSalonStore((s) => s.appointments);
  const p = usePermisos();
  const mio = useMiEmployeeId();
  return useMemo(() => filtrarCitas(citas, p, mio), [citas, p, mio]);
}

/** El equipo que se pinta: entero, o solo ella. */
export function useEquipoVisible(): Employee[] {
  const equipo = useEquipo();
  const p = usePermisos();
  const mio = useMiEmployeeId();
  return useMemo(() => (puede(p, "cita.ver-todas") ? equipo : equipo.filter((e) => e.id === mio)), [equipo, p, mio]);
}
