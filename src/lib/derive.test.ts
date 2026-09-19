import { describe, expect, it } from "bun:test";
import { aiInsights, clientFrequency, duracionRecordada, patronDeRegreso } from "./derive";
import type { Appointment, AppointmentStatus } from "./mock/types";

const DAY = 86_400_000;
const AHORA = new Date("2026-09-20T12:00:00.000Z");

function cita(overrides: Partial<Appointment> & { start: string }): Appointment {
  return {
    id: `a-${overrides.start}-${overrides.clientId ?? "c1"}`,
    clientId: "c1",
    clientName: "Cliente de prueba",
    serviceIds: ["corte"],
    employeeId: "mario",
    duration: 30,
    priceEur: 25,
    status: "confirmed",
    ...overrides,
  };
}

/** Días antes (negativo) o después (positivo) del "ahora" fijo de estas pruebas. */
function enDias(n: number): string {
  return new Date(AHORA.getTime() + n * DAY).toISOString();
}

describe("clientFrequency — última visita", () => {
  it("la última visita es la última cita PASADA, no la próxima", () => {
    const appts = [
      cita({ start: enDias(-30) }),
      cita({ start: enDias(-7) }),
      // La que rompía el dato: futura, y como la lista va ascendente era la
      // última del array, así que se enseñaba como "última visita".
      cita({ start: enDias(5) }),
    ];
    const r = clientFrequency(appts, "c1", AHORA);
    expect(r.lastVisit).toBe(enDias(-7));
    expect(r.nextVisit).toBe(enDias(5));
  });

  it("sin citas pasadas no hay última visita, aunque tenga cita para la semana que viene", () => {
    const r = clientFrequency([cita({ start: enDias(3) })], "c1", AHORA);
    expect(r.lastVisit).toBeUndefined();
    expect(r.nextVisit).toBe(enDias(3));
    expect(r.pastVisits).toBe(0);
  });

  it("un plantón no cuenta como visita", () => {
    const appts = [
      cita({ start: enDias(-20) }),
      cita({ start: enDias(-3), status: "no-show" as AppointmentStatus }),
    ];
    const r = clientFrequency(appts, "c1", AHORA);
    expect(r.lastVisit).toBe(enDias(-20));
    expect(r.pastVisits).toBe(1);
  });

  it("una cancelada no cuenta ni como visita ni como próxima cita", () => {
    const appts = [
      cita({ start: enDias(-10) }),
      cita({ start: enDias(4), status: "cancelled" as AppointmentStatus }),
    ];
    const r = clientFrequency(appts, "c1", AHORA);
    expect(r.lastVisit).toBe(enDias(-10));
    expect(r.nextVisit).toBeUndefined();
  });
});

describe("duracionRecordada", () => {
  it("propone lo que tardó la última vez con esos mismos servicios", () => {
    const appts = [cita({ start: enDias(-40), duration: 75 }), cita({ start: enDias(-14), duration: 75 })];
    const r = duracionRecordada(appts, "c1", ["corte"], 45, AHORA);
    expect(r?.minutos).toBe(75);
    expect(r?.cuando).toBe(enDias(-14));
  });

  it("no dice nada si la última vez tardó lo que dice la carta", () => {
    const appts = [cita({ start: enDias(-14), duration: 45 })];
    expect(duracionRecordada(appts, "c1", ["corte"], 45, AHORA)).toBeNull();
  });

  it("no mezcla combinaciones de servicios distintas", () => {
    const appts = [cita({ start: enDias(-14), duration: 90, serviceIds: ["corte", "barba"] })];
    expect(duracionRecordada(appts, "c1", ["corte"], 45, AHORA)).toBeNull();
    // Y el orden en que se eligieron los servicios no cambia que sea la misma cita.
    expect(duracionRecordada(appts, "c1", ["barba", "corte"], 60, AHORA)?.minutos).toBe(90);
  });

  it("no mira las citas futuras: todavía no ha tardado nada", () => {
    const appts = [cita({ start: enDias(6), duration: 75 })];
    expect(duracionRecordada(appts, "c1", ["corte"], 45, AHORA)).toBeNull();
  });

  it("sin cliente (un «Sin cita») no hay nada que recordar", () => {
    const appts = [cita({ start: enDias(-14), duration: 75 })];
    expect(duracionRecordada(appts, undefined, ["corte"], 45, AHORA)).toBeNull();
  });
});

describe("analítica honesta con pocos datos", () => {
  it("con un solo cliente no se inventa un patrón de regreso", () => {
    const appts = [cita({ start: enDias(-10) })];
    expect(patronDeRegreso(appts, AHORA)).toBeNull();
    const cards = aiInsights(appts, [], AHORA);
    const patron = cards.find((c) => c.title === "Patrón de reserva recurrente");
    // Esto es lo que decía antes, a pelo, en el panel de Adam (1 cliente).
    expect(patron?.body).not.toContain("5 tienen que volver");
    expect(patron?.body).toContain("Todavía no hay suficientes reservas");
  });

  it("sin ninguna cita, todas las tarjetas lo dicen en vez de dar cifras", () => {
    const cards = aiInsights([], [], AHORA);
    expect(cards.find((c) => c.title === "Franja más floja")?.body).toContain(
      "Todavía no hay suficientes reservas",
    );
    expect(cards.find((c) => c.title === "Servicio estrella")?.body).toContain(
      "Todavía no hay suficientes reservas",
    );
  });

  it("con historial suficiente sí calcula cada cuánto vuelven", () => {
    // 6 clientes, cada uno con 3 visitas separadas 4 semanas.
    const appts: Appointment[] = [];
    for (let c = 1; c <= 6; c++) {
      for (let v = 3; v >= 1; v--) {
        appts.push(cita({ clientId: `c${c}`, start: enDias(-28 * v) }));
      }
    }
    const patron = patronDeRegreso(appts, AHORA);
    expect(patron).not.toBeNull();
    expect(patron!.semanasMedia).toBe(4);
  });
});
