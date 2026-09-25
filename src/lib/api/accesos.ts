/**
 * Gestión de accesos de un salón (lote 8): invitar, aceptar, cambiar rol y
 * dar de baja. Lógica pura con las dependencias inyectadas: el cableado real
 * (service role, `auth.admin.inviteUserByEmail`) vive en
 * `accesos.functions.ts` y NUNCA en el navegador.
 */
import { cabeRol, esRol, rolVigente, type Rol } from "../permisos";
import { PermisoDenegado, tienePermiso, type Acceso } from "./autorizacion";

export const DIAS_CADUCIDAD_INVITACION = 7;

export interface MiembroFila {
  userId: string;
  email: string | null;
  rol: Rol;
  employeeId: string | null;
  displayName: string | null;
  estado: "activa" | "baja";
}

export interface InvitacionFila {
  id: string;
  email: string;
  rol: Rol;
  employeeId: string | null;
  displayName: string | null;
  invitedBy: string | null;
  creada: string;
  caduca: string;
  aceptadaEn: string | null;
  revocada: boolean;
}

export interface DepsAccesos {
  ahora: () => Date;
  nuevoId: () => string;
  plan: () => Promise<string | null>;
  miembros: () => Promise<MiembroFila[]>;
  invitaciones: () => Promise<InvitacionFila[]>;
  guardarInvitacion: (i: InvitacionFila) => Promise<void>;
  /** Manda el correo con el enlace mágico (service role en el servidor). */
  enviarInvitacion: (email: string, invitacionId: string) => Promise<void>;
  guardarMiembro: (m: MiembroFila) => Promise<void>;
  /** El correo verificado del usuario de la sesión. */
  correoDe: (userId: string) => Promise<string | null>;
}

export type ResultadoAccesos<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { dato: T }))
  | {
      ok: false;
      codigo:
        | "PERMISO"
        | "PLAN"
        | "DATOS"
        | "ULTIMA_GERENTE"
        | "NO_EXISTE"
        | "CADUCADA"
        | "OTRO_CORREO"
        | "YA_MIEMBRO";
      motivo: string;
    };

const correoValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const norm = (e: string) => e.trim().toLowerCase();

function exigirGestion(acceso: Acceso) {
  if (!tienePermiso(acceso, "accesos.gestionar")) throw new PermisoDenegado("accesos.gestionar");
}

function rolesEnUso(m: MiembroFila[], inv: InvitacionFila[]): Rol[] {
  return [
    ...m.filter((x) => x.estado === "activa").map((x) => x.rol),
    ...inv.filter((i) => !i.aceptadaEn && !i.revocada).map((i) => i.rol),
  ];
}

export async function invitarMiembro(
  acceso: Acceso,
  datos: { email: string; rol: string; employeeId?: string | null; displayName?: string | null },
  deps: DepsAccesos,
): Promise<ResultadoAccesos<{ invitacionId: string }>> {
  exigirGestion(acceso);
  const email = norm(datos.email);
  if (!correoValido(email))
    return { ok: false, codigo: "DATOS", motivo: "Ese correo no parece válido." };
  if (!esRol(datos.rol)) return { ok: false, codigo: "DATOS", motivo: "Ese rol no existe." };
  const rol = datos.rol;
  if (rol === "estilista" && !datos.employeeId)
    return {
      ok: false,
      codigo: "DATOS",
      motivo: "Elige qué profesional es: una estilista ve su agenda.",
    };
  const [miembros, invs, plan] = await Promise.all([
    deps.miembros(),
    deps.invitaciones(),
    deps.plan(),
  ]);
  if (miembros.some((m) => m.estado === "activa" && m.email && norm(m.email) === email))
    return { ok: false, codigo: "YA_MIEMBRO", motivo: "Esa persona ya tiene acceso." };
  if (
    rol === "estilista" &&
    miembros.some((m) => m.estado === "activa" && m.employeeId === datos.employeeId)
  )
    return { ok: false, codigo: "DATOS", motivo: "Esa profesional ya tiene un acceso vinculado." };
  if (!cabeRol(rol, rolesEnUso(miembros, invs), plan))
    return {
      ok: false,
      codigo: "PLAN",
      motivo: "Tu plan permite dos tipos de acceso. Para más, el plan Todo incluido.",
    };
  const ahora = deps.ahora();
  const inv: InvitacionFila = {
    id: deps.nuevoId(),
    email,
    rol,
    employeeId: datos.employeeId ?? null,
    displayName: datos.displayName?.trim() || null,
    invitedBy: acceso.tipo === "miembro" ? acceso.userId : null,
    creada: ahora.toISOString(),
    caduca: new Date(ahora.getTime() + DIAS_CADUCIDAD_INVITACION * 86_400_000).toISOString(),
    aceptadaEn: null,
    revocada: false,
  };
  await deps.guardarInvitacion(inv);
  await deps.enviarInvitacion(email, inv.id);
  return { ok: true, dato: { invitacionId: inv.id } };
}

