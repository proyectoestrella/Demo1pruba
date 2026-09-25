/**
 * Comprobación mínima del motor de respuestas del asistente: que reconoce las
 * intenciones y que las cifras que devuelve salen de las citas que le pasas.
 *
 *   bun test
 */
import { expect, test } from "bun:test";
import { SUGGESTION_GROUPS, answerFor } from "./assistant-answers";
import { employees, services } from "./mock/salon";
import type { Appointment, Client } from "./mock/types";

/**
 * Las citas se fechan hoy a propósito: las intenciones de ingresos y ocupación
 * delegan en `derive.ts`, que siempre mira el reloj real, así que una fecha
 * fija haría que los importes salieran a cero.
 */
function todayAt(hour: number) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function daysAgoAt(days: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Día 15 del mes actual menos `n` meses — evita líos de fin de mes. */
function monthsAgoAt(monthsAgo: number, hour: number) {
  const d = new Date();
  d.setDate(15);
  d.setMonth(d.getMonth() - monthsAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

let seq = 0;

function appt(over: Partial<Appointment> = {}): Appointment {
  return {
    id: `a-${seq++}`,
    clientId: "c1",
    clientName: "Ana",
    serviceIds: ["corte"],
    employeeId: "mario",
    start: todayAt(11),
    duration: 45,
    priceEur: 38,
    status: "confirmed",
    ...over,
  };
}

function client(over: Partial<Client> = {}): Client {
  return {
    id: `c-${seq++}`,
    name: "Cliente",
    phone: "600000000",
    createdAt: daysAgoAt(200, 10),
    ...over,
  };
}

function ctx(appointments: Appointment[], clients: Client[] = []) {
  return { appointments, services, employees, waitlist: [], clients, salonName: "Test" };
}

test("cuenta las citas de hoy e ignora las canceladas", () => {
  const answer = answerFor(
    "¿cuántas citas tengo hoy?",
    ctx([appt(), appt({ status: "cancelled" })]),
  );
  expect(answer).toContain("1 cita");
});

test("los ingresos de hoy suman los precios del día", () => {
  const answer = answerFor(
    "¿cuánto he facturado?",
    ctx([appt({ priceEur: 38 }), appt({ priceEur: 22 })]),
  );
  expect(answer).toContain("60 €");
});

test("una cita con plantón no cuenta como ingreso", () => {
  const answer = answerFor(
    "ingresos",
    ctx([appt({ priceEur: 38 }), appt({ priceEur: 22, status: "no-show" })]),
  );
  expect(answer).toContain("38 €");
});

test("las tildes y mayúsculas no rompen el reconocimiento", () => {
  expect(answerFor("¿Cómo va la OCUPACIÓN?", ctx([appt()]))).toContain("ocupación");
});

test("una pregunta que no entiende se admite en vez de inventarse una respuesta", () => {
  const answer = answerFor("¿va a llover mañana?", ctx([appt()]));
  expect(answer).toContain("No sé responder");
});

test("la tasa de cancelaciones y de no-shows se calcula sobre el total de citas", () => {
  const answer = answerFor(
    "¿cuál es mi tasa de cancelaciones?",
    ctx([appt(), appt(), appt({ status: "cancelled" }), appt({ status: "no-show" })]),
  );
  expect(answer).toContain("25%");
});

test("detecta clientes inactivos por su última visita, no a los que acaban de venir", () => {
  const oldClient = client({ id: "old", name: "Elena" });
  const recentClient = client({ id: "recent", name: "Marta" });
  const answer = answerFor(
    "¿qué clientes están inactivos?",
    ctx(
      [
        appt({ clientId: "old", clientName: "Elena", start: daysAgoAt(90, 10) }),
        appt({ clientId: "recent", clientName: "Marta", start: daysAgoAt(2, 10) }),
      ],
      [oldClient, recentClient],
    ),
  );
  expect(answer).toContain("Elena");
  expect(answer).not.toContain("Marta");
});

test("la ocupación por profesional desglosa cada nombre del equipo", () => {
  const answer = answerFor(
    "¿cómo va la ocupación de cada profesional?",
    ctx([appt({ employeeId: "mario" }), appt({ employeeId: "diego" })]),
  );
  expect(answer).toContain("Mario");
  expect(answer).toContain("Diego");
});

test("el servicio más rentable por hora sale de precio y duración del catálogo, no de reservas", () => {
  const answer = answerFor("¿qué servicio es más rentable por hora?", ctx([]));
  // Afeitado a navaja: 16€ / 30 min = 32€/hora, el más alto del catálogo de ejemplo.
  expect(answer).toContain("Afeitado a navaja");
});

test("compara los ingresos del mes con el mes anterior", () => {
  const answer = answerFor(
    "¿cómo va este mes comparado con el anterior?",
    ctx([
      appt({ start: monthsAgoAt(0, 10), priceEur: 40 }),
      appt({ start: monthsAgoAt(1, 10), priceEur: 20 }),
    ]),
  );
  expect(answer).toMatch(/€/);
  expect(answer.toLowerCase()).toContain("mes pasado");
});

test("la recomendación general no inventa nada cuando no hay datos", () => {
  const answer = answerFor("dame una recomendación para hoy", ctx([]));
  expect(answer.length).toBeGreaterThan(0);
});

test("preguntas de ficha por nombre, color, historial y última visita", () => {
  const marta = client({ id: "marta", name: "Marta Martín", notes: "Alergia anotada" });
  const marisol = client({ id: "marisol", name: "Marisol Pérez" });
  const cristina = client({ id: "cristina", name: "Cristina López" });
  const elena = client({ id: "elena", name: "Elena García" });
  const valentina = client({ id: "valentina", name: "Valentina Ríos" });
  const citas = [appt({ clientId: "marta", clientName: marta.name, start: daysAgoAt(5, 10), status: "completed", colorFormula: "6.3", technicalNotes: "20 vol" })];
  const datos = ctx(citas, [marta, marisol, cristina, elena, valentina]);
  for (const pregunta of ["¿qué se ha hecho Marta Martín?", "Marta Martín"]) {
    const respuesta = answerFor(pregunta, datos);
    expect(respuesta).toContain("Ficha de Marta Martín");
    expect(respuesta).toContain("6.3");
    expect(respuesta).toContain("20 vol");
    expect(respuesta).toContain("Alergia anotada");
  }
  for (const [pregunta, nombre] of [["¿qué color lleva Marisol?", "Marisol"], ["ficha de Cristina", "Cristina"], ["cuándo vino Elena la última vez", "Elena"], ["historial de Valentina", "Valentina"]]) {
    expect(answerFor(pregunta, datos)).toContain(`Ficha de ${nombre}`);
  }
  expect(answerFor("ficha de Desconocida", datos)).toContain("No encuentro");
});

test("nombre de pila ambiguo y prioridad de ingresos", () => {
  const datos = ctx([], [client({ name: "Marta Martín" }), client({ name: "Marta Gómez" }), client({ name: "Inés Ruiz" })]);
  const respuesta = answerFor("ficha de Marta", datos);
  expect(respuesta).toContain("2 clientas");
  expect(respuesta).toContain("Marta Martín");
  expect(respuesta).toContain("Marta Gómez");
  expect(answerFor("ingresos", datos)).not.toContain("Ficha de Inés");
});

test("todas las preguntas sugeridas tienen respuesta, también las de «clientas»", () => {
  const ctx = { appointments: [], clients: [], services, employees, waitlist: [], salonName: "Prueba", now: new Date("2026-09-25T12:00:00") } as unknown as Parameters<typeof answerFor>[1];
  for (const g of SUGGESTION_GROUPS) {
    for (const q of g.items) expect(answerFor(q, ctx)).not.toContain("No sé responder a eso");
  }
});
