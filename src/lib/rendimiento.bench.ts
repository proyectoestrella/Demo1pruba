/**
 * Perfil de rendimiento con la demo PeluChic (~3.300 citas). No es un test
 * (no lo recoge `bun test`): `TZ=UTC bun src/lib/rendimiento.bench.ts`.
 * Imprime la mediana de N vueltas de cada cálculo que corre el panel al
 * arrancar y en cada refresco periódico.
 */
import { datosPeluChic } from "./asistente/prueba-peluchic";
import { buildCampanas } from "./campanas";
import { resumenDePeriodo } from "./periodos";
import { solapaConAgenda } from "./solape";
import { reglaSenal, revisarVencimiento } from "./senal";
import { recortarDatosPanel } from "./api/recorte";

const AHORA = new Date("2026-09-25T10:00:00Z");
const d = datosPeluChic();

function medir(nombre: string, fn: () => unknown, n = 15): number {
  fn();
  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = performance.now();
    fn();
    t.push(performance.now() - a);
  }
  t.sort((x, y) => x - y);
  const med = t[Math.floor(n / 2)];
  console.log(`${nombre.padEnd(48)} ${med.toFixed(2).padStart(8)} ms`);
  return med;
}

console.log(`citas=${d.citas.length} clientas=${d.clientes.length} equipo=${d.equipo.length}`);
const datos = { appointments: d.citas, clients: d.clientes, waitlist: [] };
medir("JSON ida y vuelta (≈ respuesta del servidor)", () => JSON.parse(JSON.stringify(datos)));
medir("recortarDatosPanel (dueña)", () => recortarDatosPanel({ tipo: "propietario" } as never, datos));
medir("recortarDatosPanel (profesional)", () =>
  recortarDatosPanel({ tipo: "miembro", rol: "profesional", employeeId: d.equipo[0].id } as never, datos));
const regla = reglaSenal(d.perfil);
medir("liberarSenalesVencidas (revisarVencimiento ×n)", () => d.citas.filter((a) => revisarVencimiento(a, regla, AHORA).liberar));
medir("buildCampanas", () =>
  buildCampanas({ appointments: d.citas, clients: d.clientes, services: d.servicios, employees: d.equipo, salonName: "x", salonAddress: "y", now: AHORA }), 5);
// «En frío»: lista nueva en cada vuelta (como tras un refresco), sin memo.
medir("buildCampanas en frío", () =>
  buildCampanas({ appointments: [...d.citas], clients: d.clientes, services: d.servicios, employees: d.equipo, salonName: "x", salonAddress: "y", now: AHORA }), 5);
for (const p of ["hoy", "semana", "mes"] as const) {
  medir(`resumenDePeriodo ${p} en frío`, () => resumenDePeriodo([...d.citas], p, d.equipo, AHORA));
  medir(`resumenDePeriodo ${p} (misma lista)`, () => resumenDePeriodo(d.citas, p, d.equipo, AHORA));
}
const c = d.citas[100];
medir("solapaConAgenda (1 hueco)", () => solapaConAgenda(d.citas, { employeeId: c.employeeId, start: c.start, duration: 45 }));
medir("solapaConAgenda ×200 (rejilla de huecos)", () => {
  for (let i = 0; i < 200; i++) solapaConAgenda(d.citas, { employeeId: c.employeeId, start: c.start, duration: 45 });
}, 5);
import { conservarIguales } from "./conservar-iguales";
const llegada = JSON.parse(JSON.stringify(d.citas));
medir("conservarIguales (refresco sin cambios, 3.344 citas)", () => conservarIguales(llegada, d.citas));
