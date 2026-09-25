/**
 * Quién mira el panel y qué puede ver y hacer (lote 11). Misma API que
 * `src/lib/use-permisos.ts` de BACKEND (`useMiembroActual`, `usePermisos`,
 * `saludo`), en otro fichero para no chocar en la fusión, más lo que la
 * pantalla necesita: citas y equipo visibles, ruta → página y «Ver como».
 *
 * CONECTAR: en un salón real, `useMiembroActual` pasa a leer `s.miembro` de la
 * store (lo guarda `app.tsx` al cargar, en la rama de BACKEND). Mientras no
 * llega, un salón real mira como gerente, como hasta ahora. En una demo, el
 * miembro es el elegido en «Ver como» (por defecto, la gerente).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSalonStore } from "./store";
import { useEquipo } from "./use-equipo";
import {
  accesos as accesosDemo,
  useAccesosDemo,
  type Miembro,
  type ResultadoAccesos as ResultadoAccesosDemo,
} from "./accesos-maqueta";
import {
  listarMiembros,
  invitarAlSalon,
  cambiarRolMiembro,
  darDeBajaMiembro,
  reactivarMiembroDelSalon,
  reenviarInvitacionAlSalon,
  revocarInvitacionAlSalon,
  vincularEmpleadaDelSalon,
} from "./api/accesos.functions";
import type { ResultadoAccesos as ResultadoAccesosServidor } from "./api/accesos";
import { planDe, tienePlan, type FuncionPlan, type PlanSishow } from "./plan";
import {
  permisosDe,
  puede,
  vePagina,
  type AccionId,
  type PaginaId,
  type Permisos,
  type Rol,
} from "./permisos";
import type { Appointment, Employee } from "./mock/types";

/** ¿Es una demo (sin login)? */
export function useEsDemo(): boolean {
  return useSalonStore((s) => !s.realSalonSlug);
}

/** El plan del salón (lote 13): el guardado; sin él, «reservas-asistente» en un salón real y «todo-incluido» en la demo. */
export function usePlanSalon(): PlanSishow {
  return useSalonStore((s) => planDe(s.salonProfile, !s.realSalonSlug));
}

/** ¿Incluye el plan del salón esta función? */
export function useTienePlan(funcion: FuncionPlan): boolean {
  return tienePlan(usePlanSalon(), funcion);
}

/** El miembro que mira el panel; `null` en un salón real hasta conectar con el servidor. */
export function useMiembroActual(): Miembro | null {
  const esDemo = useEsDemo();
  const equipo = useEquipo();
  const miembros = useAccesosDemo((s) => s.miembros);
  const verComo = useAccesosDemo((s) => s.verComo);
  const asegurar = useAccesosDemo((s) => s.asegurar);
  const real = useSalonStore((s) => s.miembro);
  useEffect(() => {
    if (esDemo) asegurar(equipo);
  }, [esDemo, equipo, asegurar]);
  const activos = (miembros ?? []).filter((m) => m.estado === "activa");
  const demo = esDemo
    ? (activos.find((m) => m.userId === verComo) ??
      activos.find((m) => m.rol === "gerente") ??
      null)
    : null;
  // En la demo, el miembro de «Ver como» manda también en la store: permisos
  // del deshacer y autoría del historial (lote 12, conectado en la fusión).
  useEffect(() => {
    if (!esDemo) return;
    const st = useSalonStore.getState();
    const actual = st.miembro;
    if (demo ? actual?.userId !== demo.userId || actual?.rol !== demo.rol : actual !== null) {
      st.setMiembro(
        demo
          ? {
              userId: demo.userId,
              rol: demo.rol,
              employeeId: demo.employeeId,
              displayName: demo.displayName,
            }
          : null,
      );
    }
  }, [esDemo, demo?.userId, demo?.rol, demo?.employeeId]);
  // Salón real: el miembro lo da el servidor (accesoAlPanel → s.miembro).
  if (!esDemo) return real ? { ...real, email: "", estado: "activa" } : null;
  return demo;
}

export function usePermisos(): Permisos {
  const miembro = useMiembroActual();
  return permisosDe(miembro?.rol ?? "gerente");
}

