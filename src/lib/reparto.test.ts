import { describe, expect, it } from "bun:test";
import {
  hourOccupancyPct,
  offeredCloseMin,
  lastOfferedHours,
  isBusyHour,
  pickAlternativeSlots,
  dayOccupancyBars,
  toDateKey,
  SECURITY_WINDOW,
  HIGH_OCCUPANCY_PCT,
  type SpreadSlot,
} from "./reparto";
import type { Appointment, Employee } from "./mock/types";

/** Un lunes cualquiera — weekday 1 — para no depender de qué día es "hoy". */
const MONDAY = "2026-09-21";

function employee(id: string, start: number, end: number): Employee {
  const schedule = Array(7).fill(null) as Array<{ start: number; end: number } | null>;
  schedule[1] = { start, end }; // lunes
  return {
    id: id as Employee["id"],
    name: id,
    specialty: "",
    yearsExperience: 1,
    photo: "",
    colorVar: "--x",
    schedule,
  };
}

function appt(employeeId: string, hour: number, minute = 0, durationMin = 60): Appointment {
  return {
    id: `a-${employeeId}-${hour}-${minute}`,
    clientId: "c1",
    clientName: "Cliente",
    serviceIds: ["corte"],
    employeeId: employeeId as Appointment["employeeId"],
    start: `${MONDAY}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
    duration: durationMin,
    priceEur: 20,
    status: "confirmed",
  };
}

describe("toDateKey", () => {
  it("usa la fecha local, no UTC", () => {
    const d = new Date(2026, 8, 18, 23, 30); // 18 sept 2026, 23:30 local
    expect(toDateKey(d)).toBe("2026-09-18");
  });
});

describe("hourOccupancyPct", () => {
  it("0% si nadie trabaja esa hora", () => {
    const employees = [employee("a", 10, 14)];
    expect(hourOccupancyPct([], MONDAY, 16, employees)).toBe(0);
  });

  it("0% si trabajan pero nadie tiene cita", () => {
    const employees = [employee("a", 10, 14), employee("b", 10, 14)];
    expect(hourOccupancyPct([], MONDAY, 11, employees)).toBe(0);
  });

  it("100% si todos los que trabajan esa hora tienen cita", () => {
    const employees = [employee("a", 10, 14), employee("b", 10, 14)];
    const appts = [appt("a", 12), appt("b", 12)];
    expect(hourOccupancyPct(appts, MONDAY, 12, employees)).toBe(100);
  });

  it("50% si solo uno de los dos que trabajan tiene cita", () => {
    const employees = [employee("a", 10, 14), employee("b", 10, 14)];
    const appts = [appt("a", 12)];
    expect(hourOccupancyPct(appts, MONDAY, 12, employees)).toBe(50);
  });

  it("ignora citas canceladas o de no-show", () => {
    const employees = [employee("a", 10, 14)];
    const appts: Appointment[] = [
      { ...appt("a", 12), status: "cancelled" },
      { ...appt("a", 12), status: "no-show" },
    ];
    expect(hourOccupancyPct(appts, MONDAY, 12, employees)).toBe(0);
  });
});

describe("offeredCloseMin / lastOfferedHours", () => {
  it("sin colchón, el cierre ofertado es el cierre real", () => {
    expect(offeredCloseMin(20 * 60, 0)).toBe(20 * 60);
  });

  it("con colchón, se adelanta esos minutos", () => {
    expect(offeredCloseMin(20 * 60 + 30, 90)).toBe(19 * 60); // 20:30 - 90min = 19:00
  });

  it("las últimas 2 horas ofertadas, con cierre a las 20:30 y colchón de 90 min", () => {
    // cierre ofertado 19:00 → últimas horas en punto: 18, 17
    expect(lastOfferedHours(9 * 60, offeredCloseMin(20 * 60 + 30, 90))).toEqual([18, 17]);
  });

  it("no da horas fuera del rango de apertura", () => {
    expect(lastOfferedHours(18 * 60, 19 * 60, 5)).toEqual([18]);
  });
});

describe("isBusyHour", () => {
  const noLastHours: number[] = [];

  it("con espera si la ocupación llega al umbral", () => {
    expect(isBusyHour(9, HIGH_OCCUPANCY_PCT, noLastHours)).toBe(true);
    expect(isBusyHour(9, HIGH_OCCUPANCY_PCT - 1, noLastHours)).toBe(false);
  });

  it("con espera dentro de la franja de seguridad aunque esté vacía", () => {
    expect(isBusyHour(SECURITY_WINDOW.start, 0, noLastHours)).toBe(true);
    expect(isBusyHour(SECURITY_WINDOW.end - 1, 0, noLastHours)).toBe(true);
    expect(isBusyHour(SECURITY_WINDOW.end, 0, noLastHours)).toBe(false);
  });

  it("con espera si es una de las últimas horas ofertadas", () => {
    expect(isBusyHour(18, 0, [17, 18])).toBe(true);
    expect(isBusyHour(16, 0, [17, 18])).toBe(false);
  });
});

describe("pickAlternativeSlots", () => {
  const slots: SpreadSlot[] = [
    { time: "10:00", available: true, busy: false },
    { time: "10:30", available: true, busy: false },
    { time: "11:00", available: false, busy: false },
    { time: "11:30", available: true, busy: false },
    { time: "12:00", available: true, busy: true },
    { time: "12:30", available: true, busy: true },
    { time: "13:00", available: true, busy: true },
    { time: "13:30", available: true, busy: false },
  ];

  it("da los 3 huecos libres y tranquilos más cercanos ANTES de la hora elegida", () => {
    expect(pickAlternativeSlots(slots, "13:00", 3)).toEqual(["10:00", "10:30", "11:30"]);
  });

  it("si no hay ninguno antes, da los siguientes tranquilos", () => {
    const soloDespues: SpreadSlot[] = [
      { time: "12:00", available: true, busy: true },
      { time: "12:30", available: true, busy: true },
      { time: "13:00", available: true, busy: false },
      { time: "13:30", available: true, busy: false },
    ];
    expect(pickAlternativeSlots(soloDespues, "12:00", 3)).toEqual(["13:00", "13:30"]);
  });

  it("un hueco desconocido no da alternativas", () => {
    expect(pickAlternativeSlots(slots, "23:00")).toEqual([]);
  });
});

describe("dayOccupancyBars", () => {
  it("una barra por cada hora en que trabaja alguien del equipo", () => {
    const employees = [employee("a", 10, 13)];
    const bars = dayOccupancyBars([], MONDAY, employees);
    expect(bars.map((b) => b.hour)).toEqual([10, 11, 12]);
  });

  it("vacío si nadie trabaja ese día", () => {
    const empleadoLibre = employee("a", 10, 13);
    empleadoLibre.schedule[1] = null; // cierra el lunes
    expect(dayOccupancyBars([], MONDAY, [empleadoLibre])).toEqual([]);
  });
});
