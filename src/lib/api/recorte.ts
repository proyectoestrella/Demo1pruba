/**
 * Qué datos del salón recibe cada rol (lote 8). Puro: lo aplica
 * `listSalonData` después de leer, y se prueba sin Supabase.
 *
 * La seguridad está AQUÍ, no en ocultar botones: lo que no se manda no se
 * puede ver ni filtrar desde el navegador.
 */
import type { Appointment, Client, WaitlistEntry } from "../mock/types";
import { permisosDeAcceso, tienePermiso, type Acceso } from "./autorizacion";
import type { Campana } from "../campanas";
import { planDe, tienePlan } from "../plan";
import { rangoDePeriodo } from "../periodos";

export interface DatosPanel {
  appointments: Appointment[];
  clients: Client[];
  waitlist: WaitlistEntry[];
}

/** La salida de marketing se calcula en servidor, tras el recorte de rol. */
export interface DatosPanelConPlan extends DatosPanel {
  campanas?: Campana[];
}

/** Una cita ajena sin nada de la clienta ni del dinero. */
export function comoBloqueOcupado(a: Appointment): Appointment {
  return {
    id: a.id,
    bloqueOcupado: true,
    clientId: "",
    clientName: "",
    serviceIds: [],
    employeeId: a.employeeId,
    start: a.start,
    duration: a.duration,
    priceEur: 0,
    status: a.status === "pending" ? "confirmed" : a.status,
  } as Appointment;
}

export function recortarDatosPanel(acceso: Acceso, d: DatosPanel): DatosPanel {
  const p = permisosDeAcceso(acceso);
  if (!p) return { appointments: [], clients: [], waitlist: [] };
  const mia = acceso.tipo === "miembro" ? acceso.employeeId : null;

  const verTodas = tienePermiso(acceso, "cita.ver-todas");
  const citas = verTodas
    ? d.appointments
    : d.appointments
        // Las ajenas canceladas no ocupan nada: ni siquiera se mandan como bloque.
        .filter((a) => a.employeeId === mia || a.status !== "cancelled")
        .map((a) => (mia && a.employeeId === mia ? a : comoBloqueOcupado(a)));

  const clientas = tienePermiso(acceso, "clienta.ver-todas")
    ? d.clients
    : tienePermiso(acceso, "clienta.ver")
      ? (() => {
          const suyas = new Set(d.appointments.filter((a) => mia && a.employeeId === mia).map((a) => a.clientId));
          return d.clients.filter((c) => suyas.has(c.id));
        })()
      : [];

  const espera = tienePermiso(acceso, "lista-espera.gestionar") ? d.waitlist : [];
  return { appointments: citas, clients: clientas, waitlist: espera };
}

/** Devuelve solo las campañas que el plan comprobado en servidor incluye. */
export function campanasPermitidasPorPlan(
  perfil: { plan?: string | null },
  acceso: Acceso,
  campanas: Campana[],
): Campana[] {
  // Las demos no son cuentas reales y conservan el muestrario completo.
  if (acceso.tipo === "demo") return campanas;
  const plan = planDe(perfil, false);
  return tienePlan(plan, "campanas-ampliadas")
    ? campanas
    : campanas.filter((campana) => campana.id === "resena");
}

/**
 * Núcleo de la respuesta de `listSalonData`: completa el recorte de rol con
 * el de plan. Básico recibe el mes actual, las 24 h anteriores (para la
 * reseña) y la agenda futura; Estándar conserva el histórico que necesita la
 * analítica avanzada. Las listas concretas de campañas ampliadas no salen de
 * aquí salvo para Embajador.
 */
export function recortarDatosPanelPorPlan(
  acceso: Acceso,
  perfil: { plan?: string | null; timeZone?: string },
  datos: DatosPanel,
  campanas: Campana[],
  ahora: Date = new Date(),
): DatosPanelConPlan {
  const porRol = recortarDatosPanel(acceso, datos);
  if (acceso.tipo === "demo") return { ...porRol, campanas };

  const plan = planDe(perfil, false);
  const permitidas = campanasPermitidasPorPlan(perfil, acceso, campanas);
  if (tienePlan(plan, "analitica-avanzada")) return { ...porRol, campanas: permitidas };

  const mes = rangoDePeriodo("mes", ahora, undefined, perfil.timeZone);
  // El primer día de mes puede llegar justo después de una cita de ayer.
  const desde = Math.min(+mes.inicio, +ahora - 24 * 60 * 60 * 1000);
  return {
    ...porRol,
    appointments: porRol.appointments.filter((cita) => {
      const instante = Date.parse(cita.start);
      return Number.isFinite(instante) && instante >= desde;
    }),
    campanas: permitidas,
  };
}
