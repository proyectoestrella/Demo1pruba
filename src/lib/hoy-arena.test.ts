import { describe, expect, test } from "bun:test";
import type { Appointment, Employee, Service } from "./mock/types";
import {
  minutosPersonalizados,
  citasDelDia,
  colorServicio,
  duracionCorta,
  faltaPara,
  fraseDelDia,
  huecosLibresDesde,
  opcionesDeDuracion,
  saludoPara,
} from "./hoy-arena";

function cita(p: Partial<Appointment> & { start: string; duration: number }): Appointment {
  return {
    id: p.id ?? p.start,
    clientId: "c1",
    clientName: p.clientName ?? "Adriana Díaz",
    serviceIds: p.serviceIds ?? ["novia"],
    employeeId: p.employeeId ?? "mario",
    priceEur: 25,
    status: p.status ?? "confirmed",
    ...p,
  };
}

const ahora = new Date("2026-09-25T12:40:00");

describe("citasDelDia", () => {
  test("solo las de ese día, sin canceladas ni bloqueos, por hora", () => {
    const lista = [
      cita({ start: "2026-09-25T15:00:00", duration: 45 }),
      cita({ start: "2026-09-25T10:00:00", duration: 45 }),
      cita({ start: "2026-09-25T11:00:00", duration: 45, status: "cancelled" }),
      cita({ start: "2026-09-26T10:00:00", duration: 45 }),
    ];
    expect(citasDelDia(lista, ahora).map((a) => a.start)).toEqual([
      "2026-09-25T10:00:00",
      "2026-09-25T15:00:00",
    ]);
  });
});

describe("huecosLibresDesde", () => {
  const equipo: Employee[] = [
    {
      id: "mario",
      name: "María",
      specialty: "",
      yearsExperience: 1,
      photo: "",
      colorVar: "--stylist-mario",
      schedule: [null, null, null, null, null, { start: 10, end: 20 }, null],
    },
  ];
  test("cuenta los huecos de 30 min o más desde ahora hasta el cierre", () => {
    const hoy = [
      cita({ start: "2026-09-25T12:00:00", duration: 90 }), // hasta 13:30
      cita({ start: "2026-09-25T15:00:00", duration: 45 }), // 15:00-15:45
    ];
    // 13:30-15:00 y 15:45-20:00 → 2 huecos
    expect(huecosLibresDesde(hoy, equipo, ahora)).toEqual({ total: 2, cierre: 20 * 60 });
  });
  test("un hueco de menos de 30 min no cuenta", () => {
    const hoy = [
      cita({ start: "2026-09-25T12:00:00", duration: 90 }),
      cita({ start: "2026-09-25T13:50:00", duration: 370 }), // hasta 20:00
    ];
    expect(huecosLibresDesde(hoy, equipo, ahora).total).toBe(0);
  });
});

describe("textos", () => {
  test("duración corta", () => {
    expect(duracionCorta(45)).toBe("45 min");
    expect(duracionCorta(60)).toBe("1 h");
    expect(duracionCorta(90)).toBe("1 h 30");
  });
  test("falta para", () => {
    expect(faltaPara(cita({ start: "2026-09-25T13:00:00", duration: 45 }), ahora)).toBe("en 20 min");
    expect(faltaPara(cita({ start: "2026-09-25T15:00:00", duration: 45 }), ahora)).toBe("en 2 h 20");
    expect(faltaPara(cita({ start: "2026-09-25T12:00:00", duration: 90 }), ahora)).toBe("");
  });
  test("saludo por hora", () => {
    expect(saludoPara(9)).toBe("Buenos días");
    expect(saludoPara(17)).toBe("Buenas tardes");
    expect(saludoPara(22)).toBe("Buenas noches");
  });
  test("frase del día con quién está ahora", () => {
    const hoy = [
      cita({ start: "2026-09-25T10:00:00", duration: 45, clientName: "Renata Mendoza" }),
      cita({ start: "2026-09-25T12:00:00", duration: 90, clientName: "Adriana Díaz" }),
      cita({ start: "2026-09-25T12:15:00", duration: 30, clientName: "Lucía Castillo", serviceIds: ["trat"] }),
      cita({ start: "2026-09-25T15:00:00", duration: 45, clientName: "Sofía Navarro" }),
    ];
    const nombre = (a: Appointment) => (a.serviceIds[0] === "trat" ? "Tratamiento capilar" : "Peinado de novia");
    expect(fraseDelDia(hoy, ahora, nombre)).toBe(
      "El día acaba de arrancar. Ahora mismo están Adriana con peinado de novia y Lucía con tratamiento capilar.",
    );
  });
  test("frase del día sin citas", () => {
    expect(fraseDelDia([], ahora, () => "")).toBe("Hoy no hay citas en la agenda.");
  });
});

describe("opcionesDeDuracion", () => {
  test("la propuesta y sus vecinas, cuatro en total", () => {
    expect(opcionesDeDuracion(40)).toEqual([30, 40, 45, 60]);
    expect(opcionesDeDuracion(15)).toEqual([15, 30, 40, 45]);
    expect(opcionesDeDuracion(180)).toEqual([90, 120, 150, 180]);
  });
  test("una duración fuera de la lista se incluye", () => {
    expect(opcionesDeDuracion(85)).toEqual([75, 85, 90, 120]);
  });
});

describe("colorServicio", () => {
  const carta = ["corte", "tinte", "mechas", "novia", "recogido", "trat", "extra"].map(
    (id) => ({ id, name: id, description: "", durationMin: 30, priceEur: 10 }) as Service,
  );
  test("un color por posición en la carta, cíclico", () => {
    expect(colorServicio("corte", carta)).toBe("var(--serv-1-borde)");
    expect(colorServicio("trat", carta)).toBe("var(--serv-6-borde)");
    expect(colorServicio("extra", carta)).toBe("var(--serv-1-borde)");
  });
  test("un servicio desconocido recibe el último color", () => {
    expect(colorServicio("nada", carta)).toBe("var(--serv-6-borde)");
  });
});

describe("duración escrita a mano («Otra…»)", () => {
  test("acepta minutos en pasos de 5 entre 5 y 480, con o sin «min»", () => {
    expect(minutosPersonalizados("35")).toEqual({ minutos: 35 });
    expect(minutosPersonalizados(" 480 min ")).toEqual({ minutos: 480 });
    expect(minutosPersonalizados("5")).toEqual({ minutos: 5 });
  });
  test("rechaza lo vacío, lo que no es número, lo que se sale y lo que no va de 5 en 5", () => {
    expect(minutosPersonalizados("")).toEqual({ error: "Escribe los minutos." });
    expect(minutosPersonalizados("1h")).toEqual({ error: "Solo un número de minutos, por ejemplo 35." });
    expect(minutosPersonalizados("-10")).toEqual({ error: "Solo un número de minutos, por ejemplo 35." });
    expect(minutosPersonalizados("0")).toEqual({ error: "Como mínimo, 5 minutos." });
    expect(minutosPersonalizados("485")).toEqual({ error: "Como máximo, 8 horas (480 minutos)." });
    expect(minutosPersonalizados("37")).toEqual({ error: "En pasos de 5 minutos: por ejemplo 35 o 40." });
  });
});
