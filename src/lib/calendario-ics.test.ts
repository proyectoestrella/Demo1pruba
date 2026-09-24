import { expect, it } from "bun:test";
import { generarCalendarioIcs, type CitaCalendario } from "./calendario-ics";

const cita: CitaCalendario = { id: "a1", clientName: "Ana García", service: "Color, corte", employeeId: "mario", start: "2026-09-25T10:00:00Z", duration: 90, status: "confirmed" };

it("exporta solo confirmadas de la profesional, con UTC y nombre de pila", () => {
  const ics = generarCalendarioIcs([cita, { ...cita, id: "a2", status: "cancelled" }, { ...cita, id: "a3", employeeId: "diego" }], "PeluChic", "mario", new Date("2026-09-24T12:00:00Z"));
  expect(ics).toContain("DTSTART:20260925T100000Z\r\nDTEND:20260925T113000Z");
  expect(ics).toContain("SUMMARY:Color\\, corte · Ana");
  expect(ics).not.toContain("García");
  expect(ics).not.toContain("a2@");
  expect(ics).not.toContain("a3@");
  expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
});
