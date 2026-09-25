/**
 * Qué datos del salón recibe cada rol (lote 8). Puro: lo aplica
 * `listSalonData` después de leer, y se prueba sin Supabase.
 *
 * La seguridad está AQUÍ, no en ocultar botones: lo que no se manda no se
 * puede ver ni filtrar desde el navegador.
 */
import type { Appointment, Client, WaitlistEntry } from "../mock/types";
import { permisosDeAcceso, tienePermiso, type Acceso } from "./autorizacion";

export interface DatosPanel {
  appointments: Appointment[];
  clients: Client[];
  waitlist: WaitlistEntry[];
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
