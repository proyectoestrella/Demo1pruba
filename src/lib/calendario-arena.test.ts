import { describe, expect, test } from "bun:test";
import type { Appointment, Employee } from "./mock/types";
import {
  celdasDelMes,
  citasDeCalendario,
  diasDeSemana,
  horizonteDeDias,
  horizonteDelDia,
  huecosDe,
  iniciales,
  ocupacionDe,
  pausasDe,
  porcentaje,
  carrilesSolapados,
} from "./calendario-arena";

function pro(id: string, rangos: Array<Array<{ start: number; end: number }>>): Employee {
  return {
    id,
    name: id,
    specialty: "",
    yearsExperience: 1,
    photo: "",
    colorVar: "--stylist-mario",
    schedule: [null, null, null, null, null, null, null],
    scheduleRanges: rangos,
  };
}

const h = (hh: number, mm = 0) => hh * 60 + mm;
const semana = (r: Array<{ start: number; end: number }>) => [[], r, r, r, r, r, [{ start: h(9), end: h(14) }]];

// María: 10-14 y 15-20 (comida de 14 a 15). Sara: 10-20 seguido.
const maria = pro("m", semana([{ start: h(10), end: h(14) }, { start: h(15), end: h(20) }]));
const sara = pro("s", semana([{ start: h(10), end: h(20) }]));

function cita(p: Partial<Appointment> & { start: string; duration: number }): Appointment {
  return {
    id: p.id ?? `${p.employeeId}-${p.start}`,
    clientId: "c",
    clientName: "Clienta",
    serviceIds: ["corte"],
    employeeId: p.employeeId ?? "m",
    priceEur: 25,
    status: p.status ?? "confirmed",
    ...p,
  };
}

const viernes = new Date("2026-09-25T12:40:00");

describe("horizonte", () => {
  test("de la primera entrada a la última salida, redondeado a la hora", () => {
    expect(horizonteDelDia([maria, sara], 5)).toEqual({ ini: h(10), fin: h(20) });
    expect(horizonteDelDia([maria, sara], 0)).toBeNull();
  });
  test("la semana une los horizontes de cada día", () => {
    const dias = diasDeSemana(viernes, [maria, sara]);
    expect(horizonteDeDias([maria, sara], dias)).toEqual({ ini: h(9), fin: h(20) });
  });
});

describe("pausas y huecos", () => {
  test("la comida es el hueco entre franjas", () => {
    expect(pausasDe(maria, 5)).toEqual([{ ini: h(14), fin: h(15) }]);
    expect(pausasDe(sara, 5)).toEqual([]);
  });
  test("huecos libres respetan citas y franjas", () => {
    const citas = [
      cita({ start: "2026-09-25T10:00:00", duration: 45 }),
      cita({ start: "2026-09-25T12:00:00", duration: 90 }), // hasta 13:30
      cita({ start: "2026-09-25T15:00:00", duration: 45 }),
    ];
    expect(huecosDe(citas, maria, 5)).toEqual([
      { ini: h(10, 45), fin: h(12) },
      { ini: h(13, 30), fin: h(14) },
      { ini: h(15, 45), fin: h(20) },
    ]);
  });
  test("con `desde`, lo pasado no sale y el hueco arranca en el siguiente cuarto", () => {
    const citas = [cita({ start: "2026-09-25T12:00:00", duration: 90 })];
    expect(huecosDe(citas, maria, 5, { desde: h(12, 40) })).toEqual([
      { ini: h(13, 30), fin: h(14) },
      { ini: h(15), fin: h(20) },
    ]);
    expect(huecosDe([], sara, 5, { desde: h(12, 40) })).toEqual([{ ini: h(12, 45), fin: h(20) }]);
  });
  test("un hueco de menos de 30 min no cuenta", () => {
    const citas = [
      cita({ start: "2026-09-25T10:00:00", duration: 45, employeeId: "s" }),
      cita({ start: "2026-09-25T11:00:00", duration: 540, employeeId: "s" }),
    ];
    expect(huecosDe(citas, sara, 5)).toEqual([]);
  });
});

