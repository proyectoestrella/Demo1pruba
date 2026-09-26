/**
 * Lista de espera, lote 16: el hueco que se propone al avisar, cuánto lleva
 * esperando cada una y los filtros. Puro, con test.
 */
import type { Appointment, Employee, WaitlistEntry } from "./mock/types";
import { citasDeCalendario, huecosDe, minutosDe } from "./calendario-arena";

export interface HuecoPropuesto {
  fecha: Date;
  employeeId: string;
}

/**
 * El primer hueco libre (a partir de ahora) donde cabe el servicio, con la
 * profesional que prefiere o con cualquiera. `null` si no hay en `dias` días.
 */
export function proximoHuecoPara(
  entry: Pick<WaitlistEntry, "preferredEmployeeId">,
  citas: Appointment[],
  equipo: Employee[],
  duracionMin: number,
  ahora: Date,
  dias = 14,
): HuecoPropuesto | null {
  const candidatas = entry.preferredEmployeeId === "any" ? equipo : equipo.filter((e) => e.id === entry.preferredEmployeeId);
  if (!candidatas.length) return null;
  // Solo las citas de la ventana (texto ISO, ±1 día por la zona): antes se
  // recorría la agenda entera una vez por día y por clienta en espera.
  const lo = new Date(ahora.getTime() - 86_400_000).toISOString();
  const hi = new Date(ahora.getTime() + (dias + 1) * 86_400_000).toISOString();
  const ventana = citas.filter((a) => a.start >= lo && a.start < hi);
  for (let i = 0; i < dias; i++) {
    const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i);
    const delDia = citasDeCalendario(ventana, dia);
    let mejor: HuecoPropuesto | null = null;
    for (const e of candidatas) {
      const t = huecosDe(delDia, e, dia.getDay(), { desde: i === 0 ? minutosDe(ahora) : undefined, minMin: Math.max(15, duracionMin) })[0];
      if (!t) continue;
      const f = new Date(dia);
      f.setHours(Math.floor(t.ini / 60), t.ini % 60, 0, 0);
      if (!mejor || f < mejor.fecha) mejor = { fecha: f, employeeId: e.id };
    }
    if (mejor) return mejor;
  }
  return null;
}

/** «hoy», «ayer», «hace 3 días», «hace 2 semanas». */
export function esperandoDesde(createdAt: string, ahora: Date): string {
  const d0 = new Date(createdAt);
  const a = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const b = Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate());
  const dias = Math.round((a - b) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 14) return `hace ${dias} días`;
  return `hace ${Math.floor(dias / 7)} semanas`;
}

/** Filtra por servicio y por profesional («any» casa con cualquier profesional elegida). */
export function filtrarEspera(lista: WaitlistEntry[], f: { servicio: string; profesional: string }): WaitlistEntry[] {
  return lista.filter(
    (w) =>
      (f.servicio === "todos" || w.serviceId === f.servicio) &&
      (f.profesional === "todas" || w.preferredEmployeeId === f.profesional || w.preferredEmployeeId === "any"),
  );
}
