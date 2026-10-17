import { describe, expect, test } from "bun:test";
import type { Appointment } from "./mock/types";
import { esCitaProxima, ordenarCitasProximasPrimero } from "./orden-citas";

function cita(id: string, start: string, duration = 30): Appointment {
  return {
    id,
    clientId: id,
    clientName: id,
    serviceIds: ["corte"],
    employeeId: "maria",
    start,
    duration,
    priceEur: 25,
    status: "confirmed",
  };
}

describe("ordenarCitasProximasPrimero", () => {
  const ahora = new Date("2026-10-17T10:30:00");

  test("pone las próximas por cercanía y después las anteriores por recencia", () => {
    const citas = [
      cita("antigua", "2026-10-16T10:00:00"),
      cita("manana", "2026-10-18T09:00:00"),
      cita("hoy-despues", "2026-10-17T11:00:00"),
      cita("hoy-antes", "2026-10-17T09:00:00"),
      cita("pasada-reciente", "2026-10-17T08:00:00"),
    ];

    expect(ordenarCitasProximasPrimero(citas, ahora).map((x) => x.id)).toEqual([
      "hoy-despues",
      "manana",
      "hoy-antes",
      "pasada-reciente",
      "antigua",
    ]);
  });

  test("una cita en curso es próxima y conserva los empates de hora", () => {
    const enCurso = cita("en-curso", "2026-10-17T10:00:00", 60);
    const citas = [
      cita("misma-hora-primera", "2026-10-17T11:00:00"),
      enCurso,
      cita("misma-hora-segunda", "2026-10-17T11:00:00"),
    ];

    expect(esCitaProxima(enCurso, ahora)).toBe(true);
    expect(ordenarCitasProximasPrimero(citas, ahora).map((x) => x.id)).toEqual([
      "en-curso",
      "misma-hora-primera",
      "misma-hora-segunda",
    ]);
  });
});
