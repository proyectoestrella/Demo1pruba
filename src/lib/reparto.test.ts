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
  parsePriorityRange,
  formatPriorityRange,
  isPriorityTime,
  findNextAvailableSlot,
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

describe("parsePriorityRange / formatPriorityRange", () => {
  it("acepta un rango válido y lo convierte a minutos", () => {
    expect(parsePriorityRange("09:00-11:00")).toEqual({ startMin: 540, endMin: 660 });
  });

  it("rechaza un rango al revés o vacío", () => {
    expect(parsePriorityRange("11:00-09:00")).toBeNull();
    expect(parsePriorityRange("10:00-10:00")).toBeNull();
  });

  it("rechaza un formato que no es HH:mm-HH:mm", () => {
    expect(parsePriorityRange("9-11")).toBeNull();
    expect(parsePriorityRange("09:00 a 11:00")).toBeNull();
    expect(parsePriorityRange("25:00-26:00")).toBeNull();
  });

  it("format es el inverso exacto de parse", () => {
    const r = parsePriorityRange("09:05-11:30");
    expect(r).not.toBeNull();
    expect(formatPriorityRange(r!)).toBe("09:05-11:30");
  });
});

describe("isPriorityTime", () => {
  const ranges = ["09:00-11:00", "17:00-18:00"];

  it("dentro de una franja prioritaria", () => {
    expect(isPriorityTime("09:00", ranges)).toBe(true);
    expect(isPriorityTime("10:30", ranges)).toBe(true);
    expect(isPriorityTime("17:30", ranges)).toBe(true);
  });

  it("el final del rango no cuenta (medio-abierto)", () => {
    expect(isPriorityTime("11:00", ranges)).toBe(false);
  });

  it("fuera de cualquier franja", () => {
    expect(isPriorityTime("12:00", ranges)).toBe(false);
  });

  it("sin franjas configuradas, nunca es prioritaria", () => {
    expect(isPriorityTime("09:00", undefined)).toBe(false);
    expect(isPriorityTime("09:00", [])).toBe(false);
  });

  it("ignora una franja corrupta en vez de romper", () => {
    expect(isPriorityTime("09:00", ["no-es-un-rango"])).toBe(false);
  });
});

describe("findNextAvailableSlot", () => {
  const fromDate = new Date(2026, 8, 21); // lunes 21-sep-2026

  it("da la primera media hora libre del día si nadie tiene cita", () => {
    const employees = [employee("a", 10, 14)];
    const next = findNextAvailableSlot(employees, [], 30, "a", { fromDate });
    expect(next).toEqual({ dateKey: MONDAY, time: "10:00" });
  });

  it("salta al siguiente hueco si el primero está ocupado", () => {
    const employees = [employee("a", 10, 14)];
    const appts = [appt("a", 10, 0, 30)];
    const next = findNextAvailableSlot(employees, appts, 30, "a", { fromDate });
    expect(next).toEqual({ dateKey: MONDAY, time: "10:30" });
  });

  it('"any" mira a todo el equipo, no solo al primero', () => {
    const a = employee("a", 10, 11); // solo una hora, se llena enseguida
    const b = employee("b", 10, 14);
    const appts = [appt("a", 10, 0, 60)];
    const next = findNextAvailableSlot([a, b], appts, 30, "any", { fromDate });
    expect(next).toEqual({ dateKey: MONDAY, time: "10:00" }); // libre con "b"
  });

  it("pasa al día siguiente si hoy no hay hueco para ese profesional", () => {
    const a = employee("a", 10, 14);
    a.schedule[2] = { start: 10, end: 14 }; // también trabaja el martes
    const appts = [appt("a", 10, 0, 240)]; // ocupa todo el lunes
    const next = findNextAvailableSlot([a], appts, 30, "a", { fromDate });
    expect(next?.dateKey).toBe("2026-09-22");
  });

  it("respeta el colchón de cierre (lastSlotBufferMin)", () => {
    const employees = [employee("a", 19, 20)]; // 19:00-20:00
    const appts = [appt("a", 19, 0, 30)]; // ocupa el primer hueco
    // Sin colchón, quedaría libre a las 19:30. Con 30 min de colchón, ese
    // hueco deja de ofertarse y no hay ninguno más ese día.
    const next = findNextAvailableSlot(employees, appts, 30, "a", {
      fromDate,
      lastSlotBufferMin: 30,
      maxDays: 1,
    });
    expect(next).toBeUndefined();
  });

  it("undefined si el profesional elegido no existe en el equipo", () => {
    const employees = [employee("a", 10, 14)];
    expect(findNextAvailableSlot(employees, [], 30, "zzz", { fromDate })).toBeUndefined();
  });

  it("undefined si no hay hueco en todo el horizonte de búsqueda", () => {
    const employees = [employee("a", 10, 11)];
    // Cita de 24h que se repite conceptualmente: basta con que el único
    // hueco del único día que trabaja esté ocupado y el horizonte sea de 1 día.
    const appts = [appt("a", 10, 0, 60)];
    expect(
      findNextAvailableSlot(employees, appts, 30, "a", { fromDate, maxDays: 1 }),
    ).toBeUndefined();
  });
});
