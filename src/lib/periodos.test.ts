import { describe, expect, it } from "bun:test";
import {
  capacidadDelRango,
  claveDeDia,
  comparar,
  deClaveDeDia,
  diasDelRango,
  enCurso,
  inicioDeDia,
  inicioDeMes,
  inicioDeSemana,
  metricasDePeriodo,
  periodosPrevios,
  rangoAnterior,
  rangoDePeriodo,
  resumenDePeriodo,
  textoComparacion,
  textoRango,
} from "./periodos";
import type { Appointment, Employee } from "./mock/types";

/** Equipo de una persona que trabaja de 10 a 14 todos los días — 8 huecos/día. */
const EQUIPO = [
  {
    id: "mario",
    name: "Mario",
    schedule: Array.from({ length: 7 }, () => ({ start: 10, end: 14 })),
  },
] as unknown as Employee[];

function cita(start: string, over: Partial<Appointment> = {}): Appointment {
  return {
    id: `a-${start}-${Math.random()}`,
    clientId: "c1",
    clientName: "Cliente",
    serviceIds: ["corte"],
    employeeId: "mario",
    start: new Date(start).toISOString(),
    duration: 30,
    priceEur: 20,
    status: "confirmed",
    ...over,
  } as Appointment;
}

describe("cortes de calendario", () => {
  it("la semana empieza en lunes, también si hoy es domingo", () => {
    // 2026-09-20 es domingo; su lunes es el 14.
    expect(claveDeDia(inicioDeSemana(new Date(2026, 8, 20, 23, 30)))).toBe("2026-09-14");
    // Y un lunes es su propio inicio de semana.
    expect(claveDeDia(inicioDeSemana(new Date(2026, 8, 14, 0, 1)))).toBe("2026-09-14");
    // Sábado 19 → sigue siendo la semana del 14.
    expect(claveDeDia(inicioDeSemana(new Date(2026, 8, 19, 12)))).toBe("2026-09-14");
  });

  it("inicioDeDia y inicioDeMes dejan la hora a cero", () => {
    const d = inicioDeDia(new Date(2026, 8, 20, 17, 45, 12, 500));
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([
      0, 0, 0, 0,
    ]);
    expect(claveDeDia(inicioDeMes(new Date(2026, 8, 20)))).toBe("2026-09-01");
  });

  it("deClaveDeDia interpreta la fecha en local, no en UTC", () => {
    expect(claveDeDia(deClaveDeDia("2026-01-01"))).toBe("2026-01-01");
    expect(deClaveDeDia("2026-01-01").getHours()).toBe(0);
  });
});

describe("rangoDePeriodo", () => {
  const now = new Date(2026, 8, 20, 13, 0); // domingo 20 sept 2026, 13:00

  it("hoy va de medianoche a medianoche", () => {
    const r = rangoDePeriodo("hoy", now);
    expect(claveDeDia(r.inicio)).toBe("2026-09-20");
    expect(claveDeDia(r.fin)).toBe("2026-09-21");
  });

  it("esta semana va del lunes al lunes siguiente", () => {
    const r = rangoDePeriodo("semana", now);
    expect(claveDeDia(r.inicio)).toBe("2026-09-14");
    expect(claveDeDia(r.fin)).toBe("2026-09-21");
    expect(diasDelRango(r)).toBe(7);
  });

  it("este mes cubre el mes natural entero", () => {
    const r = rangoDePeriodo("mes", now);
    expect(claveDeDia(r.inicio)).toBe("2026-09-01");
    expect(claveDeDia(r.fin)).toBe("2026-10-01");
    expect(diasDelRango(r)).toBe(30);
  });

  it("un rango a medida incluye el último día entero y se ordena solo", () => {
    const r = rangoDePeriodo("personalizado", now, { desde: "2026-09-10", hasta: "2026-09-12" });
    expect(claveDeDia(r.inicio)).toBe("2026-09-10");
    expect(claveDeDia(r.fin)).toBe("2026-09-13");
    const alReves = rangoDePeriodo("personalizado", now, {
      desde: "2026-09-12",
      hasta: "2026-09-10",
    });
    expect(claveDeDia(alReves.inicio)).toBe("2026-09-10");
    expect(claveDeDia(alReves.fin)).toBe("2026-09-13");
  });
});

