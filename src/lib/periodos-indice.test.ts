/**
 * Barrido de calidad 2026-09-26: `metricasDePeriodo` ya no recorre todas las
 * citas por cada rango, usa un índice ordenado por lista. Esto comprueba que
 * da EXACTAMENTE lo mismo que la cuenta ingenua, con la lista desordenada,
 * citas sin fecha legible y la lista mutada entre llamadas (nueva identidad).
 */
import { describe, expect, it } from "bun:test";
import { datosPeluChic } from "./asistente/prueba-peluchic";
import { metricasDePeriodo, periodosPrevios, rangoDePeriodo, resumenDePeriodo } from "./periodos";
import type { Appointment } from "./mock/types";

const AHORA = new Date("2026-09-25T10:00:00Z");

function ingenuo(appts: Appointment[], inicio: Date, fin: Date) {
  let citas = 0, cancelaciones = 0;
  for (const a of appts) {
    const t = +new Date(a.start);
    if (!(t >= +inicio && t < +fin)) continue;
    if (a.status === "cancelled") cancelaciones++;
    else if (a.status !== "blocked") citas++;
  }
  return { citas, cancelaciones };
}

describe("índice de citas por fecha en periodos", () => {
  const d = datosPeluChic();
  const barajadas = [...d.citas].reverse();
  barajadas.splice(10, 0, { ...d.citas[0], id: "sin-fecha", start: "no-es-fecha" });

  it("mismas cifras que la cuenta ingenua en 8 semanas y 8 meses", () => {
    for (const id of ["semana", "mes"] as const) {
      for (const r of periodosPrevios(id, rangoDePeriodo(id, AHORA), 8)) {
        const m = metricasDePeriodo(barajadas, r, d.equipo);
        expect({ citas: m.citas, cancelaciones: m.cancelaciones }).toEqual(ingenuo(barajadas, r.inicio, r.fin));
      }
    }
  });

  it("una lista nueva (tras un refresco) no reutiliza el índice de la vieja", () => {
    const antes = resumenDePeriodo(d.citas, "hoy", d.equipo, AHORA).actual.citas;
    const hoy = rangoDePeriodo("hoy", AHORA);
    const extra: Appointment = { ...d.citas[0], id: "nueva", status: "confirmed", start: new Date(+hoy.inicio + 3_600_000).toISOString() };
    expect(resumenDePeriodo([...d.citas, extra], "hoy", d.equipo, AHORA).actual.citas).toBe(antes + 1);
  });

  it("salón vacío: todo a cero", () => {
    const r = resumenDePeriodo([], "mes", d.equipo, AHORA);
    expect([r.actual.citas, r.actual.caja, r.actual.clientesNuevos]).toEqual([0, 0, 0]);
  });
});