export async function aceptarInvitacion(
  userId: string,
  invitacionId: string,
  deps: DepsAccesos,
): Promise<ResultadoAccesos> {
  const inv = (await deps.invitaciones()).find((i) => i.id === invitacionId);
  if (!inv || inv.revocada)
    return {
      ok: false,
      codigo: "NO_EXISTE",
      motivo: "Esta invitación ya no es válida. Pide otra a quien gestiona el salón.",
    };
  if (inv.aceptadaEn) return { ok: true };
  if (deps.ahora().getTime() > Date.parse(inv.caduca))
    return {
      ok: false,
      codigo: "CADUCADA",
      motivo: "La invitación ha caducado. Pide que te la reenvíen.",
    };
  const correo = await deps.correoDe(userId);
  if (!correo || norm(correo) !== inv.email)
    return {
      ok: false,
      codigo: "OTRO_CORREO",
      motivo: "Has entrado con otro correo distinto del invitado.",
    };
  await deps.guardarMiembro({
    userId,
    email: inv.email,
    rol: inv.rol,
    employeeId: inv.employeeId,
    displayName: inv.displayName,
    estado: "activa",
  });
  await deps.guardarInvitacion({ ...inv, aceptadaEn: deps.ahora().toISOString() });
  return { ok: true };
}

async function gerentesActivas(deps: DepsAccesos) {
  return (await deps.miembros()).filter((m) => m.estado === "activa" && m.rol === "gerente");
}

export async function cambiarRol(
  acceso: Acceso,
  userId: string,
  nuevo: { rol: string; employeeId?: string | null },
  deps: DepsAccesos,
): Promise<ResultadoAccesos> {
  exigirGestion(acceso);
  if (!esRol(nuevo.rol)) return { ok: false, codigo: "DATOS", motivo: "Ese rol no existe." };
  const miembros = await deps.miembros();
  const m = miembros.find((x) => x.userId === userId && x.estado === "activa");
  if (!m) return { ok: false, codigo: "NO_EXISTE", motivo: "Esa persona no tiene acceso." };
  if (m.rol === "gerente" && nuevo.rol !== "gerente" && (await gerentesActivas(deps)).length <= 1)
    return {
      ok: false,
      codigo: "ULTIMA_GERENTE",
      motivo: "Tiene que quedar al menos una gerente.",
    };
  if (nuevo.rol === "estilista" && !nuevo.employeeId)
    return { ok: false, codigo: "DATOS", motivo: "Elige qué profesional es." };
  const otros = miembros.filter((x) => x.userId !== userId);
  if (!cabeRol(nuevo.rol, rolesEnUso(otros, await deps.invitaciones()), await deps.plan()))
    return {
      ok: false,
      codigo: "PLAN",
      motivo: "Tu plan permite dos tipos de acceso. Para más, el plan Todo incluido.",
    };
  await deps.guardarMiembro({
    ...m,
    rol: nuevo.rol,
    employeeId: nuevo.rol === "estilista" ? (nuevo.employeeId ?? null) : null,
  });
  return { ok: true };
}

export async function darDeBaja(
  acceso: Acceso,
  userId: string,
  deps: DepsAccesos,
): Promise<ResultadoAccesos> {
  exigirGestion(acceso);
  const m = (await deps.miembros()).find((x) => x.userId === userId && x.estado === "activa");
  if (!m) return { ok: false, codigo: "NO_EXISTE", motivo: "Esa persona no tiene acceso." };
  if (m.rol === "gerente" && (await gerentesActivas(deps)).length <= 1)
    return {
      ok: false,
      codigo: "ULTIMA_GERENTE",
      motivo: "Tiene que quedar al menos una gerente.",
    };
  // Baja, no borrado: la autoría del historial de cambios se conserva.
  await deps.guardarMiembro({ ...m, estado: "baja" });
  return { ok: true };
}

