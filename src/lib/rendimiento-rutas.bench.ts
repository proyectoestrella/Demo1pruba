/**
 * Banco de rendimiento de lo que se calcula al entrar en cada ruta del panel
 * con la demo PeluChic (≈3.400 citas). No es un test: se ejecuta a mano con
 *   bun run src/lib/rendimiento-rutas.bench.ts
 * y escribe una tabla con la mediana en ms por función (primera llamada y
 * llamadas repetidas con los mismos datos, que es lo que pasa al volver a
 * una ruta). Ver docs/lote-15-backend-2026-09-26.md.
 */
import { datosPeluChicArena, asistentePeluChicArena } from "./asistente/prueba-peluchic-arena";
import { aiInsights, trendsForPeriod, revenueByDay, serviceMix, todayKpis, weeklyOccupancy, clientFrequency } from "./derive";
import { citasDelDia, huecosLibresDesde } from "./hoy-arena";
import { barrasDelPeriodo, ocupacionPorProfesional, serviciosDelRango, nuevasYRecurrentes } from "./analitica-arena";
import { cierreDelDia } from "./caja";
import { buildCampanas } from "./campanas";
import { fichaDeClienta } from "./ficha-clienta";
import { rangoDePeriodo } from "./periodos";
import { buildCampanasMemo, trendsForPeriodMemo, revenueByDayMemo, ocupacionPorProfesionalMemo, aiInsightsMemo } from "./selectores-rutas";

function medir(nombre: string, fn: () => unknown, veces = 15): { nombre: string; primera: number; mediana: number } {
  const t0 = performance.now();
  fn();
  const primera = performance.now() - t0;
  const ts: number[] = [];
  for (let i = 0; i < veces; i++) {
    const t = performance.now();
    fn();
    ts.push(performance.now() - t);
  }
  ts.sort((a, b) => a - b);
  return { nombre, primera, mediana: ts[Math.floor(ts.length / 2)] };
}

export function bancoRutas() {
  const { estado, equipo } = datosPeluChicArena();
  const citas = estado.appointments;
  const ahora = new Date();
  const hoy = citasDelDia(citas, ahora);
  const mes = rangoDePeriodo("mes", ahora);
  const clienta = estado.clients[5]?.id ?? "";
  const filas = [
    medir("hoy · citasDelDia", () => citasDelDia(citas, ahora)),
    medir("hoy · huecosLibresDesde", () => huecosLibresDesde(hoy, equipo, ahora)),
    medir("hoy · todayKpis", () => todayKpis(citas)),
    medir("caja · cierreDelDia", () => cierreDelDia(citas, equipo, ahora)),
    medir("analítica · trendsForPeriod(mes)", () => trendsForPeriod(citas, "mes", ahora)),
    medir("analítica · barrasDelPeriodo(mes)", () => barrasDelPeriodo(citas, "mes", mes, equipo, ahora)),
    medir("analítica · ocupacionPorProfesional", () => ocupacionPorProfesional(citas, mes, equipo)),
    medir("analítica · serviciosDelRango", () => serviciosDelRango(citas, mes, estado.services)),
    medir("analítica · nuevasYRecurrentes", () => nuevasYRecurrentes(citas, mes)),
    medir("analítica · aiInsights", () => aiInsights(citas, equipo, ahora)),
    medir("analítica · revenueByDay", () => revenueByDay(citas)),
    medir("analítica · serviceMix", () => serviceMix(citas)),
    medir("analítica · weeklyOccupancy", () => weeklyOccupancy(citas)),
    medir("campañas · buildCampanas", () =>
      buildCampanas({ appointments: citas, clients: estado.clients, services: estado.services, employees: equipo, salonName: "PeluChic", salonAddress: "", now: ahora }),
    ),
    medir("clientas · fichaDeClienta", () => fichaDeClienta(clienta, { citas, clientes: estado.clients, servicios: estado.services, equipo, ahora })),
    medir("clientas · clientFrequency", () => clientFrequency(citas, clienta, ahora)),
    medir("memo · trendsForPeriodMemo(mes)", () => trendsForPeriodMemo(citas, "mes", ahora)),
    medir("memo · revenueByDayMemo", () => revenueByDayMemo(citas)),
    medir("memo · ocupacionPorProfesionalMemo", () => ocupacionPorProfesionalMemo(citas, mes, equipo)),
    medir("memo · aiInsightsMemo", () => aiInsightsMemo(citas, equipo, ahora)),
    medir("memo · buildCampanasMemo", () =>
      buildCampanasMemo({ appointments: citas, clients: estado.clients, services: estado.services, employees: equipo, salonName: "PeluChic", salonAddress: "", now: ahora }),
    ),
    medir("asistente · crear + precalentar", () => asistentePeluChicArena({ ahora }).asistente.precalentar(), 5),
  ];
  return { citas: citas.length, clientas: estado.clients.length, filas };
}

if (import.meta.main) {
  const t = performance.now();
  const r = bancoRutas();
  console.log(`Demo PeluChic: ${r.citas} citas, ${r.clientas} clientas (datos en ${(performance.now() - t).toFixed(0)} ms en total)`);
  console.log("| Función | 1.ª llamada (ms) | Repetida, mediana (ms) |\n|---|---:|---:|");
  for (const f of r.filas) console.log(`| ${f.nombre} | ${f.primera.toFixed(2)} | ${f.mediana.toFixed(2)} |`);
}
