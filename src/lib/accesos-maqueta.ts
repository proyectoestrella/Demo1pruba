/**
 * Accesos del panel en esta rama (lote 11). CONECTAR: con la rama de BACKEND,
 * el miembro de un salón real sale de `accesoAlPanel` (campo `miembro`) y la
 * gestión de Ajustes › Accesos llama a `src/lib/api/accesos.functions.ts`
 * (`listarMiembros`, `invitarMiembro`, `reenviarInvitacion`,
 * `revocarInvitacion`, `cambiarRol`, `darDeBaja`). Aquí esas funciones tienen
 * la misma forma y trabajan en el navegador.
 *
 * En una demo (sin login) los miembros se inventan a partir del equipo: la
 * primera profesional es la gerente, el resto estilistas, más una
 * subencargada de ejemplo. «Ver como» elige desde cuál se mira el panel.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Employee } from "./mock/types";
import { cabeRol, type Rol } from "./permisos";

export interface Miembro {
  userId: string;
  rol: Rol;
  employeeId: string | null;
  displayName: string | null;
  email: string;
  estado: "invitada" | "activa" | "baja";
  /** Solo en invitadas: cuándo se mandó y cuándo caduca el enlace. */
  invitadaEn?: string;
  caducaEn?: string;
  /** Solo la rellena un salón real (CONECTAR): si ya pasó `caducaEn`. */
  caducada?: boolean;
}

export type ResultadoAccesos =
  | { ok: true }
  | { ok: false; codigo: "PLAN" | "ULTIMA_GERENTE" | "VINCULO" | "DUPLICADO"; mensaje: string };

export const NOMBRE_ROL: Record<Rol, string> = {
  gerente: "Gerente",
  subencargado: "Subencargada",
  recepcion: "Recepción",
  estilista: "Estilista",
};

export const EXPLICA_ROL: Record<Rol, string> = {
  gerente: "Todo: dinero, equipo, tu web, ajustes y quién entra.",
  subencargado: "Todo menos el dinero del salón, el plan, los accesos y borrar.",
  recepcion: "La agenda y las clientas de todas, sin dinero.",
  estilista: "Su agenda, sus clientas y lo que cobra ella.",
};

const DIAS_INVITACION = 7;
const correoDe = (nombre: string) =>
  `${nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, ".")}@ejemplo.com`;

/** Los miembros inventados de una demo. */
export function miembrosDeDemo(equipo: Employee[]): Miembro[] {
  const lista: Miembro[] = equipo.map((e, i) => {
    const nombre = e.name.split(" ")[0];
    return {
      userId: `demo-${e.id}`,
      rol: i === 0 ? "gerente" : "estilista",
      employeeId: e.id,
      displayName: nombre,
      email: correoDe(nombre),
      estado: "activa",
    };
  });
  lista.push({
    userId: "demo-subencargada",
    rol: "subencargado",
    employeeId: null,
    displayName: "Laura",
    email: "laura@ejemplo.com",
    estado: "activa",
  });
  return lista;
}

interface EstadoAccesos {
  /** Miembros de la demo; `null` hasta que se generan con el equipo. */
  miembros: Miembro[] | null;
  /** Clave del equipo con el que se generaron (si cambia la demo, se regeneran). */
  claveEquipo: string | null;
  /** userId desde el que se mira el panel en una demo. */
  verComo: string | null;
  asegurar: (equipo: Employee[]) => void;
  setVerComo: (userId: string | null) => void;
  aplicar: (f: (m: Miembro[]) => Miembro[]) => void;
}

export const useAccesosDemo = create<EstadoAccesos>()(
  persist(
    (set, get) => ({
      miembros: null,
      claveEquipo: null,
      verComo: null,
      asegurar: (equipo) => {
        const clave = equipo.map((e) => `${e.id}:${e.name}`).join("|");
        if (get().claveEquipo === clave && get().miembros) return;
        set({ miembros: miembrosDeDemo(equipo), claveEquipo: clave, verComo: null });
      },
      setVerComo: (verComo) => set({ verComo }),
      aplicar: (f) => set({ miembros: f(get().miembros ?? []) }),
    }),
    { name: "sishow-accesos-demo", storage: createJSONStorage(() => sessionStorage) },
  ),
);

const activos = (m: Miembro[]) => m.filter((x) => x.estado !== "baja");
const gerentesActivas = (m: Miembro[]) =>
  m.filter((x) => x.rol === "gerente" && x.estado === "activa");