/** Vincula (o desvincula, con `null`) un miembro activo a una profesional del equipo. */
export async function vincularEmpleada(
  acceso: Acceso,
  userId: string,
  employeeId: string | null,
  deps: DepsAccesos,
): Promise<ResultadoAccesos> {
  exigirGestion(acceso);
  const miembros = await deps.miembros();
  const m = miembros.find((x) => x.userId === userId && x.estado === "activa");
  if (!m) return { ok: false, codigo: "NO_EXISTE", motivo: "Esa persona no tiene acceso." };
  if (m.rol === "estilista" && !employeeId)
    return {
      ok: false,
      codigo: "DATOS",
      motivo: "Una estilista tiene que estar vinculada a una profesional.",
    };
  if (
    employeeId &&
    miembros.some(
      (x) => x.userId !== userId && x.estado === "activa" && x.employeeId === employeeId,
    )
  )
    return { ok: false, codigo: "DATOS", motivo: "Esa profesional ya tiene un acceso vinculado." };
  await deps.guardarMiembro({ ...m, employeeId });
  return { ok: true };
}

/**
 * Reactiva un acceso dado de baja: mismo rol y vínculo que tenía, si todavía
 * caben en el plan y la profesional no la ha tomado otra persona mientras
 * tanto.
 */
export async function reactivarMiembro(
  acceso: Acceso,
  userId: string,
  deps: DepsAccesos,
): Promise<ResultadoAccesos> {
  exigirGestion(acceso);
  const [miembros, invs, plan] = await Promise.all([
    deps.miembros(),
    deps.invitaciones(),
    deps.plan(),
  ]);
  const m = miembros.find((x) => x.userId === userId && x.estado === "baja");
  if (!m) return { ok: false, codigo: "NO_EXISTE", motivo: "Esa persona no está de baja." };
  if (
    m.employeeId &&
    miembros.some(
      (x) => x.userId !== userId && x.estado === "activa" && x.employeeId === m.employeeId,
    )
  )
    return { ok: false, codigo: "DATOS", motivo: "Esa profesional ya tiene un acceso vinculado." };
  const otros = miembros.filter((x) => x.userId !== userId);
  if (!cabeRol(m.rol, rolesEnUso(otros, invs), plan))
    return {
      ok: false,
      codigo: "PLAN",
      motivo: "Tu plan permite dos tipos de acceso. Para más, el plan Todo incluido.",
    };
  await deps.guardarMiembro({ ...m, estado: "activa" });
  return { ok: true };
}

export async function revocarInvitacion(
  acceso: Acceso,
  invitacionId: string,
  deps: DepsAccesos,
): Promise<ResultadoAccesos> {
  exigirGestion(acceso);
  const inv = (await deps.invitaciones()).find((i) => i.id === invitacionId);
  if (!inv || inv.aceptadaEn)
    return { ok: false, codigo: "NO_EXISTE", motivo: "No hay invitación pendiente." };
  await deps.guardarInvitacion({ ...inv, revocada: true });
  return { ok: true };
}

export async function reenviarInvitacion(
  acceso: Acceso,
  invitacionId: string,
  deps: DepsAccesos,
): Promise<ResultadoAccesos> {
  exigirGestion(acceso);
  const inv = (await deps.invitaciones()).find((i) => i.id === invitacionId);
  if (!inv || inv.aceptadaEn || inv.revocada)
    return { ok: false, codigo: "NO_EXISTE", motivo: "No hay invitación pendiente." };
  const caduca = new Date(
    deps.ahora().getTime() + DIAS_CADUCIDAD_INVITACION * 86_400_000,
  ).toISOString();
  await deps.guardarInvitacion({ ...inv, caduca });
  await deps.enviarInvitacion(inv.email, inv.id);
  return { ok: true };
}

/** Lista para Ajustes › Accesos: miembros activos e invitaciones pendientes. */
export async function listarAccesos(acceso: Acceso, deps: DepsAccesos) {
  exigirGestion(acceso);
  const [m, i] = await Promise.all([deps.miembros(), deps.invitaciones()]);
  const t = deps.ahora().getTime();
  return {
    miembros: m.filter((x) => x.estado === "activa"),
    invitaciones: i
      .filter((x) => !x.aceptadaEn && !x.revocada)
      .map((x) => ({ ...x, caducada: t > Date.parse(x.caduca) })),
  };
}

export { rolVigente };