/**
 * Ajustes › Accesos (lote 10, conectado): la misma API asíncrona funcione en
 * demo o en un salón real, para que `AjustesAccesos.tsx` no distinga.
 *
 * En una demo envuelve `accesos-maqueta` (síncrona) en una promesa que se
 * resuelve al momento, y la lista sale de la store por lo que la pantalla se
 * repinta sola. En un salón real llama a `accesos.functions.ts` y guarda la
 * lista en estado local, recargándola tras cada acción.
 */
export type ResultadoAccesosPanel = { ok: true } | { ok: false; codigo: string; mensaje: string };

function deServidor<T>(r: ResultadoAccesosServidor<T>): ResultadoAccesosPanel {
  return r.ok ? { ok: true } : { ok: false, codigo: r.codigo, mensaje: r.motivo };
}
function deDemo(r: ResultadoAccesosDemo): ResultadoAccesosPanel {
  return r;
}

export interface AccesosAPI {
  /** Cargando la lista por primera vez (o recargando tras un error). Nunca en demo. */
  cargando: boolean;
  /** Lo que falló al hablar con el servidor; `null` en demo. */
  error: string | null;
  /** Miembros activos e invitaciones pendientes, sin las bajas. */
  miembros: Miembro[];
  recargar: () => void;
  invitar: (d: {
    email: string;
    rol: Rol;
    employeeId: string | null;
    displayName: string | null;
  }) => Promise<ResultadoAccesosPanel>;
  cambiarRol: (m: Miembro, rol: Rol) => Promise<ResultadoAccesosPanel>;
  vincular: (m: Miembro, employeeId: string | null) => Promise<ResultadoAccesosPanel>;
  darDeBaja: (m: Miembro) => Promise<ResultadoAccesosPanel>;
  /** Deshace un cambio de rol, un vínculo o una baja, dado cómo estaba antes. */
  restaurar: (m: Miembro) => Promise<ResultadoAccesosPanel>;
  reenviarInvitacion: (m: Miembro) => Promise<ResultadoAccesosPanel>;
  revocarInvitacion: (m: Miembro) => Promise<ResultadoAccesosPanel>;
}

function mapearListaReal(datos: {
  miembros: readonly {
    userId: string;
    email: string | null;
    rol: Rol;
    employeeId: string | null;
    displayName: string | null;
  }[];
  invitaciones: readonly {
    id: string;
    email: string;
    rol: Rol;
    employeeId: string | null;
    displayName: string | null;
    creada: string;
    caduca: string;
    caducada: boolean;
  }[];
}): Miembro[] {
  return [
    ...datos.miembros.map(
      (m): Miembro => ({
        userId: m.userId,
        rol: m.rol,
        employeeId: m.employeeId,
        displayName: m.displayName,
        email: m.email ?? "",
        estado: "activa",
      }),
    ),
    ...datos.invitaciones.map(
      (i): Miembro => ({
        userId: i.id,
        rol: i.rol,
        employeeId: i.employeeId,
        displayName: i.displayName,
        email: i.email,
        estado: "invitada",
        invitadaEn: i.creada,
        caducaEn: i.caduca,
        caducada: i.caducada,
      }),
    ),
  ];
}

const errorLegible = (e: unknown) =>
  e instanceof Error && e.message
    ? e.message
    : "No se pudo hablar con el servidor. Vuelve a intentarlo.";

/** Llama al servidor y traduce tanto el resultado como una excepción (permiso denegado, sin Supabase, etc.) al mismo formato. */
async function llamarServidor<T>(
  fn: () => Promise<ResultadoAccesosServidor<T>>,
): Promise<ResultadoAccesosPanel> {
  try {
    return deServidor(await fn());
  } catch (e) {
    return { ok: false, codigo: "OTRO", mensaje: errorLegible(e) };
  }
}