/** Misma forma que las funciones de servidor de BACKEND. CONECTAR. */
export const accesos = {
  listarMiembros(): Miembro[] {
    return activos(useAccesosDemo.getState().miembros ?? []);
  },

  invitarMiembro(
    d: { email: string; rol: Rol; employeeId: string | null; displayName: string | null },
    plan: string | null,
    ahora = new Date(),
  ): ResultadoAccesos {
    const m = useAccesosDemo.getState().miembros ?? [];
    const email = d.email.trim().toLowerCase();
    if (activos(m).some((x) => x.email.toLowerCase() === email))
      return {
        ok: false,
        codigo: "DUPLICADO",
        mensaje: "Ese correo ya tiene acceso o una invitación.",
      };
    if (d.employeeId && activos(m).some((x) => x.employeeId === d.employeeId))
      return { ok: false, codigo: "VINCULO", mensaje: "Esa profesional ya tiene su cuenta." };
    if (d.rol === "estilista" && !d.employeeId)
      return { ok: false, codigo: "VINCULO", mensaje: "Elige quién es en tu equipo." };
    if (
      !cabeRol(
        d.rol,
        activos(m).map((x) => x.rol),
        plan,
      )
    )
      return {
        ok: false,
        codigo: "PLAN",
        mensaje: "Tu plan incluye dos tipos de acceso (gerente y estilista).",
      };
    const caduca = new Date(ahora);
    caduca.setDate(caduca.getDate() + DIAS_INVITACION);
    useAccesosDemo.getState().aplicar((l) => [
      ...l,
      {
        userId: `inv-${Date.now()}`,
        rol: d.rol,
        employeeId: d.employeeId,
        displayName: d.displayName,
        email,
        estado: "invitada",
        invitadaEn: ahora.toISOString(),
        caducaEn: caduca.toISOString(),
      },
    ]);
    return { ok: true };
  },

  reenviarInvitacion(userId: string, ahora = new Date()): ResultadoAccesos {
    const caduca = new Date(ahora);
    caduca.setDate(caduca.getDate() + DIAS_INVITACION);
    useAccesosDemo
      .getState()
      .aplicar((l) =>
        l.map((x) =>
          x.userId === userId
            ? { ...x, invitadaEn: ahora.toISOString(), caducaEn: caduca.toISOString() }
            : x,
        ),
      );
    return { ok: true };
  },

  revocarInvitacion(userId: string): ResultadoAccesos {
    useAccesosDemo.getState().aplicar((l) => l.filter((x) => x.userId !== userId));
    return { ok: true };
  },

  cambiarRol(userId: string, rol: Rol, plan: string | null): ResultadoAccesos {
    const m = activos(useAccesosDemo.getState().miembros ?? []);
    const yo = m.find((x) => x.userId === userId);
    if (!yo) return { ok: true };
    if (yo.rol === "gerente" && rol !== "gerente" && gerentesActivas(m).length <= 1)
      return {
        ok: false,
        codigo: "ULTIMA_GERENTE",
        mensaje: "Tiene que quedar al menos una gerente.",
      };
    if (rol === "estilista" && !yo.employeeId)
      return {
        ok: false,
        codigo: "VINCULO",
        mensaje: "Para ser estilista, vincúlala antes a una profesional del equipo.",
      };
    if (
      !cabeRol(
        rol,
        m.filter((x) => x.userId !== userId).map((x) => x.rol),
        plan,
      )
    )
      return {
        ok: false,
        codigo: "PLAN",
        mensaje: "Tu plan incluye dos tipos de acceso (gerente y estilista).",
      };
    useAccesosDemo
      .getState()
      .aplicar((l) => l.map((x) => (x.userId === userId ? { ...x, rol } : x)));
    return { ok: true };
  },

  vincular(userId: string, employeeId: string | null): ResultadoAccesos {
    const m = activos(useAccesosDemo.getState().miembros ?? []);
    if (employeeId && m.some((x) => x.userId !== userId && x.employeeId === employeeId))
      return { ok: false, codigo: "VINCULO", mensaje: "Esa profesional ya tiene su cuenta." };
    const yo = m.find((x) => x.userId === userId);
    if (yo?.rol === "estilista" && !employeeId)
      return {
        ok: false,
        codigo: "VINCULO",
        mensaje: "Una estilista tiene que estar vinculada a una profesional.",
      };
    useAccesosDemo
      .getState()
      .aplicar((l) => l.map((x) => (x.userId === userId ? { ...x, employeeId } : x)));
    return { ok: true };
  },

  darDeBaja(userId: string): ResultadoAccesos {
    const m = activos(useAccesosDemo.getState().miembros ?? []);
    const yo = m.find((x) => x.userId === userId);
    if (yo?.rol === "gerente" && gerentesActivas(m).length <= 1)
      return {
        ok: false,
        codigo: "ULTIMA_GERENTE",
        mensaje: "Tiene que quedar al menos una gerente.",
      };
    useAccesosDemo
      .getState()
      .aplicar((l) => l.map((x) => (x.userId === userId ? { ...x, estado: "baja" } : x)));
    if (useAccesosDemo.getState().verComo === userId) useAccesosDemo.getState().setVerComo(null);
    return { ok: true };
  },

  /** Deshacer de una baja o un cambio: vuelve a poner el miembro tal cual estaba. */
  restaurar(miembro: Miembro): void {
    useAccesosDemo
      .getState()
      .aplicar((l) =>
        l.some((x) => x.userId === miembro.userId)
          ? l.map((x) => (x.userId === miembro.userId ? miembro : x))
          : [...l, miembro],
      );
  },
};
