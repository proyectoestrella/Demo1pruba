/**
 * Ciclo de vida de la señal: cada transición y los casos borde que salieron
 * de la visita a PeluChic (fianza-y-senal-peluchic-metodo-solido, § Método A).
 * Todo con horas del salón (Madrid) construidas con isoDelSalon.
 */
import { describe, expect, it } from "bun:test";
import {
  aplicarSenal,
  confirmarDevolucion,
  darMasTiempo,
  deshacerRecibida,
  diferenciaSenal,
  estadoSenal,
  moverSenal,
  pedirSenal,
  reabrirSenal,
  reajustarSenal,
  recibirSenal,
  reglaSenal,
  resolverCancelacion,
  resolverPlanton,
  revisarVencimiento,
  senalDeReservaNueva,
  vencimientoSenal,
} from "./senal";
import { isoDelSalon } from "./zona-horaria";
import type { Appointment } from "./mock/types";

const regla = reglaSenal({ depositEnabled: true, depositAmountEur: 20, depositDeadlineHours: 2, depositCancelHours: 24, depositBizumPhone: "666777888" });
const conLiberacion = reglaSenal({ depositEnabled: true, depositAmountEur: 20, depositDeadlineHours: 2, depositAutoRelease: true });
const madrid = (fecha: string, hora: string) => new Date(isoDelSalon(fecha, hora));

/** Cita del martes 29 de septiembre a las 17:00 (Madrid), 45 min, 25 €. */
function cita(extra: Partial<Appointment> = {}): Appointment {
  return {
    id: "a-1", clientId: "c-1", clientName: "Ana", serviceIds: ["corte"], employeeId: "mario",
    start: isoDelSalon("2026-09-29", "17:00"), duration: 45, priceEur: 25, status: "confirmed",
    ...extra,
  };
}
const aplicar = (c: Appointment, r: { ok: boolean; patch?: Partial<Appointment> }) => ({ ...c, ...(r.ok ? r.patch : {}) });

describe("pedir: solo al confirmar el envío, con plazo en horas del salón", () => {
  it("por_pedir → pedida con vencimiento a las 2 h", () => {
    const ahora = madrid("2026-09-28", "10:00");
    const r = pedirSenal(cita({ depositStatus: "por_pedir", depositEur: 20 }), regla, 20, ahora);
    expect(r).toEqual({ ok: true, patch: {
      depositStatus: "pedida", depositEur: 20, depositRequestedAt: ahora.toISOString(),
      depositPeriodHours: 2, depositDueAt: isoDelSalon("2026-09-28", "12:00"),
    } });
  });

  it("si la cita es antes que el plazo, vence a la hora de la cita", () => {
    const ahora = madrid("2026-09-29", "16:00");
    const r = pedirSenal(cita(), regla, 20, ahora);
    expect(r.ok && r.patch.depositDueAt).toBe(isoDelSalon("2026-09-29", "17:00"));
  });

  it("errores: cita pasada o cerrada, señal ya recibida, sin importe", () => {
    expect(pedirSenal(cita(), regla, 20, madrid("2026-09-29", "18:00"))).toEqual({ ok: false, error: "SENAL_CITA_CERRADA" });
    expect(pedirSenal(cita({ status: "cancelled" }), regla, 20, madrid("2026-09-28", "10:00"))).toEqual({ ok: false, error: "SENAL_CITA_CERRADA" });
    expect(pedirSenal(cita({ depositStatus: "recibida", depositEur: 20 }), regla, 20, madrid("2026-09-28", "10:00"))).toEqual({ ok: false, error: "SENAL_ESTADO_INVALIDO" });
    expect(pedirSenal(cita(), regla, 0, madrid("2026-09-28", "10:00"))).toEqual({ ok: false, error: "SENAL_SIN_IMPORTE" });
  });

  it("volver a pedirla tras vencer abre un plazo nuevo", () => {
    const pedida = cita({ depositStatus: "pedida", depositEur: 20, depositRequestedAt: isoDelSalon("2026-09-28", "09:00"), depositDueAt: isoDelSalon("2026-09-28", "11:00"), depositPeriodHours: 2 });
    const ahora = madrid("2026-09-28", "12:00");
    expect(estadoSenal(pedida, ahora)).toBe("vencida");
    const r = pedirSenal(pedida, regla, 20, ahora);
    expect(r.ok && r.patch.depositDueAt).toBe(isoDelSalon("2026-09-28", "14:00"));
  });
});

