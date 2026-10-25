import { describe, expect, it } from "bun:test";
import { cabeCitaEnAgenda, exposicionDe, solapaConAgenda, tramosActivosDeCita, tramosActivosEnMinutos } from "./solape";
import type { Appointment, SalonProfile, Service } from "./mock/types";
import { PELUCHIC } from "./demos/peluchic";
import { servicesForType } from "./mock/salon";

const cita = (
  id: string,
  start: string,
  duration: number,
  extra: Partial<Appointment> = {},
): Appointment => ({
  id,
  clientId: "c",
  clientName: "Ana",
  serviceIds: ["corte"],
  employeeId: "mario",
  start,
  duration,
  priceEur: 10,
  status: "confirmed",
  ...extra,
});

describe("solapaConAgenda", () => {
  const agenda = [
    cita("a", "2026-09-28T08:00:00.000Z", 60),
    cita("b", "2026-09-28T09:00:00.000Z", 30, { employeeId: "diego" }),
    cita("c", "2026-09-28T10:00:00.000Z", 30, { status: "cancelled" }),
    cita("d", "2026-09-28T11:00:00.000Z", 30, { status: "no-show" }),
    cita("e", "2026-09-28T12:00:00.000Z", 30, { status: "blocked" }),
  ];

  it("devuelve las citas de la misma profesional que chocan", () => {
    expect(
      solapaConAgenda(agenda, {
        employeeId: "mario",
        start: "2026-09-28T08:30:00.000Z",
        duration: 30,
      }).map((a) => a.id),
    ).toEqual(["a"]);
  });

  it("horas contiguas, otra profesional, canceladas y plantones no chocan; un bloqueo sí", () => {
    expect(
      solapaConAgenda(agenda, {
        employeeId: "mario",
        start: "2026-09-28T09:00:00.000Z",
        duration: 30,
      }),
    ).toEqual([]);
    expect(
      solapaConAgenda(agenda, {
        employeeId: "mario",
        start: "2026-09-28T10:00:00.000Z",
        duration: 30,
      }),
    ).toEqual([]);
    expect(
      solapaConAgenda(agenda, {
        employeeId: "mario",
        start: "2026-09-28T11:00:00.000Z",
        duration: 30,
      }),
    ).toEqual([]);
    expect(
      solapaConAgenda(agenda, {
        employeeId: "mario",
        start: "2026-09-28T12:15:00.000Z",
        duration: 30,
      }).map((a) => a.id),
    ).toEqual(["e"]);
  });

  it("al mover una cita no se solapa consigo misma", () => {
    expect(
      solapaConAgenda(agenda, {
        employeeId: "mario",
        start: "2026-09-28T08:15:00.000Z",
        duration: 30,
        excluirId: "a",
      }),
    ).toEqual([]);
  });
});

