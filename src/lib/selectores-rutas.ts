/**
 * Selectores memoizados para las rutas del panel (lote 15). Mismo resultado
 * que la función original; se recalculan solo si cambian los datos (identidad
 * de los arrays de la store), el minuto de «ahora» o los parámetros.
 * Ver `memo-datos.ts` y el banco `rendimiento-rutas.bench.ts`.
 *
 * FRONTEND: úsalos en lugar de la función original dentro de los componentes
 * de ruta; pasa los arrays TAL CUAL salen de la store (`s.appointments`), sin
 * `filter`/`map`/spread previos, o la caché no acierta nunca.
 */
import { memoPorDatos } from "./memo-datos";
import { aiInsights, revenueByDay, serviceMix, todayKpis, trendsForPeriod, weeklyOccupancy } from "./derive";
import { barrasDelPeriodo, citasDelRango, nuevasYRecurrentes, ocupacionPorProfesional, serviciosDelRango } from "./analitica-arena";
import { citasDelDia } from "./hoy-arena";
import { cierreDelDia } from "./caja";
import { buildCampanas, type CampanasInput } from "./campanas";
import { fichaDeClienta, type DatosFicha } from "./ficha-clienta";
import type { Appointment } from "./mock/types";

export const trendsForPeriodMemo = memoPorDatos(trendsForPeriod);
export const revenueByDayMemo = memoPorDatos(revenueByDay);
export const aiInsightsMemo = memoPorDatos(aiInsights);
export const serviceMixMemo = memoPorDatos(serviceMix);
export const todayKpisMemo = memoPorDatos(todayKpis);
export const weeklyOccupancyMemo = memoPorDatos(weeklyOccupancy);
export const barrasDelPeriodoMemo = memoPorDatos(barrasDelPeriodo);
export const citasDelRangoMemo = memoPorDatos(citasDelRango);
export const ocupacionPorProfesionalMemo = memoPorDatos(ocupacionPorProfesional);
export const serviciosDelRangoMemo = memoPorDatos(serviciosDelRango);
export const nuevasYRecurrentesMemo = memoPorDatos(nuevasYRecurrentes);
export const cierreDelDiaMemo = memoPorDatos(cierreDelDia);

const citasDelDiaPorDia = memoPorDatos((appts: Appointment[], diaMs: number) => citasDelDia(appts, new Date(diaMs)), 16);
/** `citasDelDia` memoizado por día (no por minuto: el día no cambia al pasar el minuto). */
export function citasDelDiaMemo(appts: Appointment[], dia: Date): Appointment[] {
  const d = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
  return citasDelDiaPorDia(appts, d.getTime());
}

const campanasMemo = memoPorDatos(
  (appointments: CampanasInput["appointments"], clients: CampanasInput["clients"], services: CampanasInput["services"], employees: CampanasInput["employees"], salonName: string, salonAddress: string, now: Date | undefined, timeZone: string | undefined) =>
    buildCampanas({ appointments, clients, services, employees, salonName, salonAddress, now, timeZone }),
);
/** `buildCampanas` memoizado (el objeto de entrada se desarma: cada campo cuenta por separado). */
export function buildCampanasMemo(i: CampanasInput) {
  return campanasMemo(i.appointments, i.clients, i.services, i.employees, i.salonName, i.salonAddress, i.now ?? new Date(), i.timeZone);
}

const fichaMemo = memoPorDatos(
  (clientId: string, citas: DatosFicha["citas"], clientes: DatosFicha["clientes"], servicios: DatosFicha["servicios"], equipo: DatosFicha["equipo"], ahora: Date) =>
    fichaDeClienta(clientId, { citas, clientes, servicios, equipo, ahora }),
  32,
);
export function fichaDeClientaMemo(clientId: string, d: DatosFicha) {
  return fichaMemo(clientId, d.citas, d.clientes, d.servicios, d.equipo, d.ahora);
}
