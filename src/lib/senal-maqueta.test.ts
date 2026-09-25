import { describe, expect, test } from "bun:test";
import type { Appointment } from "./mock/types";
import { accionesSenal, estadoSenal, importeSenal, llevaSenal, marcadoresQueFaltan, prepararPeticionSenal, reglaSenal, rellenarPlantillaSenal, textoSenalPublico } from "./senal-maqueta";

const ahora = new Date("2026-09-25T10:00:00");
const cita = (p: Partial<Appointment> = {}): Appointment => ({ id: "c1", clientId: "x", clientName: "Lucía Pérez", serviceIds: ["tinte"], employeeId: "m", start: "2026-09-26T12:00:00", duration: 90, priceEur: 60, status: "pending", ...p });
const regla = reglaSenal({ depositEnabled: true, depositBizumPhone: "600111222", depositAmountEur: 20 });
const eur = (n: number) => `${n} €`;

describe("regla de la señal", () => {
  test("sin Bizum no hay señal; con él, por defecto fija, a todas, 4 h", () => {
    expect(reglaSenal({ depositEnabled: true }).activa).toBe(false);
    expect(regla).toMatchObject({ activa: true, modo: "fijo", importeEur: 20, aplicaA: "todas", plazoHoras: 4 });
    expect(reglaSenal({ depositDeadlineHours: 24 }).plazoHoras).toBe(4);
  });
  test("a quién se pide y cuánto", () => {
    const porDuracion = { ...regla, aplicaA: "duracion" as const, minMinutos: 120 };
    expect(llevaSenal(porDuracion, { duration: 90, serviceIds: [] })).toBe(false);
    expect(llevaSenal({ ...regla, aplicaA: "servicios", serviceIds: ["tinte"] }, { duration: 30, serviceIds: ["tinte"] })).toBe(true);
    expect(importeSenal({ ...regla, modo: "porcentaje", porcentaje: 25 }, 62)).toBe(16);
  });
});

describe("estado y ciclo", () => {
  test("por pedir → pedida → vencida (calculada) → recibida", () => {
    expect(estadoSenal(cita(), regla, ahora)).toBe("por_pedir");
    const pedida = cita({ depositStatus: "pedida", depositDueAt: "2026-09-25T12:00:00" });
    expect(estadoSenal(pedida, regla, ahora)).toBe("pedida");
    expect(estadoSenal(pedida, regla, new Date("2026-09-25T13:00:00"))).toBe("vencida");
    expect(estadoSenal(cita({ depositStatus: "recibida" }), regla, ahora)).toBe("recibida");
    expect(estadoSenal(cita(), { ...regla, activa: false }, ahora)).toBe("no_aplica");
  });
  test("preparar no cambia nada y el vencimiento nunca pasa de la cita", () => {
    const p = prepararPeticionSenal(cita({ start: "2026-09-25T11:00:00" }), regla, undefined, ahora);
    expect(p).toEqual({ ok: true, importeEur: 20, venceISO: new Date("2026-09-25T11:00:00").toISOString() });
    expect(prepararPeticionSenal(cita({ status: "cancelled" }), regla, undefined, ahora)).toEqual({ ok: false, error: "SENAL_CITA_CERRADA" });
    expect(prepararPeticionSenal(cita({ depositStatus: "recibida" }), regla, undefined, ahora)).toEqual({ ok: false, error: "SENAL_ESTADO_INVALIDO" });
    expect(prepararPeticionSenal(cita(), { ...regla, activa: false }, undefined, ahora)).toEqual({ ok: false, error: "SENAL_SIN_IMPORTE" });
  });
  test("las acciones escriben el ciclo en la cita", () => {
    const citas = [cita()];
    const store = {
      appointments: citas,
      updateAppointment: (id: string, patch: Partial<Appointment>) => Object.assign(citas.find((a) => a.id === id)!, patch),
      cancelAppointment: (id: string) => Object.assign(citas.find((a) => a.id === id)!, { status: "cancelled" as const }),
    };
    const s = accionesSenal(store);
    expect(s.pedirSenal("c1", 20, "2026-09-25T14:00:00", 4)).toBeNull();
    expect(citas[0]).toMatchObject({ depositStatus: "pedida", depositEur: 20 });
    expect(s.recibirSenal("c1", { metodo: "bizum", importeEur: 0 })).toBe("SENAL_IMPORTE_INVALIDO");
    expect(s.recibirSenal("c1", { metodo: "bizum" })).toBeNull();
    expect(citas[0]).toMatchObject({ depositStatus: "recibida", depositReceivedEur: 20, depositMethod: "bizum" });
    expect(s.deshacerSenalRecibida("c1")).toBeNull();
    expect(citas[0].depositStatus).toBe("pedida");
    expect(s.liberarHueco("c1")).toBeNull();
    expect(citas[0]).toMatchObject({ depositStatus: "anulada", status: "cancelled" });
  });
});

describe("textos", () => {
  test("plantilla de WhatsApp con marcadores y aviso de los que faltan", () => {
    const m = rellenarPlantillaSenal("", { nombre: "Lucía", salon: "PeluChic", importeEur: 20, bizum: "600111222", startISO: "2026-09-26T12:00:00", venceISO: "2026-09-26T09:00:00" });
    expect(m).toContain("señal de 20 € por Bizum al 600111222");
    expect(marcadoresQueFaltan("Hola {nombre}")).toEqual(["{importe}", "{bizum}"]);
    expect(marcadoresQueFaltan("")).toEqual([]);
  });
  test("web pública: un solo mensaje, o ninguno si esa reserva no lleva señal", () => {
    expect(textoSenalPublico(regla, { duration: 90, serviceIds: [], priceEur: 60 }, "PeluChic", eur)).toBe(
      "PeluChic te pedirá por WhatsApp una señal de 20 € por Bizum. Se descuenta al pagar y se devuelve si cancelas con más de 24 h de antelación.",
    );
    expect(textoSenalPublico({ ...regla, aplicaA: "duracion", minMinutos: 120 }, { duration: 90, serviceIds: [], priceEur: 60 }, "PeluChic", eur)).toBeNull();
  });
});
