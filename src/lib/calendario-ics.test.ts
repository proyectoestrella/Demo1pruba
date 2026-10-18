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

import { enlacesSuscripcion } from "./calendario-ics";

const ics = (citas = [cita], t = "2026-09-24T12:00:00Z") => generarCalendarioIcs(citas, "PeluChic", undefined, new Date(t));

it("cabecera, zona y UID estable entre llamadas", () => {
  const a = ics(), b = ics([cita], "2026-09-25T12:00:00Z");
  expect(a).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:");
  expect(a).toContain("X-WR-TIMEZONE:Europe/Madrid");
  expect(a.match(/^UID:.*$/m)?.[0]).toBe(b.match(/^UID:.*$/m)?.[0]);
  expect(a).not.toBe(b); // DTSTAMP cambia en cada generación
});

it("horario de verano: 10:00 UTC fijo, sin deriva (UTC no tiene DST)", () => {
  const v = ics([{ ...cita, start: "2026-07-01T08:00:00Z" }]);
  const i = ics([{ ...cita, start: "2026-01-15T09:00:00Z" }]);
  expect(v).toContain("DTSTART:20260701T080000Z"); // 10:00 Madrid CEST
  expect(i).toContain("DTSTART:20260115T090000Z"); // 10:00 Madrid CET
});

it("modificar una cita cambia DTSTART/DURACIÓN y escapa comas, punto y coma y saltos", () => {
  const m = ics([{ ...cita, start: "2026-09-25T11:00:00Z", service: "A,B;C\nD" }]);
  expect(m).toContain("DTSTART:20260925T110000Z");
  const b = String.fromCharCode(92);
  expect(m).toContain(`SUMMARY:A${b},B${b};C D · Ana`);
});

it("líneas plegadas a <=75 octetos y en UTF-8 sin partir caracteres", () => {
  const largo = ics([{ ...cita, service: "Ñandú ".repeat(40) }]);
  for (const l of largo.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  expect(largo.replace(/\r\n /g, "")).toContain("Ñandú Ñandú");
});

it("enlaces de suscripción: webcal y Google con cid codificado", () => {
  const e = enlacesSuscripcion("https://x.app/api/calendario?token=abc_-1&profesional=m");
  expect(e.webcal).toBe("webcal://x.app/api/calendario?token=abc_-1&profesional=m");
  expect(e.google).toBe(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(e.webcal)}`);
});
