import { describe, expect, it } from "bun:test";
import {
  ERROR_BLOQUEO_MANUAL,
  ERROR_HUECO_OCUPADO,
  firmaReservaPublica,
  haySolape,
  mensajeErrorReserva,
} from "./reserva-publica";

describe("errores recuperables de la reserva pública", () => {
  it("un reintento conserva la firma aunque cambie el id local walk-in", () => {
    const cita = {
      clientId: "c-walkin-1",
      clientName: "Marta",
      serviceIds: ["corte"],
      employeeId: "mario" as const,
      start: "2026-09-26T13:00:00.000Z",
      duration: 30,
      priceEur: 15,
      status: "pending" as const,
    };
    const cliente = { name: "Marta", phone: "600111222" };
    expect(firmaReservaPublica("salon", cita, cliente)).toBe(
      firmaReservaPublica("salon", { ...cita, clientId: "c-walkin-2" }, cliente),
    );
    expect(
      firmaReservaPublica("salon", { ...cita, start: "2026-09-26T14:00:00.000Z" }, cliente),
    ).not.toBe(firmaReservaPublica("salon", cita, cliente));
  });

  it("explica que un hueco ocupado requiere elegir otra hora", () => {
    expect(mensajeErrorReserva(new Error(ERROR_HUECO_OCUPADO))).toBe(
      "Esa hora ya no está disponible, elige otra.",
    );
  });

  it("explica el bloqueo manual sin culpar a la clienta", () => {
    expect(mensajeErrorReserva(new Error(ERROR_BLOQUEO_MANUAL))).toBe(
      "No podemos confirmar tu reserva online; llama al salón.",
    );
  });

  it("ante red o servidor ofrece reintentar y conserva los datos", () => {
    expect(mensajeErrorReserva(new Error("fetch failed"))).toContain("Tus datos siguen aquí");
  });
});

describe("solape de intervalos para la comprobación del servidor", () => {
  const cita = { start_at: "2026-09-26T13:00:00.000Z", duration_min: 60, status: "pending" };

  it("detecta una cita que empieza antes y acaba dentro del hueco pedido", () => {
    expect(haySolape("2026-09-26T13:30:00.000Z", 30, [cita])).toBe(true);
  });

  it("admite horas contiguas y citas canceladas", () => {
    expect(haySolape("2026-09-26T14:00:00.000Z", 30, [cita])).toBe(false);
    expect(haySolape("2026-09-26T13:30:00.000Z", 30, [{ ...cita, status: "cancelled" }])).toBe(
      false,
    );
    expect(haySolape("2026-09-26T13:30:00.000Z", 30, [{ ...cita, status: "no-show" }])).toBe(false);
  });
});
