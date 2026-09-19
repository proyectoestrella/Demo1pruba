import { describe, expect, it } from "bun:test";
import {
  countNoShows,
  daysUntilPenaltyExpiry,
  isPenaltyActive,
  noShowSummary,
  penaltyExpiresAt,
  PENALTY_EXPIRY_DAYS,
} from "./plantones";
import { findClientWithPenalty } from "./no-show";
import type { Appointment, Client } from "./mock/types";

const DAY = 86_400_000;
const AHORA = new Date("2026-09-20T12:00:00.000Z");

function enDias(n: number): string {
  return new Date(AHORA.getTime() + n * DAY).toISOString();
}

function cita(start: string, status: Appointment["status"] = "no-show"): Appointment {
  return {
    id: `a-${start}`,
    clientId: "c1",
    clientName: "Cliente de prueba",
    serviceIds: ["corte"],
    employeeId: "mario",
    start,
    duration: 30,
    priceEur: 25,
    status,
  };
}

function cliente(overrides: Partial<Client> = {}): Client {
  return {
    id: "c1",
    name: "Cliente de prueba",
    phone: "+34 600 000 007",
    createdAt: enDias(-200),
    ...overrides,
  };
}

describe("contador de plantones", () => {
  it("cuenta los plantones dentro de la ventana y deja fuera los viejos", () => {
    const appts = [cita(enDias(-10)), cita(enDias(-70)), cita(enDias(-120))];
    expect(countNoShows(appts, "c1", 90, AHORA)).toBe(2);
  });

  it("no cuenta las citas a las que sí vino ni las canceladas", () => {
    const appts = [cita(enDias(-5), "completed"), cita(enDias(-6), "cancelled"), cita(enDias(-7))];
    expect(countNoShows(appts, "c1", 90, AHORA)).toBe(1);
  });

  it("no cuenta plantones de otro cliente", () => {
    const ajeno = { ...cita(enDias(-5)), clientId: "c2" };
    expect(countNoShows([ajeno], "c1", 90, AHORA)).toBe(0);
  });

  it("la frase de la ficha sale como la pidió Adam, o no sale", () => {
    const appts = [cita(enDias(-10)), cita(enDias(-40))];
    expect(noShowSummary(appts, "c1", 90, AHORA)).toBe("2 plantones en los últimos 3 meses");
    expect(noShowSummary([], "c1", 90, AHORA)).toBeNull();
    expect(noShowSummary([cita(enDias(-10))], "c1", 90, AHORA)).toBe(
      "1 plantón en los últimos 3 meses",
    );
  });
});

describe("caducidad del bloqueo por penalización", () => {
  it("bloquea mientras no pasen los 30 días", () => {
    const c = cliente({ penaltyEur: 7, penaltyAt: enDias(-10) });
    expect(isPenaltyActive(c, AHORA)).toBe(true);
    expect(daysUntilPenaltyExpiry(c, AHORA)).toBe(PENALTY_EXPIRY_DAYS - 10);
  });

  it("se levanta solo pasados los 30 días, aunque la deuda siga anotada", () => {
    const c = cliente({ penaltyEur: 7, penaltyAt: enDias(-31) });
    expect(isPenaltyActive(c, AHORA)).toBe(false);
    // La deuda no desaparece: lo que caduca es el "no puedes volver a reservar".
    expect(c.penaltyEur).toBe(7);
    expect(daysUntilPenaltyExpiry(c, AHORA)).toBeNull();
  });

  it("si el dueño decide mantenerlo, no caduca", () => {
    const c = cliente({ penaltyEur: 7, penaltyAt: enDias(-100), penaltyKeep: true });
    expect(isPenaltyActive(c, AHORA)).toBe(true);
    expect(penaltyExpiresAt(c)).toBeNull();
  });

  it("una ficha antigua sin fecha se comporta como antes: no caduca", () => {
    const c = cliente({ penaltyEur: 7 });
    expect(isPenaltyActive(c, AHORA)).toBe(true);
    expect(penaltyExpiresAt(c)).toBeNull();
  });

  it("sin deuda no hay bloqueo", () => {
    expect(isPenaltyActive(cliente(), AHORA)).toBe(false);
    expect(isPenaltyActive(cliente({ penaltyEur: 0 }), AHORA)).toBe(false);
  });
});

describe("la reserva pública respeta la caducidad", () => {
  it("bloquea a quien todavía está dentro de los 30 días", () => {
    const clientes = [cliente({ penaltyEur: 7, penaltyAt: enDias(-5) })];
    expect(findClientWithPenalty(clientes, "600 000 007", AHORA)?.id).toBe("c1");
  });

  it("deja reservar a quien ya cumplió los 30 días", () => {
    const clientes = [cliente({ penaltyEur: 7, penaltyAt: enDias(-45) })];
    expect(findClientWithPenalty(clientes, "600 000 007", AHORA)).toBeUndefined();
  });
});
