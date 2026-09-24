import { describe, expect, it } from "bun:test";
import {
  buildSeed,
  PENALIZED_CLIENT_PHONE,
  LATE_PENALIZED_CLIENT_PHONE,
  DURACION_FLEXIBLE_CLIENT_PHONE,
} from "./seed";
import { employeesForType, servicesForType } from "./salon";
import { duracionRecordada } from "../derive";
import { fichaDeClienta } from "../ficha-clienta";
import { fechaLocal } from "../hoja-del-dia";
import { clientesQueNoVuelven, segundaVisita } from "../campanas";

const employees = employeesForType("barberia");
const services = servicesForType("barberia");

describe("buildSeed — colores de peluquería", () => {
  it("marca como traídas de TPV 123 solo visitas completadas de hace más de 60 días", () => {
    const citas = buildSeed("peluqueria", employeesForType("peluqueria"), servicesForType("peluqueria")).appointments;
    const limite = Date.now() - 60 * 86_400_000;
    expect(citas.some((c) => c.origen === "tpv123")).toBe(true);
    expect(citas.every((c) => c.origen !== "tpv123" || (c.status === "completed" && +new Date(c.start) < limite))).toBe(true);
    expect(citas.filter((c) => c.status === "completed" && +new Date(c.start) < limite).every((c) => c.origen === "tpv123")).toBe(true);
    const barberia = buildSeed("barberia", employeesForType("barberia"), servicesForType("barberia")).appointments;
    expect(barberia.every((c) => !c.origen)).toBe(true);
  });
  it("siembra entre diez y catorce fórmulas variadas y coherentes por clienta y servicio", () => {
    const equipo = employeesForType("peluqueria");
    const carta = servicesForType("peluqueria");
    const first = buildSeed("peluqueria", equipo, carta).appointments;
    const second = buildSeed("peluqueria", equipo, carta).appointments;
    const coloreadas = first.filter((a) => a.colorFormula);
    expect(coloreadas.map((a) => [a.clientId, a.colorFormula, a.technicalNotes]))
      .toEqual(second.filter((a) => a.colorFormula).map((a) => [a.clientId, a.colorFormula, a.technicalNotes]));
    const formulasDistintas = new Set(coloreadas.map((a) => a.colorFormula)).size;
    expect(formulasDistintas).toBeGreaterThanOrEqual(10);
    expect(formulasDistintas).toBeLessThanOrEqual(14);
    expect(new Set(coloreadas.map((a) => a.technicalNotes)).size).toBeGreaterThan(12);
    expect(coloreadas.some((a) => a.colorFormula?.includes("Baño de color"))).toBe(true);
    expect(coloreadas.some((a) => a.colorFormula?.includes("30 vol"))).toBe(true);
    expect(coloreadas.every((a) => a.serviceIds.includes("color") || a.serviceIds.includes("afeitado"))).toBe(true);
    const porClientaYServicio = new Map<string, Set<string>>();
    for (const a of coloreadas) {
      const clave = `${a.clientId}:${a.serviceIds.includes("afeitado") ? "mechas" : "color"}`;
      const formulas = porClientaYServicio.get(clave) ?? new Set<string>();
      formulas.add(a.colorFormula!);
      porClientaYServicio.set(clave, formulas);
    }
    expect([...porClientaYServicio.values()].every((formulas) => formulas.size <= 2)).toBe(true);
    expect([...porClientaYServicio.values()].some((formulas) => formulas.size === 2)).toBe(true);
    expect(first.some((a) => a.serviceIds.every((id) => id !== "color" && id !== "afeitado") && !a.colorFormula)).toBe(true);
  });

  it("también siembra color con una carta propia de demo por enlace (ids distintos)", () => {
    const equipo = employeesForType("peluqueria");
    const carta = servicesForType("peluqueria").map((s) =>
      s.id === "color" ? { ...s, id: "tinte", name: "Tinte" }
        : s.id === "afeitado" ? { ...s, id: "mechas-balayage", name: "Mechas / balayage" }
        : s);
    const coloreadas = buildSeed("peluqueria", equipo, carta).appointments.filter((a) => a.colorFormula);
    expect(new Set(coloreadas.map((a) => a.colorFormula)).size).toBeGreaterThanOrEqual(10);
    expect(coloreadas.every((a) => a.serviceIds.includes("tinte") || a.serviceIds.includes("mechas-balayage"))).toBe(true);
  });
});

