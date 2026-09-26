/**
 * Segunda pasada del barrido: periodos y campañas con la zona del SALÓN,
 * pase lo que pase en la máquina. Se simula un servidor en UTC y un salón
 * en Madrid; y una dueña de viaje en Nueva York.
 */
import { describe, expect, it } from "bun:test";
import { calcularHuecoFlojo } from "./campanas";
import { capacidadDelRango, rangoDePeriodo, resumenDePeriodo, textoRango } from "./periodos";
import { employeesForType } from "./mock/salon";
import type { Appointment } from "./mock/types";

const MADRID = "Europe/Madrid";
const equipo = employeesForType("peluqueria", ["Ana~Estilista"], undefined, ["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "Cerrado"]);
const cita = (id: string, start: string, extra: Partial<Appointment> = {}): Appointment => ({
  id, clientId: `c-${id}`, clientName: "X", serviceIds: ["s"], employeeId: equipo[0].id, start, duration: 60, priceEur: 20, status: "completed", ...extra,
});

describe("periodos en la zona del salón", () => {
  it("«hoy» en Madrid empieza a las 00:00 de Madrid (22:00 UTC en verano)", () => {
    const r = rangoDePeriodo("hoy", new Date("2026-09-25T23:30:00Z"), null, MADRID); // 01:30 del 26 en Madrid
    expect(r.inicio.toISOString()).toBe("2026-09-25T22:00:00.000Z");
    expect(r.fin.toISOString()).toBe("2026-09-26T22:00:00.000Z");
  });

  it("la semana empieza el lunes de Madrid y el mes el día 1 de Madrid", () => {
    const ahora = new Date("2026-09-30T22:30:00Z"); // jueves 1 de octubre, 00:30 en Madrid
    expect(rangoDePeriodo("semana", ahora, null, MADRID).inicio.toISOString()).toBe("2026-09-27T22:00:00.000Z");
    expect(rangoDePeriodo("mes", ahora, null, MADRID).inicio.toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });

  it("el cambio de hora de octubre: el día 25 dura 25 h y el mes siguiente empieza a las 00:00", () => {
    const r = rangoDePeriodo("hoy", new Date("2026-10-25T10:00:00Z"), null, MADRID);
    expect((+r.fin - +r.inicio) / 3_600_000).toBe(25);
    const mes = rangoDePeriodo("mes", new Date("2026-10-15T10:00:00Z"), null, MADRID);
    expect(mes.fin.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("una cita a las 00:30 de Madrid cuenta en su día, no en el anterior", () => {
    const ahora = new Date("2026-09-26T10:00:00Z");
    const citas = [cita("a", "2026-09-25T22:30:00Z")]; // 00:30 del 26 en Madrid
    expect(resumenDePeriodo(citas, "hoy", equipo, ahora, null, undefined, MADRID).actual.citas).toBe(1);
  });

  it("la capacidad usa el día de la semana de Madrid", () => {
    // Domingo 27/09 en Madrid (cerrado): 0 huecos aunque en UTC empiece el sábado a las 22:00.
    const domingo = rangoDePeriodo("hoy", new Date("2026-09-27T10:00:00Z"), null, MADRID);
    expect(capacidadDelRango(domingo, equipo, MADRID)).toBe(0);
    // El horario de prueba empieza en lunes (cerrado); el martes abre de 10 a 20: 20 medias horas.
    const martes = rangoDePeriodo("hoy", new Date("2026-09-29T10:00:00Z"), null, MADRID);
    expect(capacidadDelRango(martes, equipo, MADRID)).toBe(20);
  });

  it("el texto del rango dice el día de Madrid", () => {
    const r = rangoDePeriodo("hoy", new Date("2026-09-25T23:30:00Z"), null, MADRID);
    expect(textoRango(r, MADRID)).toContain("26");
  });

  it("sin zona se comporta como antes (hora local del dispositivo)", () => {
    const ahora = new Date(2026, 8, 26, 12);
    expect(+rangoDePeriodo("hoy", ahora).inicio).toBe(+new Date(2026, 8, 26));
  });
});

describe("huecos flojos en la zona del salón", () => {
  it("una cita a las 13:30 de Madrid (11:30 UTC) cuenta como mañana del martes en Madrid", () => {
    const ahora = new Date("2026-09-26T10:00:00Z");
    // Todos los martes por la mañana llenos y a las 16:00 de Madrid… la franja con MENOS ocupación no es martes mañana.
    const citas: Appointment[] = [];
    for (let s = 1; s <= 4; s++) {
      const martes = new Date(Date.UTC(2026, 8, 22 - 7 * (s - 1)));
      for (let h = 8; h < 12; h++) citas.push(cita(`m${s}-${h}`, new Date(+martes + h * 3_600_000).toISOString(), { duration: 60 }));
    }
    const conZona = calcularHuecoFlojo(citas, equipo, ahora, MADRID);
    expect(conZona).not.toBeNull();
    expect(`${conZona!.diaLabel} ${conZona!.franjaLabel}`).not.toBe("martes mañana");
  });
});