describe("rangoAnterior", () => {
  it("de un día cerrado del pasado coge el día anterior entero", () => {
    const now = new Date(2026, 8, 25, 12, 0);
    const rango = rangoDePeriodo("personalizado", now, {
      desde: "2026-09-20",
      hasta: "2026-09-20",
    });
    const prev = rangoAnterior("personalizado", rango, now);
    expect(claveDeDia(prev.inicio)).toBe("2026-09-19");
    expect(claveDeDia(prev.fin)).toBe("2026-09-20");
  });

  it("de un periodo EN CURSO recorta el anterior al mismo tramo", () => {
    const now = new Date(2026, 8, 20, 13, 0);
    const rango = rangoDePeriodo("hoy", now);
    const prev = rangoAnterior("hoy", rango, now);
    expect(claveDeDia(prev.inicio)).toBe("2026-09-19");
    // Ayer, pero solo hasta las 13:00 — no el día entero.
    expect(prev.fin.getHours()).toBe(13);
  });

  it("un mes recién empezado se compara con los mismos días del mes pasado", () => {
    const now = new Date(2026, 8, 4, 0, 0); // 4 de septiembre
    const rango = rangoDePeriodo("mes", now);
    const prev = rangoAnterior("mes", rango, now);
    expect(claveDeDia(prev.inicio)).toBe("2026-08-01");
    expect(claveDeDia(prev.fin)).toBe("2026-08-04");
  });

  it("cambio de mes: el anterior de marzo es febrero entero", () => {
    const now = new Date(2026, 3, 5, 10, 0); // ya estamos en abril
    const rango = rangoDePeriodo("personalizado", now, {
      desde: "2026-03-01",
      hasta: "2026-03-31",
    });
    const prev = rangoAnterior("personalizado", rango, now);
    expect(claveDeDia(prev.fin)).toBe("2026-03-01");
    // 31 días antes del 1 de marzo → 29 de enero (2026 no es bisiesto: feb tiene 28)
    expect(diasDelRango(prev)).toBe(31);
  });

  it("cambio de año: enero se compara con diciembre del año anterior", () => {
    const now = new Date(2027, 0, 20, 12, 0);
    const rango = rangoDePeriodo("mes", now);
    expect(claveDeDia(rango.inicio)).toBe("2027-01-01");
    const prev = rangoAnterior("mes", rango, now);
    expect(claveDeDia(prev.inicio)).toBe("2026-12-01");
    expect(prev.inicio.getFullYear()).toBe(2026);
  });

  it("cambio de año en semana: la semana del 1 de enero arranca en diciembre", () => {
    const now = new Date(2027, 0, 1, 12, 0); // viernes 1 de enero de 2027
    const rango = rangoDePeriodo("semana", now);
    expect(claveDeDia(rango.inicio)).toBe("2026-12-28");
    const prev = rangoAnterior("semana", rango, now);
    expect(claveDeDia(prev.inicio)).toBe("2026-12-21");
  });
});

describe("periodosPrevios", () => {
  it("de meses devuelve meses naturales, no bloques de 30 días", () => {
    const now = new Date(2027, 0, 15, 12, 0);
    const cubos = periodosPrevios("mes", rangoDePeriodo("mes", now), 3);
    expect(cubos.map((r) => claveDeDia(r.inicio))).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
    ]);
  });

  it("de días devuelve días consecutivos terminando en el elegido", () => {
    const now = new Date(2026, 8, 20, 12, 0);
    const cubos = periodosPrevios("hoy", rangoDePeriodo("hoy", now), 3);
    expect(cubos.map((r) => claveDeDia(r.inicio))).toEqual([
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });
});