describe("vencida: aviso por defecto, liberación solo si el salón la activa", () => {
  const pedida = cita({ depositStatus: "pedida", depositEur: 20, depositRequestedAt: isoDelSalon("2026-09-28", "09:00"), depositDueAt: isoDelSalon("2026-09-28", "11:00"), depositPeriodHours: 2 });

  it("antes del plazo sigue pedida; a la hora exacta, vencida", () => {
    expect(estadoSenal(pedida, madrid("2026-09-28", "10:59"))).toBe("pedida");
    expect(estadoSenal(pedida, madrid("2026-09-28", "11:00"))).toBe("vencida");
  });

  it("sin liberación automática: vencida pero no se libera", () => {
    expect(revisarVencimiento(pedida, regla, madrid("2026-09-28", "12:00"))).toEqual({ vencida: true, liberar: false });
  });

  it("con liberación automática: se libera; y liberar la anula (no había dinero)", () => {
    expect(revisarVencimiento(pedida, conLiberacion, madrid("2026-09-28", "12:00"))).toEqual({ vencida: true, liberar: true });
    expect(resolverCancelacion(pedida, conLiberacion, "salon", madrid("2026-09-28", "12:00"))).toEqual({ ok: true, patch: { depositStatus: "anulada" } });
  });

  it("una cita ya cancelada no cuenta como vencida", () => {
    expect(revisarVencimiento({ ...pedida, status: "cancelled" }, conLiberacion, madrid("2026-09-28", "12:00")).liberar).toBe(false);
  });

  it("dar más tiempo suma otro plazo desde ahora y quita la vencida", () => {
    const ahora = madrid("2026-09-28", "12:00");
    const r = darMasTiempo(pedida, regla, ahora);
    expect(r).toEqual({ ok: true, patch: { depositStatus: "pedida", depositDueAt: isoDelSalon("2026-09-28", "14:00") } });
    expect(estadoSenal(aplicar(pedida, r), ahora)).toBe("pedida");
  });

  it("el Bizum que llega tarde se acepta igual", () => {
    const r = recibirSenal(pedida, { metodo: "bizum" }, madrid("2026-09-28", "12:30"));
    expect(r.ok && r.patch).toMatchObject({ depositStatus: "recibida", depositReceivedEur: 20, depositMethod: "bizum" });
  });
});

describe("recibida → aplicada al cobrar", () => {
  const recibida = cita({ depositStatus: "recibida", depositEur: 20, depositReceivedEur: 20, depositReceivedAt: isoDelSalon("2026-09-28", "10:30"), depositMethod: "bizum" });

  it("se descuenta del precio y queda a cobrar la diferencia", () => {
    const r = aplicarSenal(recibida, madrid("2026-09-29", "17:50"));
    expect(r.aCobrarEur).toBe(5);
    expect(r.patch).toMatchObject({ depositStatus: "aplicada", depositAppliedEur: 20 });
  });

  it("llega tarde: la señal se aplica igual (llegar tarde no es un plantón)", () => {
    const r = aplicarSenal({ ...recibida, status: "late" }, madrid("2026-09-29", "17:50"));
    expect(r.patch.depositStatus).toBe("aplicada");
  });

  it("señal mayor que el servicio: se aplica el precio y el resto queda a devolver", () => {
    const r = aplicarSenal({ ...recibida, priceEur: 15 }, madrid("2026-09-29", "17:50"));
    expect(r.aCobrarEur).toBe(0);
    expect(r.patch).toMatchObject({ depositAppliedEur: 15, depositRefundedEur: 5 });
  });

  it("sin señal recibida, se cobra el precio entero y no cambia nada", () => {
    expect(aplicarSenal(cita(), madrid("2026-09-29", "17:50"))).toEqual({ ok: true, patch: {}, aCobrarEur: 25 });
  });

  it("deshacer la recibida vuelve a pedida (o a por pedir si nunca se pidió)", () => {
    expect(deshacerRecibida(recibida).ok && (deshacerRecibida(recibida) as { patch: Partial<Appointment> }).patch.depositStatus).toBe("por_pedir");
    const pedidaYRecibida = { ...recibida, depositRequestedAt: isoDelSalon("2026-09-28", "09:00") };
    expect((deshacerRecibida(pedidaYRecibida) as { patch: Partial<Appointment> }).patch.depositStatus).toBe("pedida");
  });
});

