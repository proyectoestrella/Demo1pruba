import { describe, expect, it } from "bun:test";
import {
  citasSinDesenlace,
  clientesConDeuda,
  cobrosDeHoy,
  deudaDe,
  ESTADO_POR_DESENLACE,
  necesitaDesenlace,
  resumenDeDeuda,
  textoDeuda,
} from "./deuda";
import { countTardes, historialDeFallos, isPenaltyActive, penaltyExpiresAt } from "./plantones";
import { findClientWithPenalty, normalizePhone } from "./no-show";
import type { Appointment, AppointmentStatus, Client } from "./mock/types";

const DAY = 86_400_000;
const HORA = 3_600_000;
const AHORA = new Date("2026-09-20T12:00:00.000Z");

function cita(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "a1",
    clientId: "c1",
    clientName: "Marco",
    serviceIds: ["corte"],
    employeeId: "mario",
    start: new Date(AHORA.getTime() - 3 * HORA).toISOString(),
    duration: 30,
    priceEur: 18,
    status: "confirmed",
    ...overrides,
  };
}

function cliente(overrides: Partial<Client> = {}): Client {
  return {
    id: "c1",
    name: "Marco",
    phone: "+34 600 000 007",
    createdAt: new Date(AHORA.getTime() - 200 * DAY).toISOString(),
    ...overrides,
  };
}

describe("qué citas hay que resolver", () => {
  it("pregunta por una cita que ya terminó y sigue confirmada", () => {
    expect(necesitaDesenlace(cita(), AHORA)).toBe(true);
  });

  it("no pregunta por una cita que todavía no ha terminado", () => {
    const enCurso = cita({ start: new Date(AHORA.getTime() - 10 * 60_000).toISOString(), duration: 60 });
    expect(necesitaDesenlace(enCurso, AHORA)).toBe(false);
  });

  it("no pregunta por lo que ya tiene desenlace", () => {
    for (const status of ["completed", "late", "no-show", "cancelled", "blocked"] as AppointmentStatus[]) {
      expect(necesitaDesenlace(cita({ status }), AHORA)).toBe(false);
    }
  });

  it("deja de preguntar pasada la ventana de días", () => {
    const vieja = cita({ start: new Date(AHORA.getTime() - 40 * DAY).toISOString() });
    expect(necesitaDesenlace(vieja, AHORA)).toBe(false);
  });

  it("ordena de la más reciente a la más antigua", () => {
    const lista = [
      cita({ id: "vieja", start: new Date(AHORA.getTime() - 3 * DAY).toISOString() }),
      cita({ id: "reciente", start: new Date(AHORA.getTime() - 2 * HORA).toISOString() }),
      cita({ id: "futura", start: new Date(AHORA.getTime() + DAY).toISOString() }),
    ];
    expect(citasSinDesenlace(lista, AHORA).map((a) => a.id)).toEqual(["reciente", "vieja"]);
  });

  it("los tres desenlaces mapean a tres estados distintos", () => {
    expect(ESTADO_POR_DESENLACE).toEqual({ vino: "completed", tarde: "late", "no-vino": "no-show" });
  });
});