describe("capacidad y métricas", () => {
  it("la capacidad crece con los días del rango", () => {
    const dia = rangoDePeriodo("personalizado", new Date(2026, 8, 20), {
      desde: "2026-09-14",
      hasta: "2026-09-14",
    });
    const semana = rangoDePeriodo("personalizado", new Date(2026, 8, 20), {
      desde: "2026-09-14",
      hasta: "2026-09-20",
    });
    expect(capacidadDelRango(dia, EQUIPO)).toBe(8);
    expect(capacidadDelRango(semana, EQUIPO)).toBe(56);
  });

  it("cuenta citas, caja, ocupación y cancelaciones por separado", () => {
    const appts = [
      cita("2026-09-14T10:00:00"),
      cita("2026-09-14T11:00:00", { priceEur: 30, duration: 60 }),
      cita("2026-09-14T12:00:00", { status: "cancelled", priceEur: 50 }),
      cita("2026-09-14T13:00:00", { status: "no-show", priceEur: 40 }),
      cita("2026-09-15T10:00:00"), // fuera del rango de un solo día
    ];
    const rango = rangoDePeriodo("personalizado", new Date(2026, 8, 20), {
      desde: "2026-09-14",
      hasta: "2026-09-14",
    });
    const m = metricasDePeriodo(appts, rango, EQUIPO);
    expect(m.citas).toBe(3); // dos normales + el plantón; la cancelada no
    expect(m.caja).toBe(50); // 20 + 30; el plantón no paga
    expect(m.cancelaciones).toBe(1);
    // 30 + 60 + 30 (plantón ocupa silla) = 120 min = 4 huecos de 8 → 50 %
    expect(m.ocupacion).toBe(50);
  });

  it("un cliente es nuevo solo en el periodo de su PRIMERA cita", () => {
    const appts = [
      cita("2026-09-14T10:00:00", { clientId: "ana" }),
      cita("2026-09-21T10:00:00", { clientId: "ana" }),
      cita("2026-09-21T11:00:00", { clientId: "luis" }),
    ];
    const s1 = rangoDePeriodo("personalizado", new Date(2026, 8, 30), {
      desde: "2026-09-14",
      hasta: "2026-09-20",
    });
    const s2 = rangoDePeriodo("personalizado", new Date(2026, 8, 30), {
      desde: "2026-09-21",
      hasta: "2026-09-27",
    });
    expect(metricasDePeriodo(appts, s1, EQUIPO).clientesNuevos).toBe(1);
    expect(metricasDePeriodo(appts, s2, EQUIPO).clientesNuevos).toBe(1); // solo Luis
  });

  it("sin equipo abierto la ocupación es null, no un 0 que parezca un dato", () => {
    const cerrado = [
      { id: "x", name: "X", schedule: Array(7).fill(null) },
    ] as unknown as Employee[];
    const rango = rangoDePeriodo("hoy", new Date(2026, 8, 20));
    expect(metricasDePeriodo([], rango, cerrado).ocupacion).toBeNull();
  });
});

