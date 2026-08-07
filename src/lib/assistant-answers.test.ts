/**
 * Comprobación mínima del motor de respuestas del asistente: que reconoce las
 * intenciones y que las cifras que devuelve salen de las citas que le pasas.
 *
 *   bun test
 */
import { expect, test } from "bun:test";
import { answerFor } from "./assistant-answers";
import { employees, services } from "./mock/salon";
import type { Appointment } from "./mock/types";

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

let seq = 0;

function appt(over: Partial<Appointment> = {}): Appointment {
  return {
    id: `a-${seq++}`,
    clientId: "c1",
    clientName: "Ana",
    serviceId: "haircut",
    employeeId: "mario",
    start: todayAt(11),
    duration: 45,
    priceEur: 38,
    status: "confirmed",
    ...over,
  };
}

function ctx(appointments: Appointment[]) {
  return { appointments, services, employees, waitlist: [], salonName: "Test" };
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
