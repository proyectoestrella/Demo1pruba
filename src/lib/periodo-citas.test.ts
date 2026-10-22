import { describe, expect, test } from "bun:test";
import { citasDelPeriodo, enRango, PERIODOS_CITAS, rangoDeCitas } from "./periodo-citas";
import { BOM, resumenCitasToCsv } from "./export-csv";
import type { Appointment, Employee, Service } from "./mock/types";

const MADRID = "Europe/Madrid";
const iso = (d: Date | undefined) => d?.toISOString();

describe("rangoDeCitas: días naturales de Madrid, [inicio, fin)", () => {
  // 22-oct-2026 10:00 en Madrid (CEST, UTC+2).
  const ahora = new Date("2026-10-22T08:00:00Z");

  test("Todas las fechas no corta", () => {
    expect(rangoDeCitas("todo", ahora, MADRID)).toBeNull();
  });
  test("Hoy: de 00:00 a 00:00 del día siguiente en Madrid", () => {
    const r = rangoDeCitas("hoy", ahora, MADRID)!;
    expect(iso(r.inicio)).toBe("2026-10-21T22:00:00.000Z");
    expect(iso(r.fin)).toBe("2026-10-22T22:00:00.000Z");
  });
  test("Últimos 7 días: hoy y los seis anteriores, enteros", () => {
    const r = rangoDeCitas("7d", ahora, MADRID)!;
    expect(iso(r.inicio)).toBe("2026-10-15T22:00:00.000Z");
    expect(iso(r.fin)).toBe("2026-10-22T22:00:00.000Z");
  });
  test("Últimos 30 días", () => {
    const r = rangoDeCitas("30d", ahora, MADRID)!;
    expect(iso(r.inicio)).toBe("2026-09-22T22:00:00.000Z");
    expect(iso(r.fin)).toBe("2026-10-22T22:00:00.000Z");
  });
  test("Este mes y mes pasado: del día 1 al día 1", () => {
    const mes = rangoDeCitas("mes", ahora, MADRID)!;
    expect(iso(mes.inicio)).toBe("2026-09-30T22:00:00.000Z");
    expect(iso(mes.fin)).toBe("2026-10-31T23:00:00.000Z"); // 1-nov ya en horario de invierno
    const pasado = rangoDeCitas("mes-anterior", ahora, MADRID)!;
    expect(iso(pasado.inicio)).toBe("2026-08-31T22:00:00.000Z");
    expect(iso(pasado.fin)).toBe("2026-09-30T22:00:00.000Z");
  });
  test("30 días que cruzan el cambio de hora (25-oct) siguen siendo días enteros", () => {
    const r = rangoDeCitas("7d", new Date("2026-10-28T09:00:00Z"), MADRID)!;
    expect(iso(r.inicio)).toBe("2026-10-21T22:00:00.000Z"); // 22-oct 00:00 CEST
    expect(iso(r.fin)).toBe("2026-10-28T23:00:00.000Z"); // 29-oct 00:00 CET
  });
  test("mes pasado en enero es diciembre del año anterior", () => {
    const r = rangoDeCitas("mes-anterior", new Date("2027-01-01T00:30:00Z"), MADRID)!;
    expect(iso(r.inicio)).toBe("2026-11-30T23:00:00.000Z");
    expect(iso(r.fin)).toBe("2026-12-31T23:00:00.000Z");
  });
  test("a las 00:30 de Madrid ya es el día nuevo aunque en UTC sea el anterior", () => {
    const r = rangoDeCitas("hoy", new Date("2026-10-31T22:30:00Z"), MADRID)!; // 31-oct 23:30 CET
    expect(iso(r.inicio)).toBe("2026-10-30T23:00:00.000Z");
    const r2 = rangoDeCitas("hoy", new Date("2026-10-31T23:30:00Z"), MADRID)!; // 1-nov 00:30 CET
    expect(iso(r2.inicio)).toBe("2026-10-31T23:00:00.000Z");
  });
  test("todas las opciones tienen etiqueta y nombre de archivo", () => {
    for (const p of PERIODOS_CITAS) {
      expect(p.label.length).toBeGreaterThan(2);
      expect(p.archivo).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe("citasDelPeriodo: bordes", () => {
  const ahora = new Date("2026-10-22T08:00:00Z");
  const c = (id: string, start: string, status: Appointment["status"] = "confirmed") => ({ id, start, status });
  const citas = [
    c("ultimo-mes-pasado", "2026-09-30T21:59:00Z"), // 30-sep 23:59 Madrid
    c("primero-del-mes", "2026-09-30T22:00:00Z"), // 1-oct 00:00 Madrid
    c("hace-7", "2026-10-15T21:59:00Z"), // 15-oct 23:59: fuera de 7 días
    c("dentro-7", "2026-10-15T22:00:00Z"), // 16-oct 00:00
    c("hoy-temprano", "2026-10-21T22:00:00Z"),
    c("hoy-tarde", "2026-10-22T19:00:00Z"),
    c("hoy-cancelada", "2026-10-22T09:00:00Z", "cancelled"),
    c("manana", "2026-10-22T22:00:00Z"),
    c("fin-de-mes", "2026-10-31T22:59:00Z"), // 31-oct 23:59 CET
    c("noviembre", "2026-10-31T23:00:00Z"),
  ];
  const ids = (p: Parameters<typeof citasDelPeriodo>[1]) => citasDelPeriodo(citas, p, ahora, MADRID).map((x) => x.id);

  test("Hoy incluye las de más tarde y las canceladas; no la de mañana", () => {
    expect(ids("hoy")).toEqual(["hoy-temprano", "hoy-tarde", "hoy-cancelada"]);
  });
  test("Últimos 7 días corta a medianoche de Madrid", () => {
    expect(ids("7d")).toEqual(["dentro-7", "hoy-temprano", "hoy-tarde", "hoy-cancelada"]);
  });
  test("Este mes: del 1-oct 00:00 al 31-oct 23:59, futuras del mes incluidas", () => {
    expect(ids("mes")).toEqual(["primero-del-mes", "hace-7", "dentro-7", "hoy-temprano", "hoy-tarde", "hoy-cancelada", "manana", "fin-de-mes"]);
  });
  test("Mes pasado: solo septiembre", () => {
    expect(ids("mes-anterior")).toEqual(["ultimo-mes-pasado"]);
  });
  test("Todas las fechas: todo", () => {
    expect(ids("todo")).toHaveLength(citas.length);
  });
  test("periodo vacío", () => {
    expect(citasDelPeriodo([], "mes", ahora, MADRID)).toEqual([]);
    expect(citasDelPeriodo(citas, "hoy", new Date("2030-01-01T10:00:00Z"), MADRID)).toEqual([]);
  });
  test("enRango sin rango es siempre verdadero", () => {
    expect(enRango({ start: "1999-01-01T00:00:00Z" }, null)).toBe(true);
  });
});

describe("resumenCitasToCsv", () => {
  const SERVICES: Record<string, Service> = {
    corte: { id: "corte", name: "Corte", description: "", durationMin: 30, priceEur: 20 },
    color: { id: "color", name: "Color", description: "", durationMin: 60, priceEur: 60 },
  };
  const pro = (id: string, name: string) =>
    ({ id, name, specialty: "", yearsExperience: 1, photo: "", colorVar: "--x", schedule: [null, null, null, null, null, null, null] }) as Employee;
  const EMPLOYEES = { ana: pro("ana", "Ana"), lua: pro("lua", "Lúa") };
  const cita = (o: Partial<Appointment>): Appointment =>
    ({ id: "x", clientId: "c", clientName: "María José", serviceIds: ["corte"], employeeId: "ana", start: "2026-10-22T08:00:00Z", duration: 30, priceEur: 20, status: "completed", ...o }) as Appointment;
  const ahora = new Date("2026-10-22T16:05:00Z");
  const lineas = (csv: string) => csv.slice(BOM.length).split("\r\n");

  test("BOM, «;», fechas dd/mm/aaaa en Madrid y euros con coma", () => {
    const csv = resumenCitasToCsv(
      [
        cita({ id: "1", start: "2026-10-21T22:30:00Z", priceEur: 20.5 }), // 22-oct 00:30 Madrid
        cita({ id: "2", serviceIds: ["corte", "color"], priceEur: 80, employeeId: "lua", status: "late" }),
        cita({ id: "3", status: "cancelled", priceEur: 20 }),
        cita({ id: "4", status: "confirmed", priceEur: 60, serviceIds: ["color"], start: "2026-10-23T08:00:00Z" }),
        cita({ id: "5", status: "no-show", priceEur: 20 }),
      ],
      SERVICES,
      EMPLOYEES,
      { periodo: "Este mes (1 oct – 31 oct)", salon: "PeluChic", timeZone: MADRID, ahora },
    );
    expect(csv.startsWith(BOM)).toBe(true);
    const l = lineas(csv);
    expect(l[0]).toBe("Resumen de citas · PeluChic");
    expect(l).toContain("Periodo;Este mes (1 oct – 31 oct)");
    expect(l).toContain("Generado;22/10/2026 18:05");
    expect(l).toContain("Citas (sin canceladas);4");
    expect(l).toContain("Canceladas;1");
    expect(l).toContain("Ingresos: vino o vino tarde (€);100,50");
    expect(l).toContain("Previsto: pendientes, confirmadas y en el salón (€);60,00");
    expect(l).toContain("Cancelada;1;20,00");
    expect(l).toContain("No vino;1;20,00");
    // 80 € de «Corte + Color» repartidos 20/60 por precio de carta.
    expect(l).toContain("Corte;2;40,50");
    expect(l).toContain("Color;2;60,00");
    expect(l).toContain("Lúa;1;80,00");
    expect(l).toContain("Ana;2;20,50"); // la cancelada y la de «No vino» no cuentan
    expect(l).toContain("Fecha;Hora;Clienta;Servicio;Profesional;Precio (€);Estado;Respuestas al reservar");
    expect(l).toContain("22/10/2026;00:30;María José;Corte;Ana;20,50;Vino;");
    expect(l).toContain("22/10/2026;10:00;María José;Corte + Color;Lúa;80,00;Vino tarde sin avisar;");
    expect(l).toContain("22/10/2026;10:00;María José;Corte;Ana;20,00;Cancelada;");
  });

  test("periodo vacío: totales a cero y una línea que lo dice", () => {
    const l = lineas(resumenCitasToCsv([], SERVICES, EMPLOYEES, { periodo: "Hoy", timeZone: MADRID, ahora }));
    expect(l).toContain("Citas (sin canceladas);0");
    expect(l).toContain("Ingresos: vino o vino tarde (€);0,00");
    expect(l[l.length - 1]).toBe("Sin citas en este periodo.");
  });

  test("escapa «;» y comillas, y neutraliza fórmulas", () => {
    const l = lineas(
      resumenCitasToCsv([cita({ clientName: 'Ana; "la del 3º"' }), cita({ clientName: "=HYPERLINK(1)" })], SERVICES, EMPLOYEES, { periodo: "Hoy", timeZone: MADRID, ahora, filtros: "Estado: Vino" }),
    );
    expect(l).toContain("Filtros;Estado: Vino");
    expect(l.some((x) => x.startsWith('22/10/2026;10:00;"Ana; ""la del 3º""";'))).toBe(true);
    expect(l.some((x) => x.includes(";'=HYPERLINK(1);"))).toBe(true);
  });
});
