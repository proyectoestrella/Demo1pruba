import { describe, expect, it } from "bun:test";
import { citaIdDeIcs, eventoGoogleDeCita, fechasDeIcs, icsDeCita, resumenDeCita, resumenDeIcs } from "./mapeo-eventos";
import type { CitaParaCalendario } from "./tipos";

const CITA: CitaParaCalendario = {
  id: "cita-123",
  clientName: "Ana García",
  service: "Corte y color",
  employeeId: "noelia",
  start: "2026-10-01T10:00:00.000Z",
  duration: 45,
  status: "confirmed",
};

describe("resumenDeCita", () => {
  it("solo el nombre de pila, nunca el apellido", () => {
    expect(resumenDeCita(CITA)).toBe("Corte y color · Ana");
  });
});

describe("icsDeCita / lectura de vuelta", () => {
  const ics = icsDeCita(CITA, new Date("2026-09-26T12:00:00.000Z"));

  it("es un VCALENDAR completo con un VEVENT (lo que espera un PUT de CalDAV)", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("el UID es estable e incluye el id de la cita", () => {
    expect(ics).toContain("UID:cita-123@sishow.app");
  });

  it("lleva la marca propia para detectar el eco al releer", () => {
    expect(citaIdDeIcs(ics)).toBe("cita-123");
  });

  it("el resumen se puede releer del SUMMARY", () => {
    expect(resumenDeIcs(ics)).toBe("Corte y color · Ana");
  });

  it("las fechas se pueden releer del DTSTART/DTEND", () => {
    const fechas = fechasDeIcs(ics);
    expect(fechas?.start).toBe("2026-10-01T10:00:00Z");
    expect(fechas?.end).toBe("2026-10-01T10:45:00Z");
  });

  it("un evento SIN la marca propia (metido a mano por la profesional) no trae citaId", () => {
    const ajeno = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:otro@icloud.com\r\nSUMMARY:Dentista\r\nDTSTART:20261001T090000Z\r\nDTEND:20261001T093000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    expect(citaIdDeIcs(ajeno)).toBeNull();
    expect(resumenDeIcs(ajeno)).toBe("Dentista");
  });
});

describe("eventoGoogleDeCita", () => {
  it("calcula fin = inicio + duración", () => {
    const e = eventoGoogleDeCita(CITA);
    expect(e.inicioISO).toBe("2026-10-01T10:00:00.000Z");
    expect(e.finISO).toBe("2026-10-01T10:45:00.000Z");
    expect(e.citaId).toBe("cita-123");
    expect(e.resumen).toBe("Corte y color · Ana");
  });
});