describe("solape durante la exposición", () => {
  const color: Service = {
    id: "color-organico",
    name: "Color de cobertura Organico",
    description: "",
    durationMin: 60,
    priceEur: 40,
  };
  const corte: Service = {
    id: "corte",
    name: "Corte",
    description: "",
    durationMin: 15,
    priceEur: 15,
  };
  const servicios = { [color.id]: color, [corte.id]: corte };
  const perfil = {} satisfies Partial<SalonProfile>;
  const contexto = { servicios, perfil };
  const colorDeLasDiez = cita("color", "2026-09-28T10:00:00.000Z", 60, {
    serviceIds: [color.id],
  });
  const nueva = (start: string): Appointment =>
    cita("nueva", start, 15, { serviceIds: [corte.id] });

  it("deriva los valores de PeluChic y deja que una configuración explícita a 0 mande", () => {
    expect(exposicionDe(color, perfil)).toEqual({ aplicacionMin: 15, exposicionMin: 30 });
    expect(
      exposicionDe(
        { ...color, id: "color-10-minutos", name: "Color de cobertura en 10 minutos" },
        perfil,
      ),
    ).toEqual({ aplicacionMin: 15, exposicionMin: 10 });
    expect(exposicionDe({ ...color, id: "barros", name: "Barros tintóreos" }, perfil)).toEqual({
      aplicacionMin: 15,
      exposicionMin: 30,
    });
    expect(
      exposicionDe(color, {
        exposicionServicios: { [color.id]: { aplicacionMin: 15, exposicionMin: 0 } },
      }),
    ).toEqual({ aplicacionMin: 15, exposicionMin: 0 });
  });

  it("aplica el valor acordado a todos los colores reales de la carta de PeluChic", () => {
    const carta = servicesForType("peluqueria", PELUCHIC.menu);
    const colores = carta.filter(
      (servicio) => servicio.name.startsWith("Color") || servicio.name === "Barros tintóreos",
    );
    expect(colores.map((servicio) => servicio.id)).toEqual([
      "color-organico",
      "color-10-minutos",
      "barros",
    ]);
    expect(
      Object.fromEntries(
        colores.map((servicio) => [servicio.id, exposicionDe(servicio, PELUCHIC)]),
      ),
    ).toEqual({
      "color-organico": { aplicacionMin: 15, exposicionMin: 30 },
      "color-10-minutos": { aplicacionMin: 15, exposicionMin: 10 },
      barros: { aplicacionMin: 15, exposicionMin: 30 },
    });
  });

  it("color 60 (15 + 30 + 15): 10:15 cabe; 10:00 y 10:45 no", () => {
    expect(cabeCitaEnAgenda([colorDeLasDiez], nueva("2026-09-28T10:15:00.000Z"), contexto)).toBe(
      true,
    );
    expect(cabeCitaEnAgenda([colorDeLasDiez], nueva("2026-09-28T10:00:00.000Z"), contexto)).toBe(
      false,
    );
    expect(cabeCitaEnAgenda([colorDeLasDiez], nueva("2026-09-28T10:45:00.000Z"), contexto)).toBe(
      false,
    );
  });

  it("con máximo 2, una tercera clienta simultánea no cabe", () => {
    const segunda = cita("segunda", "2026-09-28T10:15:00.000Z", 30, {
      serviceIds: [color.id],
    });
    expect(
      cabeCitaEnAgenda([colorDeLasDiez, segunda], nueva("2026-09-28T10:30:00.000Z"), {
        servicios,
        perfil: { maxClientasExposicion: 2 },
      }),
    ).toBe(false);
  });

  it("un servicio sin exposición ocupa todo su tiempo, como antes", () => {
    const existente = cita("corte", "2026-09-28T10:00:00.000Z", 60, {
      serviceIds: [corte.id],
    });
    expect(cabeCitaEnAgenda([existente], nueva("2026-09-28T10:15:00.000Z"), contexto)).toBe(false);
  });

  it("en una cita de varios servicios solo descuenta la exposición dentro de su turno", () => {
    const combinada = cita("combo", "2026-09-28T10:00:00.000Z", 75, {
      serviceIds: [corte.id, color.id],
    });
    expect(tramosActivosDeCita(combinada, contexto)).toEqual([
      {
        desde: Date.parse("2026-09-28T10:00:00.000Z"),
        hasta: Date.parse("2026-09-28T10:30:00.000Z"),
      },
      {
        desde: Date.parse("2026-09-28T11:00:00.000Z"),
        hasta: Date.parse("2026-09-28T11:15:00.000Z"),
      },
    ]);
  });
});

describe("web pública: tramos activos sin servicios (25-oct)", () => {
  const servicios = { "color-organico": { id: "color-organico", name: "Color de cobertura Organico", durationMin: 60 }, corte: { id: "corte", name: "Corte", durationMin: 30 } };
  it("un color expone sus tramos; un corte, nada", () => {
    expect(tramosActivosEnMinutos({ start: "2026-10-27T08:00:00Z", duration: 60, serviceIds: ["color-organico"] }, { servicios })).toEqual([[0, 15], [45, 60]]);
    expect(tramosActivosEnMinutos({ start: "2026-10-27T08:00:00Z", duration: 30, serviceIds: ["corte"] }, { servicios })).toBeUndefined();
  });
  it("con los tramos, otra cita cabe en la exposición aunque no se sepan los servicios", () => {
    const anonima = { id: "a", employeeId: "e1", start: "2026-10-27T08:00:00Z", duration: 60, serviceIds: [], status: "confirmed", tramosActivos: [[0, 15], [45, 60]] as Array<[number, number]> };
    expect(cabeCitaEnAgenda([anonima], { employeeId: "e1", start: "2026-10-27T08:15:00Z", duration: 15, status: "pending" }, {})).toBe(true);
    expect(cabeCitaEnAgenda([anonima], { employeeId: "e1", start: "2026-10-27T08:00:00Z", duration: 15, status: "pending" }, {})).toBe(false);
  });
});

describe("web sin exposición (25-oct noche: coherente con la exclusión SQL)", () => {
  const servicios = { "color-organico": { id: "color-organico", name: "Color de cobertura Organico", durationMin: 60 } };
  const color = { id: "a", employeeId: "e1", start: "2026-10-27T08:00:00Z", duration: 60, serviceIds: ["color-organico"], status: "confirmed" };
  it("en el panel cabe otra cita en la exposición; en la web, no", () => {
    const nueva = { employeeId: "e1", start: "2026-10-27T08:15:00Z", duration: 15, status: "pending" };
    expect(cabeCitaEnAgenda([color], nueva, { servicios })).toBe(true);
    expect(cabeCitaEnAgenda([color], nueva, { servicios, sinExposicion: true })).toBe(false);
  });
});