describe("cancelaciones y plantones", () => {
  const recibida = cita({ depositStatus: "recibida", depositEur: 20, depositReceivedEur: 20, depositReceivedAt: isoDelSalon("2026-09-27", "10:30") });

  it("cancela a tiempo (más de 24 h): se le devuelve", () => {
    expect(resolverCancelacion(recibida, regla, "clienta", madrid("2026-09-28", "16:59"))).toEqual({ ok: true, patch: { depositStatus: "devuelta", depositRefundedEur: 20 } });
  });

  it("cancela tarde (menos de 24 h): el salón se la queda", () => {
    const ahora = madrid("2026-09-28", "17:01");
    expect(resolverCancelacion(recibida, regla, "clienta", ahora)).toEqual({ ok: true, patch: { depositStatus: "retenida", depositRetainedAt: ahora.toISOString() } });
  });

  it("si cancela el salón, se devuelve aunque sea tarde", () => {
    expect(resolverCancelacion(recibida, regla, "salon", madrid("2026-09-29", "16:00")).ok && (resolverCancelacion(recibida, regla, "salon", madrid("2026-09-29", "16:00")) as { patch: Partial<Appointment> }).patch.depositStatus).toBe("devuelta");
  });

  it("no viene con la señal recibida: retenida; sin recibir: anulada", () => {
    const ahora = madrid("2026-09-29", "18:00");
    expect(resolverPlanton(recibida, ahora)).toEqual({ ok: true, patch: { depositStatus: "retenida", depositRetainedAt: ahora.toISOString() } });
    expect(resolverPlanton(cita({ depositStatus: "pedida", depositEur: 20, depositRequestedAt: isoDelSalon("2026-09-28", "09:00") }), ahora)).toEqual({ ok: true, patch: { depositStatus: "anulada" } });
  });

  it("24 h de verdad aunque cambie la hora oficial (noche del 24 al 25 de octubre)", () => {
    const domingo = cita({ ...recibida, start: isoDelSalon("2026-10-25", "10:00") });
    // Sábado 10:30 de verano → domingo 10:00 de invierno son 24,5 h reales: a tiempo.
    expect((resolverCancelacion(domingo, regla, "clienta", madrid("2026-10-24", "10:30")) as { patch: Partial<Appointment> }).patch.depositStatus).toBe("devuelta");
    // Sábado 11:30 → 23,5 h: tarde.
    expect((resolverCancelacion(domingo, regla, "clienta", madrid("2026-10-24", "11:30")) as { patch: Partial<Appointment> }).patch.depositStatus).toBe("retenida");
  });

  it("deshacer una cancelación recupera el estado real; una devolución hecha no se deshace", () => {
    const devuelta = { ...recibida, status: "cancelled" as const, depositStatus: "devuelta" as const, depositRefundedEur: 20 };
    expect(reabrirSenal(devuelta)).toEqual({ ok: true, patch: { depositStatus: "recibida", depositRetainedAt: undefined, depositRefundedEur: undefined } });
    expect(reabrirSenal({ ...devuelta, depositRefundedAt: isoDelSalon("2026-09-28", "12:00") })).toEqual({ ok: true, patch: {} });
  });

  it("confirmar la devolución solo si hay algo a devolver y una vez", () => {
    const ahora = madrid("2026-09-28", "12:00");
    const devuelta = { ...recibida, depositStatus: "devuelta" as const, depositRefundedEur: 20 };
    expect(confirmarDevolucion(devuelta, ahora)).toEqual({ ok: true, patch: { depositRefundedAt: ahora.toISOString() } });
    expect(confirmarDevolucion({ ...devuelta, depositRefundedAt: ahora.toISOString() }, ahora)).toEqual({ ok: false, error: "SENAL_ESTADO_INVALIDO" });
    expect(confirmarDevolucion(recibida, ahora)).toEqual({ ok: false, error: "SENAL_ESTADO_INVALIDO" });
  });
});

