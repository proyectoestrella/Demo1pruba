import { describe, expect, it } from "bun:test";
import { extraerClienta, extraerEntidades, extraerFecha, extraerHora, extraerNumero, extraerProfesional, extraerServicio } from "./entidades";
import { isoDelSalon } from "../zona-horaria";
import type { Client, Employee, Service } from "../mock/types";

// Viernes 25/09/2026 a las 19:30 de Madrid (17:30Z), que es cuando se escribió esto.
const AHORA = new Date(isoDelSalon("2026-09-25", "19:30"));
const f = (t: string) => extraerFecha(t, AHORA).fecha;

describe("fechas y periodos, en la zona del salón", () => {
  it("días relativos", () => {
    expect(f("citas de hoy")).toMatchObject({ tipo: "dia", dia: "2026-09-25", etiqueta: "hoy" });
    expect(f("q tengo mñn")).toMatchObject({ dia: "2026-09-26", etiqueta: "mañana" });
    expect(f("pasado mañana")).toMatchObject({ dia: "2026-09-27" });
    expect(f("ayer")).toMatchObject({ dia: "2026-09-24" });
    expect(f("anteayer")).toMatchObject({ dia: "2026-09-23" });
  });

  it("a las 23:30 de Madrid ya es mañana en UTC, pero «hoy» sigue siendo el 25", () => {
    expect(extraerFecha("hoy", new Date(isoDelSalon("2026-09-25", "23:30"))).fecha).toMatchObject({ dia: "2026-09-25" });
    expect(extraerFecha("mañana", new Date(isoDelSalon("2026-09-25", "00:30"))).fecha).toMatchObject({ dia: "2026-09-26" });
  });

  it("días de la semana: el próximo, hoy si es hoy, y «pasado» hacia atrás", () => {
    expect(f("quien viene el sabado")).toMatchObject({ dia: "2026-09-26" });
    expect(f("el lunes")).toMatchObject({ dia: "2026-09-28" });
    expect(f("el viernes")).toMatchObject({ dia: "2026-09-25" });
    expect(f("el viernes que viene")).toMatchObject({ dia: "2026-10-02" });
    expect(f("el martes pasado")).toMatchObject({ dia: "2026-09-22" });
  });

  it("semanas (lunes a domingo), finde, meses y año", () => {
    expect(f("esta semana")).toMatchObject({ tipo: "periodo", desde: "2026-09-21", hasta: "2026-09-27", dias: 7 });
    expect(f("la semana que viene")).toMatchObject({ desde: "2026-09-28", hasta: "2026-10-04" });
    expect(f("la semana pasada")).toMatchObject({ desde: "2026-09-14", hasta: "2026-09-20" });
    expect(f("este finde")).toMatchObject({ desde: "2026-09-26", hasta: "2026-09-27" });
    expect(f("este mes")).toMatchObject({ desde: "2026-09-01", hasta: "2026-09-30", dias: 30 });
    expect(f("el mes pasado")).toMatchObject({ desde: "2026-08-01", hasta: "2026-08-31" });
    expect(f("el mes que viene")).toMatchObject({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(f("ingresos de septiembre")).toMatchObject({ desde: "2026-09-01", hasta: "2026-09-30", etiqueta: "septiembre" });
    expect(f("este año")).toMatchObject({ desde: "2026-01-01", hasta: "2026-12-31" });
  });

  it("la semana del cambio de hora sigue teniendo 7 días", () => {
    const domingoCambio = new Date(isoDelSalon("2026-10-25", "12:00"));
    expect(extraerFecha("esta semana", domingoCambio).fecha).toMatchObject({ desde: "2026-10-19", hasta: "2026-10-25", dias: 7 });
  });

  it("fechas absolutas y rangos", () => {
    expect(f("el 3 de octubre")).toMatchObject({ dia: "2026-10-03" });
    expect(f("citas del 3/10")).toMatchObject({ dia: "2026-10-03" });
    expect(f("03-10")).toMatchObject({ dia: "2026-10-03" });
    expect(f("el 28")).toMatchObject({ dia: "2026-09-28" });
    expect(f("el 3")).toMatchObject({ dia: "2026-10-03" });
    expect(f("del 5 al 9 de octubre")).toMatchObject({ tipo: "periodo", desde: "2026-10-05", hasta: "2026-10-09", dias: 5 });
    expect(f("del 28 de septiembre al 3 de octubre")).toMatchObject({ desde: "2026-09-28", hasta: "2026-10-03", dias: 6 });
    expect(f("ultimos 30 dias")).toMatchObject({ desde: "2026-08-27", hasta: "2026-09-25", dias: 30 });
    expect(f("los últimos treinta días")).toMatchObject({ dias: 30 });
  });

  it("franjas: «por la mañana» no es el día de mañana", () => {
    expect(extraerFecha("huecos por la mañana", AHORA)).toMatchObject({ fecha: null, franja: { desdeMin: 0, hastaMin: 840 } });
    expect(extraerFecha("mañana por la tarde", AHORA)).toMatchObject({ fecha: { dia: "2026-09-26" }, franja: { desdeMin: 840 } });
    expect(extraerFecha("esta tarde", AHORA)).toMatchObject({ fecha: { dia: "2026-09-25" }, franja: { etiqueta: "por la tarde" } });
    expect(extraerFecha("hueco de 10 a 14 el sabado", AHORA)).toMatchObject({ fecha: { dia: "2026-09-26" }, franja: { desdeMin: 600, hastaMin: 840 } });
  });

  it("sin fecha, null (no se inventa «hoy»)", () => {
    expect(f("cuantas clientas tengo")).toBeNull();
  });
});

describe("hora y número", () => {
  it("hora suelta", () => {
    expect(extraerHora("hay hueco a las 17")).toBe(1020);
    expect(extraerHora("a las 5 de la tarde")).toBe(1020);
    expect(extraerHora("17:30")).toBe(1050);
    expect(extraerHora("cuantas citas")).toBeNull();
  });
  it("número que no es hora ni fecha", () => {
    expect(extraerNumero("las 5 clientas que mas gastan")).toBe(5);
    expect(extraerNumero("el 3/10 a las 17:30")).toBeNull();
  });
});

const equipo = [
  { id: "mario", name: "María" }, { id: "diego", name: "Sara" }, { id: "ruben", name: "Noelia" },
] as Employee[];
const servicios = [
  { id: "corte-y-peinado", name: "Corte y peinado", durationMin: 45, priceEur: 25 },
  { id: "tinte", name: "Tinte", durationMin: 40, priceEur: 35 },
  { id: "mechas-balayage", name: "Mechas / balayage", durationMin: 120, priceEur: 80 },
  { id: "recogido-de-evento", name: "Recogido de evento", durationMin: 60, priceEur: 45 },
] as Service[];
const clientas = [
  { id: "c1", name: "Marta Ruiz" }, { id: "c2", name: "Marta Ortega" }, { id: "c3", name: "Lucía Pérez" },
  { id: "c4", name: "Carmen López" }, { id: "c5", name: "Rosa Sánchez" },
] as Client[];

describe("profesional y servicio", () => {
  it("profesional por nombre, sin tilde y con una falta", () => {
    expect(extraerProfesional("como va maria hoy", equipo).map((e) => e.id)).toEqual(["mario"]);
    expect(extraerProfesional("citas de noelai", equipo).map((e) => e.id)).toEqual(["ruben"]);
    expect(extraerProfesional("cuantas citas hay", equipo)).toEqual([]);
  });
  it("servicio por nombre o alias", () => {
    expect(extraerServicio("cuanto cuesta el color", servicios).map((s) => s.id)).toEqual(["tinte"]);
    expect(extraerServicio("hueco para un balayage", servicios).map((s) => s.id)).toEqual(["mechas-balayage"]);
    expect(extraerServicio("un moño para una boda", servicios).map((s) => s.id)).toEqual(["recogido-de-evento"]);
    expect(extraerServicio("cuantas citas hay", servicios)).toEqual([]);
  });
});

describe("clienta: por su nombre, y si hay dudas se pregunta", () => {
  it("una sola con el nombre completo o un nombre único", () => {
    expect(extraerClienta("cuando vino lucia", clientas)).toMatchObject({ tipo: "una", clienta: { id: "c3" } });
    expect(extraerClienta("que color lleva marta ortega", clientas)).toMatchObject({ tipo: "una", clienta: { id: "c2" } });
    expect(extraerClienta("ficha de carmne", clientas)).toMatchObject({ tipo: "una", clienta: { id: "c4" } });
  });
  it("dos Martas: pregunta, no elige", () => {
    const r = extraerClienta("cuando vino marta", clientas);
    expect(r?.tipo).toBe("varias");
    if (r?.tipo === "varias") expect(r.opciones.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
  });
  it("el vocabulario del salón nunca es una clienta, y un desconocido es «ninguna»", () => {
    expect(extraerClienta("cuantas citas tengo mañana", clientas)).toBeNull();
    expect(extraerClienta("cuanto cuesta un tinte", clientas)).toBeNull();
    expect(extraerClienta("cuando vino pepita", clientas)).toMatchObject({ tipo: "ninguna" });
  });
  it("todo junto: una profesional llamada igual que una clienta no se toma por clienta", () => {
    const e = extraerEntidades("que citas tiene maria el sabado por la tarde", { clientes: [...clientas, { id: "c6", name: "María Gil" } as Client], equipo, servicios, ahora: AHORA });
    expect(e.profesionales.map((p) => p.id)).toEqual(["mario"]);
    expect(e.clienta).toBeNull();
    expect(e.fecha).toMatchObject({ dia: "2026-09-26" });
    expect(e.franja).toMatchObject({ etiqueta: "por la tarde" });
  });
});