describe("cálculo de la deuda", () => {
  it("sin importe no hay deuda", () => {
    expect(deudaDe(cliente())).toBeNull();
    expect(deudaDe(cliente({ penaltyEur: 0 }))).toBeNull();
    expect(deudaDe(undefined)).toBeNull();
  });

  it("una deuda sin decisión explícita bloquea, como antes", () => {
    expect(deudaDe(cliente({ penaltyEur: 7 }))?.bloquea).toBe(true);
  });

  it("la deuda 'solo anotada' no bloquea", () => {
    const d = deudaDe(cliente({ penaltyEur: 7, penaltyBlock: false }));
    expect(d?.bloquea).toBe(false);
    expect(d?.eur).toBe(7);
  });

  it("suma el total de lo que le deben", () => {
    const clientes = [
      cliente({ id: "c1", penaltyEur: 7 }),
      cliente({ id: "c2", penaltyEur: 5 }),
      cliente({ id: "c3" }),
    ];
    expect(resumenDeDeuda(clientes)).toEqual({ personas: 2, eur: 12 });
    expect(clientesConDeuda(clientes).map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("escribe el importe en euros", () => {
    expect(textoDeuda(deudaDe(cliente({ penaltyEur: 7 })))).toBe("Debe 7,00 €");
    expect(textoDeuda(null)).toBeNull();
  });
});

describe("a quién hay que cobrarle hoy", () => {
  const deudor = cliente({ id: "c1", penaltyEur: 7, penaltyBlock: false });

  it("saca a quien debe y tiene cita hoy", () => {
    const hoy = cobrosDeHoy([cita({ start: new Date(AHORA.getTime() + 2 * HORA).toISOString() })], [deudor], AHORA);
    expect(hoy).toHaveLength(1);
    expect(hoy[0].eur).toBe(7);
  });

  it("no repite a quien tiene dos citas hoy", () => {
    const dos = [
      cita({ id: "a1", start: new Date(AHORA.getTime() + HORA).toISOString() }),
      cita({ id: "a2", start: new Date(AHORA.getTime() + 4 * HORA).toISOString() }),
    ];
    expect(cobrosDeHoy(dos, [deudor], AHORA)).toHaveLength(1);
  });

  it("ignora las citas de otro día, las canceladas y a quien no debe nada", () => {
    const manana = cita({ start: new Date(AHORA.getTime() + 2 * DAY).toISOString() });
    expect(cobrosDeHoy([manana], [deudor], AHORA)).toHaveLength(0);
    expect(cobrosDeHoy([cita({ status: "cancelled" })], [deudor], AHORA)).toHaveLength(0);
    expect(cobrosDeHoy([cita()], [cliente()], AHORA)).toHaveLength(0);
  });
});

describe("caducidad del bloqueo", () => {
  it("una deuda recién puesta bloquea; a los 30 días ya no", () => {
    const recien = cliente({ penaltyEur: 7, penaltyAt: new Date(AHORA.getTime() - DAY).toISOString() });
    expect(isPenaltyActive(recien, AHORA)).toBe(true);
    const vieja = cliente({ penaltyEur: 7, penaltyAt: new Date(AHORA.getTime() - 31 * DAY).toISOString() });
    expect(isPenaltyActive(vieja, AHORA)).toBe(false);
    expect(penaltyExpiresAt(recien)?.getTime()).toBe(new Date(recien.penaltyAt!).getTime() + 30 * DAY);
  });

  it("si el dueño lo mantiene, no caduca", () => {
    const mantenido = cliente({
      penaltyEur: 7,
      penaltyKeep: true,
      penaltyAt: new Date(AHORA.getTime() - 90 * DAY).toISOString(),
    });
    expect(isPenaltyActive(mantenido, AHORA)).toBe(true);
    expect(penaltyExpiresAt(mantenido)).toBeNull();
  });

  it("la deuda 'solo anotada' nunca bloquea, ni recién puesta", () => {
    const anotada = cliente({
      penaltyEur: 7,
      penaltyBlock: false,
      penaltyAt: new Date(AHORA.getTime() - HORA).toISOString(),
    });
    expect(isPenaltyActive(anotada, AHORA)).toBe(false);
  });
});

describe("normalización del teléfono", () => {
  it("las tres formas de teclear el mismo número son la misma persona", () => {
    expect(normalizePhone("+34 600 000 007")).toBe("600000007");
    expect(normalizePhone("34 600 000 007")).toBe("600000007");
    expect(normalizePhone("600000007")).toBe("600000007");
    expect(normalizePhone(undefined)).toBe("");
  });

  it("encuentra por teléfono a quien tiene un bloqueo activo, y no a quien solo lo tiene anotado", () => {
    const bloqueado = cliente({ penaltyEur: 7, penaltyAt: AHORA.toISOString() });
    expect(findClientWithPenalty([bloqueado], "+34 600 000 007", AHORA)?.id).toBe("c1");
    const anotado = cliente({ penaltyEur: 7, penaltyBlock: false, penaltyAt: AHORA.toISOString() });
    expect(findClientWithPenalty([anotado], "600000007", AHORA)).toBeUndefined();
  });

  it("no bloquea mientras el teléfono está a medio escribir", () => {
    const bloqueado = cliente({ penaltyEur: 7, penaltyAt: AHORA.toISOString() });
    expect(findClientWithPenalty([bloqueado], "60000", AHORA)).toBeUndefined();
  });
});

describe("historial de fallos del cliente", () => {
  const plantón = cita({ id: "p", status: "no-show", start: new Date(AHORA.getTime() - 10 * DAY).toISOString() });
  const tarde = cita({ id: "t", status: "late", start: new Date(AHORA.getTime() - 5 * DAY).toISOString() });

  it("cuenta los retrasos sin avisar aparte de los plantones", () => {
    expect(countTardes([plantón, tarde], "c1", 90, AHORA)).toBe(1);
  });

  it("lo dice todo en una frase, y calla si no hay nada que decir", () => {
    expect(historialDeFallos([plantón, tarde], "c1", 90, AHORA)).toBe(
      "1 plantón y 1 retraso sin avisar en los últimos 3 meses",
    );
    expect(historialDeFallos([plantón], "c1", 90, AHORA)).toBe("1 plantón en los últimos 3 meses");
    expect(historialDeFallos([cita({ status: "completed" })], "c1", 90, AHORA)).toBeNull();
  });
});