export function useAccesos(): AccesosAPI {
  const esDemo = useEsDemo();
  const slug = useSalonStore((s) => s.realSalonSlug);
  const plan = usePlanSalon();

  // --- demo: la lista sale directa de la store, sin red ni estado propio ---
  const listaDemo = useAccesosDemo((s) => s.miembros);
  const miembrosDemo = useMemo(
    () => (listaDemo ?? []).filter((m) => m.estado !== "baja"),
    [listaDemo],
  );

  // --- salón real: estado local, recargado tras cada acción ---
  const [real, setReal] = useState<{
    cargando: boolean;
    error: string | null;
    miembros: Miembro[];
  }>({ cargando: !esDemo, error: null, miembros: [] });

  const recargarReal = useCallback(async () => {
    if (esDemo || !slug) return;
    setReal((s) => ({ ...s, cargando: true, error: null }));
    try {
      const datos = await listarMiembros({ data: { slug } });
      setReal({ cargando: false, error: null, miembros: mapearListaReal(datos) });
    } catch (e) {
      setReal({ cargando: false, error: errorLegible(e), miembros: [] });
    }
  }, [esDemo, slug]);

  useEffect(() => {
    recargarReal();
  }, [recargarReal]);

  const invitar = useCallback<AccesosAPI["invitar"]>(
    async (d) => {
      if (esDemo) return deDemo(accesosDemo.invitarMiembro(d, plan));
      if (!slug) return { ok: false, codigo: "OTRO", mensaje: "No se sabe a qué salón invitar." };
      const r = await llamarServidor(() => invitarAlSalon({ data: { slug, ...d } }));
      if (r.ok) await recargarReal();
      return r;
    },
    [esDemo, plan, slug, recargarReal],
  );

  const cambiarRol = useCallback<AccesosAPI["cambiarRol"]>(
    async (m, rol) => {
      if (esDemo) return deDemo(accesosDemo.cambiarRol(m.userId, rol, plan));
      if (!slug) return { ok: false, codigo: "OTRO", mensaje: "No se sabe a qué salón." };
      const r = await llamarServidor(() =>
        cambiarRolMiembro({
          data: {
            slug,
            userId: m.userId,
            rol,
            employeeId: rol === "estilista" ? m.employeeId : undefined,
          },
        }),
      );
      if (r.ok) await recargarReal();
      return r;
    },
    [esDemo, plan, slug, recargarReal],
  );

  const vincular = useCallback<AccesosAPI["vincular"]>(
    async (m, employeeId) => {
      if (esDemo) return deDemo(accesosDemo.vincular(m.userId, employeeId));
      if (!slug) return { ok: false, codigo: "OTRO", mensaje: "No se sabe a qué salón." };
      const r = await llamarServidor(() =>
        vincularEmpleadaDelSalon({ data: { slug, userId: m.userId, employeeId } }),
      );
      if (r.ok) await recargarReal();
      return r;
    },
    [esDemo, slug, recargarReal],
  );

  const darDeBaja = useCallback<AccesosAPI["darDeBaja"]>(
    async (m) => {
      if (esDemo) return deDemo(accesosDemo.darDeBaja(m.userId));
      if (!slug) return { ok: false, codigo: "OTRO", mensaje: "No se sabe a qué salón." };
      const r = await llamarServidor(() => darDeBajaMiembro({ data: { slug, userId: m.userId } }));
      if (r.ok) await recargarReal();
      return r;
    },
    [esDemo, slug, recargarReal],
  );

  const reenviarInvitacion = useCallback<AccesosAPI["reenviarInvitacion"]>(
    async (m) => {
      if (esDemo) return deDemo(accesosDemo.reenviarInvitacion(m.userId));
      if (!slug) return { ok: false, codigo: "OTRO", mensaje: "No se sabe a qué salón." };
      const r = await llamarServidor(() =>
        reenviarInvitacionAlSalon({ data: { slug, invitacionId: m.userId } }),
      );
      if (r.ok) await recargarReal();
      return r;
    },
    [esDemo, slug, recargarReal],
  );

  const revocarInvitacion = useCallback<AccesosAPI["revocarInvitacion"]>(
    async (m) => {
      if (esDemo) return deDemo(accesosDemo.revocarInvitacion(m.userId));
      if (!slug) return { ok: false, codigo: "OTRO", mensaje: "No se sabe a qué salón." };
      const r = await llamarServidor(() =>
        revocarInvitacionAlSalon({ data: { slug, invitacionId: m.userId } }),
      );
      if (r.ok) await recargarReal();
      return r;
    },
    [esDemo, slug, recargarReal],
  );

  // El único caso con deshacer genérico: se intenta reactivar (venía de una
  // baja); si no estaba de baja, es que el cambio fue de rol o de vínculo, y
  // se restauran los dos. Anular una invitación no tiene vuelta atrás real:
  // se avisa en vez de fingir que se deshizo.
  const restaurar = useCallback<AccesosAPI["restaurar"]>(
    async (m) => {
      if (esDemo) {
        accesosDemo.restaurar(m);
        return { ok: true };
      }
      if (!slug) return { ok: false, codigo: "OTRO", mensaje: "No se sabe a qué salón." };
      if (m.estado === "invitada")
        return {
          ok: false,
          codigo: "OTRO",
          mensaje: "No se puede deshacer: vuelve a invitarla si hace falta.",
        };
      const reactivado = await llamarServidor(() =>
        reactivarMiembroDelSalon({ data: { slug, userId: m.userId } }),
      );
      if (reactivado.ok) {
        await recargarReal();
        return reactivado;
      }
      if (reactivado.codigo !== "NO_EXISTE") return reactivado;
      // No estaba de baja: deshace un cambio de rol (y de vínculo, si hace falta aparte).
      const rRol = await llamarServidor(() =>
        cambiarRolMiembro({
          data: {
            slug,
            userId: m.userId,
            rol: m.rol,
            employeeId: m.rol === "estilista" ? m.employeeId : undefined,
          },
        }),
      );
      if (!rRol.ok) return rRol;
      if (m.rol !== "estilista" && m.employeeId) {
        const rVinculo = await llamarServidor(() =>
          vincularEmpleadaDelSalon({ data: { slug, userId: m.userId, employeeId: m.employeeId } }),
        );
        if (!rVinculo.ok) return rVinculo;
      }
      await recargarReal();
      return { ok: true };
    },
    [esDemo, slug, recargarReal],
  );

  if (esDemo) {
    return {
      cargando: false,
      error: null,
      miembros: miembrosDemo,
      recargar: () => {},
      invitar,
      cambiarRol,
      vincular,
      darDeBaja,
      restaurar,
      reenviarInvitacion,
      revocarInvitacion,
    };
  }
  return {
    cargando: real.cargando,
    error: real.error,
    miembros: real.miembros,
    recargar: recargarReal,
    invitar,
    cambiarRol,
    vincular,
    darDeBaja,
    restaurar,
    reenviarInvitacion,
    revocarInvitacion,
  };
}

