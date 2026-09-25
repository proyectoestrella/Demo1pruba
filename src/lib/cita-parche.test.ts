import { describe, expect, it } from "bun:test";
import { camposCambiados, columnasDeParche, filaSinLote3, notaLegado } from "./cita-parche";
import { parseBookingNote } from "./booking-answers";
import { parseDepositNote } from "./deposit-deadline";
import { leerOrigen } from "./origen-cita";

describe("parche por campos", () => {
  it("un parche que solo trae status no lleva ninguna otra columna", () => {
    expect(columnasDeParche({ status: "confirmed" })).toEqual({ status: "confirmed" });
  });

  it("traduce nombres y convierte los servicios a la columna con comas", () => {
    expect(columnasDeParche({ start: "2026-09-28T08:00:00.000Z", duration: 45, serviceIds: ["corte", "barba"], paidAt: undefined })).toEqual({
      start_at: "2026-09-28T08:00:00.000Z",
      duration_min: 45,
      service_id: "corte,barba",
      paid_at: null,
    });
  });

  it("ignora campos que no son columnas (id, clientId)", () => {
    expect(columnasDeParche({ id: "a-1", clientId: "c-1", note: "hola" } as never)).toEqual({ note: "hola" });
  });
});

describe("nota legado para esquemas sin las columnas del lote 3", () => {
  const fila = {
    note: "Trae foto",
    booking_answers: { hairLength: "Largo" },
    origen: "tpv123",
    deposit_requested_at: "2026-09-25T10:00:00.000Z",
    deposit_due_at: "2026-09-25T12:00:00.000Z",
    deposit_period_hours: 2,
    deposit_eur: 10,
  };

  it("vuelca respuestas, origen y señal a los marcadores y se pueden volver a leer", () => {
    const nota = notaLegado(fila)!;
    const senal = parseDepositNote(nota);
    expect(senal.dueAt).toBe("2026-09-25T12:00:00.000Z");
    const origen = leerOrigen(senal.note);
    expect(origen.origen).toBe("tpv123");
    const respuestas = parseBookingNote(origen.note);
    expect(respuestas.answers).toEqual({ hairLength: "Largo" });
    expect(respuestas.note).toBe("Trae foto");
  });

  it("filaSinLote3 quita las columnas nuevas y deja la nota con marcadores", () => {
    const sin = filaSinLote3(fila);
    expect(sin).not.toHaveProperty("booking_answers");
    expect(sin).not.toHaveProperty("origen");
    expect(sin).not.toHaveProperty("deposit_due_at");
    expect(String(sin.note)).toContain("[siShow:reserva:v1:");
    expect(String(sin.note)).toContain("[siShow:origen:v1:tpv123]");
  });

  it("una nota limpia sin nada codificado se queda como está", () => {
    expect(notaLegado({ note: "solo texto" })).toBe("solo texto");
    expect(notaLegado({ note: null })).toBeNull();
  });
});

describe("camposCambiados — las acciones del panel mandan solo lo que tocan", () => {
  const cita = {
    id: "a-1", clientId: "c", clientName: "Ana", serviceIds: ["corte"], employeeId: "mario" as const,
    start: "2026-09-29T12:00:00.000Z", duration: 45, priceEur: 25, status: "confirmed" as const,
    note: "nota", technicalNotes: "6.3 + 20 vol",
  };

  it("cancelar solo cambia el estado", () => {
    expect(camposCambiados(cita, { ...cita, status: "cancelled" })).toEqual({ status: "cancelled" });
  });

  it("cobrar trae forma de pago y hora, nada más", () => {
    expect(camposCambiados(cita, { ...cita, paymentMethod: "bizum", paidAt: "2026-09-29T13:00:00.000Z" })).toEqual({ paymentMethod: "bizum", paidAt: "2026-09-29T13:00:00.000Z" });
  });

  it("quitar un campo lo manda como undefined (se borra) y sin cambios no hay parche", () => {
    const { technicalNotes: _t, ...sin } = cita; void _t;
    expect(camposCambiados(cita, sin)).toEqual({ technicalNotes: undefined });
    expect("technicalNotes" in camposCambiados(cita, sin)).toBe(true);
    expect(camposCambiados(cita, { ...cita })).toEqual({});
  });
});