describe("ocupación", () => {
  test("minutos reservados sobre la jornada, sin contar la comida ni los bloqueos", () => {
    const citas = [
      cita({ start: "2026-09-25T10:00:00", duration: 90 }),
      cita({ start: "2026-09-25T13:30:00", duration: 60 }), // 30 min caen en la comida
      cita({ start: "2026-09-25T16:00:00", duration: 60, status: "blocked" }),
    ];
    // jornada 9 h = 540 min; reservado 90 + 30 = 120 → 22 %
    expect(ocupacionDe(citas, maria, 5)).toBe(22);
    expect(ocupacionDe(citas, maria, 0)).toBe(0);
  });
});

describe("semana y mes", () => {
  test("la semana va de lunes a sábado si nadie abre el domingo", () => {
    const dias = diasDeSemana(viernes, [maria, sara]);
    expect(dias.map((d) => d.getDate())).toEqual([21, 22, 23, 24, 25, 26]);
  });
  test("un día que nadie trabaja no sale en la semana", () => {
    const sinLunes = pro("x", [[], [], [{ start: h(10), end: h(20) }], [{ start: h(10), end: h(20) }], [], [], []]);
    expect(diasDeSemana(viernes, [sinLunes]).map((d) => d.getDate())).toEqual([22, 23]);
  });
  test("sin horario, de lunes a sábado", () => {
    const nada = pro("x", [[], [], [], [], [], [], []]);
    expect(diasDeSemana(viernes, [nada])).toHaveLength(6);
  });
  test("con alguien que trabaja el domingo, la semana tiene 7 días", () => {
    const domingo = pro("d", [[{ start: h(10), end: h(14) }], [], [], [], [], [], []]);
    expect(diasDeSemana(viernes, [maria, domingo])).toHaveLength(7);
  });
  test("septiembre de 2026 empieza en lunes 31 de agosto y cabe en 5 semanas", () => {
    const celdas = celdasDelMes(viernes);
    expect(celdas).toHaveLength(35);
    expect(celdas[0].getDate()).toBe(31);
    expect(celdas[34].getDate()).toBe(4);
  });
});

describe("utilidades", () => {
  test("citas de calendario: sin canceladas, con bloqueos, por hora", () => {
    const lista = [
      cita({ start: "2026-09-25T15:00:00", duration: 45 }),
      cita({ start: "2026-09-25T10:00:00", duration: 45, status: "cancelled" }),
      cita({ start: "2026-09-25T11:00:00", duration: 45, status: "blocked" }),
      cita({ start: "2026-09-26T10:00:00", duration: 45 }),
    ];
    expect(citasDeCalendario(lista, viernes).map((a) => a.status)).toEqual(["blocked", "confirmed"]);
  });
  test("porcentaje e iniciales", () => {
    expect(porcentaje(h(15), { ini: h(10), fin: h(20) })).toBe(50);
    expect(iniciales("María")).toBe("MA");
    expect(iniciales("Ana Belén")).toBe("AB");
  });
});

describe("carrilesSolapados", () => {
  test("las que no se pisan van solas; las que se pisan se reparten", () => {
    const citas = [
      cita({ id: "a", start: "2026-09-25T10:00:00", duration: 60 }),
      cita({ id: "b", start: "2026-09-25T10:30:00", duration: 60 }), // pisa a «a»
      cita({ id: "c", start: "2026-09-25T11:00:00", duration: 30 }), // pisa a «b», cabe en el carril de «a»
      cita({ id: "d", start: "2026-09-25T12:00:00", duration: 30 }), // sola
    ];
    const r = carrilesSolapados(citas);
    expect(r.get("a")).toEqual({ carril: 0, total: 2 });
    expect(r.get("b")).toEqual({ carril: 1, total: 2 });
    expect(r.get("c")).toEqual({ carril: 0, total: 2 });
    expect(r.get("d")).toEqual({ carril: 0, total: 1 });
  });
});