/** La profesional vinculada al miembro (lo «propio» de una estilista). */
export function useMiEmployeeId(): string | null {
  return useMiembroActual()?.employeeId ?? null;
}

/** ¿Puede hacer esta acción? Con `employeeId`, sobre una cita o profesional concreta. */
export function usePuede(): (accion: AccionId, employeeId?: string | null) => boolean {
  const p = usePermisos();
  const mio = useMiEmployeeId();
  return (accion, employeeId) =>
    puede(p, accion, employeeId === undefined ? undefined : { employeeId, miEmployeeId: mio });
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
  return useMemo(
    () => (puede(p, "cita.ver-todas") ? equipo : equipo.filter((e) => e.id === mio)),
    [equipo, p, mio],
  );
}

/** A quién puede dar cita: a cualquiera con «crear para otra»; si no, solo a ella. */
export function useEquipoParaDarCita(): Employee[] {
  const equipo = useEquipo();
  const p = usePermisos();
  const mio = useMiEmployeeId();
  return useMemo(() => {
    if (puede(p, "cita.crear-para-otra")) return equipo;
    const suya = equipo.filter((e) => e.id === mio);
    return suya.length ? suya : equipo;
  }, [equipo, p, mio]);
}

/** «Buenos días, Noelia» / «Buenas tardes» sin nombre. Igual que `saludo` de BACKEND. */
export function saludo(nombre: string | null | undefined, hora: number): string {
  const franja = hora < 14 ? "Buenos días" : hora < 21 ? "Buenas tardes" : "Buenas noches";
  const pila = nombre?.trim().split(/\s+/)[0];
  return pila ? `${franja}, ${pila}` : franja;
}

/** El miembro actual fuera de React (para el registro de cambios). */
export function miembroAhora(): Miembro | null {
  const s = useSalonStore.getState();
  if (s.realSalonSlug) return s.miembro ? { ...s.miembro, email: "", estado: "activa" } : null;
  const { miembros, verComo } = useAccesosDemo.getState();
  const activos = (miembros ?? []).filter((m) => m.estado === "activa");
  return (
    activos.find((m) => m.userId === verComo) ?? activos.find((m) => m.rol === "gerente") ?? null
  );
}