describe("cambia la hora o el servicio", () => {
  it("adelantar la cita recorta el plazo; retrasarla no lo alarga", () => {
    const pedida = cita({ depositStatus: "pedida", depositEur: 20, depositRequestedAt: isoDelSalon("2026-09-28", "09:00"), depositDueAt: isoDelSalon("2026-09-28", "11:00") });
    expect(moverSenal(pedida, isoDelSalon("2026-09-28", "10:00"), madrid("2026-09-28", "09:30"))).toEqual({ ok: true, patch: { depositDueAt: isoDelSalon("2026-09-28", "10:00") } });
    expect(moverSenal(pedida, isoDelSalon("2026-10-01", "10:00"), madrid("2026-09-28", "09:30"))).toEqual({ ok: true, patch: {} });
  });

  it("recibida y el nuevo servicio cuesta más: queda pendiente la diferencia", () => {
    const recibida = cita({ depositStatus: "recibida", depositEur: 20, depositReceivedEur: 20 });
    const r = reajustarSenal(recibida, 30);
    expect(r).toEqual({ ok: true, patch: { depositEur: 30, depositRefundedEur: undefined } });
    expect(diferenciaSenal(aplicar(recibida, r))).toEqual({ pendienteEur: 10, aDevolverEur: 0 });
  });

  it("recibida y cuesta menos: la diferencia queda a devolver y no se descuenta", () => {
    const recibida = cita({ depositStatus: "recibida", depositEur: 20, depositReceivedEur: 20 });
    const reajustada = aplicar(recibida, reajustarSenal(recibida, 10));
    expect(diferenciaSenal(reajustada)).toEqual({ pendienteEur: 0, aDevolverEur: 10 });
    const r = aplicarSenal(reajustada, madrid("2026-09-29", "17:50"));
    expect(r.aCobrarEur).toBe(15);
    expect(r.patch).toMatchObject({ depositAppliedEur: 10, depositRefundedEur: 10 });
  });

  it("sin recibir: cambia el importe, o se anula si el nuevo servicio no lleva señal", () => {
    const pedida = cita({ depositStatus: "pedida", depositEur: 20, depositRequestedAt: isoDelSalon("2026-09-28", "09:00") });
    expect(reajustarSenal(pedida, 30)).toEqual({ ok: true, patch: { depositEur: 30 } });
    expect(reajustarSenal(pedida, 0)).toEqual({ ok: true, patch: { depositStatus: "anulada", depositEur: 0 } });
  });
});

describe("reserva por la web y citas antiguas", () => {
  it("automática: nace pedida con el plazo; si no, por pedir", () => {
    const ahora = madrid("2026-09-28", "10:00");
    const auto = reglaSenal({ depositEnabled: true, depositAmountEur: 20, depositAuto: true, depositDeadlineHours: 1 });
    expect(senalDeReservaNueva(auto, { serviceIds: ["corte"], durationMin: 45, priceEur: 25 }, isoDelSalon("2026-09-29", "17:00"), ahora)).toEqual({
      depositStatus: "pedida", depositEur: 20, depositRequestedAt: ahora.toISOString(), depositPeriodHours: 1, depositDueAt: isoDelSalon("2026-09-28", "11:00"),
    });
    expect(senalDeReservaNueva(regla, { serviceIds: ["corte"], durationMin: 45, priceEur: 25 }, isoDelSalon("2026-09-29", "17:00"), ahora)).toEqual({ depositStatus: "por_pedir", depositEur: 20 });
    expect(senalDeReservaNueva(reglaSenal({}), { serviceIds: ["corte"], durationMin: 45, priceEur: 25 }, isoDelSalon("2026-09-29", "17:00"), ahora)).toEqual({});
  });

  it("una cita anterior al ciclo de vida se lee por sus fechas", () => {
    const antigua = cita({ depositEur: 10, depositRequestedAt: isoDelSalon("2026-09-28", "09:00"), depositPeriodHours: 4 });
    expect(vencimientoSenal(antigua)).toBe(isoDelSalon("2026-09-28", "13:00"));
    expect(estadoSenal(antigua, madrid("2026-09-28", "12:00"))).toBe("pedida");
    expect(estadoSenal(antigua, madrid("2026-09-28", "13:00"))).toBe("vencida");
    expect(estadoSenal({ ...antigua, depositReceivedAt: isoDelSalon("2026-09-28", "10:00") })).toBe("recibida");
    expect(estadoSenal(cita())).toBe("no_aplica");
  });
});
