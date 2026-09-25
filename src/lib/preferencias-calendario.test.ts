import { describe, expect, test } from "bun:test";
import { diasDeRejilla, horasDeRejilla, inicioDeSemana, pasoDeVista, preferenciasDe, tramosDeCitas, citasFueraDeHoras } from "./preferencias-calendario";
import type { Appointment } from "./mock/types";

const d = (s: string) => new Date(s + "T00:00:00");
const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;

describe("preferencias del calendario", () => {
  test("sin nada guardado abre en Semana, lunes, de 8 a 21", () => {
    expect(preferenciasDe(undefined)).toEqual({ vista: "semana", primerDia: 1, desde: 8, hasta: 21 });
  });
  test("sanea lo guardado: vista desconocida, horas al revés o fuera de rango", () => {
    expect(preferenciasDe({ vista: "tres", primerDia: 0, desde: 9, hasta: 20 })).toEqual({ vista: "tres", primerDia: 0, desde: 9, hasta: 20 });
    // @ts-expect-error: un valor viejo o corrupto en el perfil
    expect(preferenciasDe({ vista: "agenda" }).vista).toBe("semana");
    expect(preferenciasDe({ desde: 20, hasta: 10 })).toMatchObject({ desde: 20, hasta: 22 });
    expect(preferenciasDe({ desde: -3, hasta: 40 })).toMatchObject({ desde: 0, hasta: 24 });
  });
});

describe("días de la rejilla", () => {
  // Viernes 25 de septiembre de 2026.
  const viernes = d("2026-09-25");
  test("la semana empieza en el día elegido", () => {
    expect(iso(inicioDeSemana(viernes, 1))).toBe("2026-09-21");
    expect(iso(inicioDeSemana(viernes, 0))).toBe("2026-09-20");
    expect(iso(inicioDeSemana(viernes, 6))).toBe("2026-09-19");
    expect(diasDeRejilla(viernes, "semana", 1).map(iso)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
  });
  test("tres días seguidos desde el ancla, aunque crucen de mes", () => {
    expect(diasDeRejilla(d("2026-09-29"), "tres", 1).map(iso)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
    expect(diasDeRejilla(viernes, "dia", 1).map(iso)).toEqual(["2026-09-25"]);
    expect([pasoDeVista("dia"), pasoDeVista("tres"), pasoDeVista("semana")]).toEqual([1, 3, 7]);
  });
  test("las horas visibles se ensanchan para no esconder ninguna cita", () => {
    expect(horasDeRejilla({ desde: 9, hasta: 20 }, [{ ini: 8 * 60 + 30, fin: 9 * 60 + 30 }, { ini: 20 * 60, fin: 21 * 60 + 15 }])).toEqual({ desde: 8, hasta: 22 });
    expect(horasDeRejilla({ desde: 9, hasta: 20 }, [])).toEqual({ desde: 9, hasta: 20 });
  });
});

describe("horas visibles: el fallo de «de 7 a 18»", () => {
  const cita = (start: string, duration: number, status: Appointment["status"] = "confirmed") =>
    ({ id: start, clientId: "c", clientName: "C", serviceIds: [], employeeId: "m", start, duration, priceEur: 0, status }) as Appointment;
  const citas = [cita("2026-09-25T10:00:00", 60), cita("2026-09-25T16:30:00", 45), cita("2026-09-25T19:00:00", 60, "cancelled")];
  test("las horas elegidas se respetan; lo que cae fuera se cuenta para avisar", () => {
    const tramos = tramosDeCitas(citas);
    expect(citasFueraDeHoras(tramos, { desde: 7, hasta: 18 })).toBe(0);
    expect(citasFueraDeHoras(tramos, { desde: 7, hasta: 15 })).toBe(1);
    expect(citasFueraDeHoras(tramos, { desde: 11, hasta: 18 })).toBe(1);
    // «Ver todo el día» ensancha solo por las citas, no por la jornada.
    expect(horasDeRejilla({ desde: 7, hasta: 15 }, tramos)).toEqual({ desde: 7, hasta: 18 });
  });
  test("una cita cancelada no ensancha", () => {
    expect(tramosDeCitas(citas)).toEqual([{ ini: 600, fin: 660 }, { ini: 990, fin: 1035 }]);
  });
});