describe("honestidad de la comparación", () => {
  it("sin periodo anterior no hay porcentaje", () => {
    expect(comparar(5, 0).variacionPct).toBeNull();
    expect(comparar(0, 0).variacionPct).toBeNull();
    expect(comparar(5, null).variacionPct).toBeNull();
  });

  it("con periodo anterior sí lo hay, redondeado", () => {
    expect(comparar(110, 100).variacionPct).toBe(10);
    expect(comparar(50, 100).variacionPct).toBe(-50);
  });

  it("un mes recién empezado sin histórico no enseña tendencia", () => {
    const now = new Date(2026, 8, 2, 12, 0);
    const appts = [cita("2026-09-01T10:00:00")];
    const r = resumenDePeriodo(appts, "mes", EQUIPO, now);
    expect(r.parcial).toBe(true);
    expect(r.hayComparacion).toBe(false);
    expect(comparar(r.actual.citas, r.previo.citas).variacionPct).toBeNull();
  });

  it("un rango sin ninguna cita da ceros, no invenciones", () => {
    const now = new Date(2026, 8, 20, 12, 0);
    const r = resumenDePeriodo([], "personalizado", EQUIPO, now, {
      desde: "2026-01-05",
      hasta: "2026-01-11",
    });
    expect(r.actual.citas).toBe(0);
    expect(r.actual.caja).toBe(0);
    expect(r.hayComparacion).toBe(false);
  });

  it("con dos periodos con datos sí compara", () => {
    const now = new Date(2026, 8, 25, 12, 0);
    const appts = [
      cita("2026-09-14T10:00:00"),
      cita("2026-09-14T11:00:00"),
      cita("2026-09-07T10:00:00"),
    ];
    const r = resumenDePeriodo(appts, "personalizado", EQUIPO, now, {
      desde: "2026-09-14",
      hasta: "2026-09-20",
    });
    expect(r.actual.citas).toBe(2);
    expect(r.previo.citas).toBe(1);
    expect(r.hayComparacion).toBe(true);
    expect(comparar(r.actual.citas, r.previo.citas).variacionPct).toBe(100);
  });

  it("el domingo que el salón cierra se marca como cerrado", () => {
    // Equipo que libra los domingos (getDay() === 0) y trabaja el resto.
    const deLunesASabado = [
      {
        id: "mario",
        name: "Mario",
        schedule: [null, ...Array.from({ length: 6 }, () => ({ start: 10, end: 14 }))],
      },
    ] as unknown as Employee[];
    // 20 de septiembre de 2026 es domingo.
    const domingo = new Date(2026, 8, 20, 13, 0);
    const appts = [cita("2026-09-19T10:00:00"), cita("2026-09-19T11:00:00")];
    const r = resumenDePeriodo(appts, "hoy", deLunesASabado, domingo);
    expect(r.cerrado).toBe(true);
    expect(r.actual.citas).toBe(0);

    // Y el sábado, con el salón abierto, NO se marca cerrado.
    const sabado = new Date(2026, 8, 19, 13, 0);
    expect(resumenDePeriodo(appts, "hoy", deLunesASabado, sabado).cerrado).toBe(false);
  });

  it("la minigráfica trae ocho cubos", () => {
    const r = resumenDePeriodo([], "semana", EQUIPO, new Date(2026, 8, 20, 12));
    expect(r.series.citas).toHaveLength(8);
    expect(r.series.caja).toHaveLength(8);
  });
});

describe("textos en español", () => {
  const now = new Date(2026, 8, 20, 13, 0);

  it("dicen siempre contra qué se compara", () => {
    expect(textoComparacion("hoy", rangoDePeriodo("hoy", now), now)).toBe("vs. ayer a esta hora");
    expect(textoComparacion("semana", rangoDePeriodo("semana", now), now)).toBe(
      "vs. la semana pasada a estas alturas",
    );
    expect(textoComparacion("mes", rangoDePeriodo("mes", now), now)).toBe(
      "vs. el mes pasado a estas alturas",
    );
    const cerrado = rangoDePeriodo("personalizado", now, {
      desde: "2026-09-01",
      hasta: "2026-09-07",
    });
    expect(textoComparacion("personalizado", cerrado, now)).toBe("vs. los 7 días anteriores");
    const unDia = rangoDePeriodo("personalizado", now, {
      desde: "2026-09-01",
      hasta: "2026-09-01",
    });
    expect(textoComparacion("personalizado", unDia, now)).toBe("vs. el día anterior");
    expect(enCurso(cerrado, now)).toBe(false);
  });

  it("el rango se escribe en formato español", () => {
    expect(textoRango(rangoDePeriodo("hoy", now))).toContain("2026");
    const semana = textoRango(rangoDePeriodo("semana", now));
    expect(semana).toContain("–");
    expect(semana).not.toMatch(/Sep|Mon|Sun/);
  });
});