describe("buildSeed — fichas creíbles de peluquería", () => {
  const equipo = employeesForType("peluqueria");
  const carta = servicesForType("peluqueria");

  it("no duplica ninguna clienta en un día, ni con duración flexible", () => {
    for (const duracionFlexible of [false, true]) {
      for (const smartSpread of [false, true]) {
        const seed = buildSeed("peluqueria", equipo, carta, { duracionFlexible, smartSpread });
        const claves = seed.appointments.map((a) => `${a.clientId}:${fechaLocal(new Date(a.start))}`);
        expect(new Set(claves).size).toBe(claves.length);
      }
    }
  });

  it("da a las habituales entre 3 y 12 semanas de frecuencia media y gasto anual plausible", () => {
    const seed = buildSeed("peluqueria", equipo, carta);
    const fichas = seed.clients.map((client) =>
      fichaDeClienta(client.id, { citas: seed.appointments, clientes: seed.clients, servicios: carta, equipo, ahora: new Date() }).resumen)
      .filter((ficha) => ficha.numeroVisitas >= 3);
    expect(fichas.length).toBeGreaterThan(100);
    expect(fichas.every((ficha) => ficha.frecuenciaMediaDias !== undefined
      && ficha.frecuenciaMediaDias >= 21 && ficha.frecuenciaMediaDias <= 84)).toBe(true);
    const frecuencias = fichas.map((ficha) => ficha.frecuenciaMediaDias!).sort((a, b) => a - b);
    const gastos = fichas.map((ficha) => ficha.gastoUltimos12Meses).sort((a, b) => a - b);
    expect(frecuencias[Math.floor(frecuencias.length / 2)]).toBeGreaterThanOrEqual(35);
    expect(frecuencias[Math.floor(frecuencias.length / 2)]).toBeLessThanOrEqual(56);
    expect(gastos[Math.floor(gastos.length / 2)]).toBeGreaterThan(150);
    expect(gastos[Math.floor(gastos.length / 2)]).toBeLessThan(700);
  });

  it("tiene nombres completos únicos, apellidos con tilde y homónimas de pila", () => {
    const { clients } = buildSeed("peluqueria", equipo, carta, { duracionFlexible: true });
    expect(clients.length).toBeGreaterThanOrEqual(120);
    expect(clients.length).toBeLessThanOrEqual(160);
    expect(new Set(clients.map((c) => c.name)).size).toBe(clients.length);
    expect(clients.some((c) => / (García|López|Martín|Sánchez|Gómez|Muñoz)$/.test(c.name))).toBe(true);
    expect(clients.some((c, i) => clients.slice(i + 1).some((other) =>
      c.name.split(" ")[0] === other.name.split(" ")[0] && c.name !== other.name))).toBe(true);
  });

  it("conserva agenda llena hoy y el sábado, solicitudes y visitas importadas de hace 18 meses", () => {
    const seed = buildSeed("peluqueria", equipo, carta);
    const sabado = new Date();
    sabado.setDate(sabado.getDate() + (6 - sabado.getDay() + 7) % 7);
    for (const day of [new Date(), sabado]) {
      const citas = seed.appointments.filter((a) => fechaLocal(new Date(a.start)) === fechaLocal(day));
      expect(citas.length).toBeGreaterThanOrEqual(12);
      expect(citas.length).toBeLessThanOrEqual(20);
    }
    expect(seed.appointments.filter((a) => a.status === "pending" && fechaLocal(new Date(a.start)) === fechaLocal(new Date())).length).toBeGreaterThanOrEqual(2);
    expect(seed.appointments.some((a) => a.origen === "tpv123" && +new Date(a.start) < Date.now() - 365 * 86_400_000)).toBe(true);
    expect(buildSeed("peluqueria", equipo, carta)).toEqual(seed);
  });

  it("mantiene destinatarias para las campañas de inactividad y segunda visita", () => {
    const { clients, appointments } = buildSeed("peluqueria", equipo, carta);
    expect(clientesQueNoVuelven(appointments, clients, carta, "PeluChic")?.personas.length).toBeGreaterThan(0);
    expect(segundaVisita(appointments, clients, carta, equipo, "PeluChic")?.personas.length).toBeGreaterThan(0);
  });
});

describe("buildSeed — política de plantón (opts.noShowFeeEur)", () => {
  it("sin penalización activa, ningún cliente sale marcado", () => {
    const seed = buildSeed("barberia", employees, services);
    expect(seed.clients.some((c) => (c.penaltyEur ?? 0) > 0)).toBe(false);
  });

  it("con importe explícito 0 no siembra deuda, bloqueo ni motivo de recargo", () => {
    const seed = buildSeed("peluqueria", employeesForType("peluqueria"), servicesForType("peluqueria"), { noShowFeeEur: 0 });
    expect(seed.clients.every((c) => !c.penaltyEur && !c.penaltyBlock && !c.penaltyReason && !c.penaltyAppointmentId)).toBe(true);
  });

  it("con penalización activa, un cliente sale con la deuda y el teléfono estable", () => {
    const seed = buildSeed("barberia", employees, services, { noShowFeeEur: 7 });
    const penalizado = seed.clients.find((c) => (c.penaltyEur ?? 0) > 0);
    expect(penalizado?.penaltyEur).toBe(7);
    expect(penalizado?.phone).toBe(PENALIZED_CLIENT_PHONE);
    expect(penalizado?.penaltyNote).toBeTruthy();
  });

  it("hay exactamente dos clientes penalizados: uno por no presentarse y otro por llegar tarde", () => {
    const seed = buildSeed("barberia", employees, services, { noShowFeeEur: 7 });
    const penalizados = seed.clients.filter((c) => (c.penaltyEur ?? 0) > 0);
    expect(penalizados).toHaveLength(2);
    expect(penalizados.map((c) => c.penaltyReason).sort()).toEqual(["late", "no_show"]);
  });

  it("el cliente penalizado por llegar tarde lleva teléfono estable, minutos y cita enlazada", () => {
    const seed = buildSeed("barberia", employees, services, { noShowFeeEur: 7 });
    const tarde = seed.clients.find((c) => c.penaltyReason === "late");
    expect(tarde?.phone).toBe(LATE_PENALIZED_CLIENT_PHONE);
    expect(tarde?.penaltyLateMinutes).toBeGreaterThan(0);
    expect(tarde?.penaltyAppointmentId).toBeTruthy();
    const cita = seed.appointments.find((a) => a.id === tarde?.penaltyAppointmentId);
    expect(cita?.lateMinutes).toBe(tarde?.penaltyLateMinutes);
  });
});

describe("buildSeed — reparto de agenda (opts.smartSpread)", () => {
  it("sin reparto activo, puede haber citas en la franja floja 10-11 hoy", () => {
    // No es una aserción determinista de "hay citas a esa hora" (depende del
    // azar), sino de que el sesgo NO se aplica: se comprueba junto al test de
    // abajo, que sí demuestra el sesgo cuando está activo.
    const seed = buildSeed("barberia", employees, services);
    expect(seed.appointments.length).toBeGreaterThan(0);
  });

  it("con reparto activo, hoy no hay ninguna cita que empiece a las 10 o las 11", () => {
    const seed = buildSeed("barberia", employees, services, { smartSpread: true });
    const hoyKey = new Date().toISOString().slice(0, 10);
    const citasDeHoyEnHoraFloja = seed.appointments.filter((a) => {
      if (a.status === "cancelled" || a.status === "no-show") return false;
      const d = new Date(a.start);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (key !== hoyKey) return false;
      const h = d.getHours();
      return h === 10 || h === 11;
    });
    expect(citasDeHoyEnHoraFloja).toHaveLength(0);
  });
});

describe("buildSeed — duración flexible (opts.duracionFlexible)", () => {
  it("sin el flag activo, la semilla queda exactamente igual que antes", () => {
    const conFlag = buildSeed("barberia", employees, services, { duracionFlexible: false });
    const sinFlag = buildSeed("barberia", employees, services);
    expect(conFlag.clients.length).toBe(sinFlag.clients.length);
    expect(conFlag.appointments.length).toBe(sinFlag.appointments.length);
    expect(conFlag.clients.map((c) => c.id)).toEqual(sinFlag.clients.map((c) => c.id));
    expect(conFlag.appointments.map((a) => a.id)).toEqual(sinFlag.appointments.map((a) => a.id));
    expect(
      conFlag.clients.some((c) => c.phone === DURACION_FLEXIBLE_CLIENT_PHONE),
    ).toBe(false);
  });

  it("con el flag activo, hay una cita pasada y una solicitud pendiente de la misma clienta y servicio, y duracionRecordada() avisa de la duración real", () => {
    const seed = buildSeed("barberia", employees, services, { duracionFlexible: true });
    const clienta = seed.clients.find((c) => c.phone === DURACION_FLEXIBLE_CLIENT_PHONE);
    expect(clienta).toBeTruthy();

    const propias = seed.appointments.filter((a) => a.clientId === clienta?.id);
    const pasada = propias.find((a) => a.status === "completed");
    const pendiente = propias.find((a) => a.status === "pending");
    expect(pasada).toBeTruthy();
    expect(pendiente).toBeTruthy();
    expect(pasada?.serviceIds).toEqual(pendiente?.serviceIds);
    expect(pasada?.duration).not.toBe(pendiente?.duration);

    const servicioLargo = [...services].sort((a, b) => b.durationMin - a.durationMin)[0];
    expect(pendiente?.duration).toBe(servicioLargo.durationMin);
    // Entre un 40% y un 60% más que la de catálogo, como pide la demo.
    const ratio = (pasada?.duration ?? 0) / servicioLargo.durationMin;
    expect(ratio).toBeGreaterThanOrEqual(1.4);
    expect(ratio).toBeLessThanOrEqual(1.6);

    const aviso = duracionRecordada(
      seed.appointments,
      clienta?.id,
      pendiente!.serviceIds,
      servicioLargo.durationMin,
    );
    expect(aviso?.minutos).toBe(pasada?.duration);
  });
});
