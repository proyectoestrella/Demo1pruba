import { describe, expect, it } from "bun:test";
import {
  ERROR_BLOQUEO_MANUAL,
  ERROR_FUERA_HORARIO,
  ERROR_HUECO_OCUPADO,
  firmaReservaPublica,
  haySolape,
  mensajeErrorReserva,
  momentoLocal,
  profesionalTrabaja,
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

  it("explica que la hora cae fuera del horario de la profesional", () => {
    expect(mensajeErrorReserva(new Error(ERROR_FUERA_HORARIO))).toContain("fuera del horario");
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

describe("horario por profesional visto desde el servidor", () => {
  // Perfil real mínimo: dos personas, y la segunda solo trabaja por la tarde.
  const perfil = {
    name: "PeluChic",
    tagline: "Peluquería",
    team: ["María", "Lucía"],
    openingHours: ["10:00–14:00, 16:00–20:00", "10:00–14:00, 16:00–20:00", "10:00–14:00, 16:00–20:00", "10:00–14:00, 16:00–20:00", "10:00–14:00, 16:00–20:00", "10:00–14:00", "Cerrado"],
    teamHours: [
      ["10:00–14:00, 16:00–20:00", "10:00–14:00, 16:00–20:00", "10:00–14:00, 16:00–20:00", "10:00–14:00, 16:00–20:00", "10:00–14:00, 16:00–20:00", "10:00–14:00", "Cerrado"],
      ["16:00–20:00", "16:00–20:00", "16:00–20:00", "16:00–20:00", "16:00–20:00", "Cerrado", "Cerrado"],
    ],
  };

  it("lee el instante en la hora del salón, no en la del servidor", () => {
    // Las 10:00 de Madrid en septiembre son las 08:00Z; el servidor corre en UTC.
    expect(momentoLocal("2026-09-28T08:00:00.000Z")).toEqual({ weekday: 1, minuto: 600 });
    // Y en enero (sin horario de verano) las 10:00 son las 09:00Z.
    expect(momentoLocal("2027-01-11T09:00:00.000Z")).toEqual({ weekday: 1, minuto: 600 });
  });

  it("la primera trabaja por la mañana; la segunda solo por la tarde", () => {
    const lunes10 = "2026-09-28T08:00:00.000Z";
    expect(profesionalTrabaja(perfil, "mario", lunes10, 60)).toBe(true);
    expect(profesionalTrabaja(perfil, "diego", lunes10, 60)).toBe(false);
    const lunes17 = "2026-09-28T15:00:00.000Z";
    expect(profesionalTrabaja(perfil, "diego", lunes17, 60)).toBe(true);
  });

  it("la cita tiene que caber entera antes del descanso o del cierre", () => {
    const lunes1330 = "2026-09-28T11:30:00.000Z";
    expect(profesionalTrabaja(perfil, "mario", lunes1330, 30)).toBe(true);
    expect(profesionalTrabaja(perfil, "mario", lunes1330, 60)).toBe(false);
  });

  it("un domingo cerrado y una profesional desconocida no trabajan nunca", () => {
    const domingo11 = "2026-09-27T09:00:00.000Z";
    expect(profesionalTrabaja(perfil, "mario", domingo11, 30)).toBe(false);
    expect(profesionalTrabaja(perfil, "nadie", "2026-09-28T08:00:00.000Z", 30)).toBe(false);
  });

  it("sin horario por persona manda el del local", () => {
    const { teamHours: _fuera, ...soloLocal } = perfil;
    void _fuera;
    expect(profesionalTrabaja(soloLocal, "diego", "2026-09-28T08:00:00.000Z", 60)).toBe(true);
    expect(profesionalTrabaja(soloLocal, "diego", "2026-09-28T13:00:00.000Z", 60)).toBe(false);
  });
});
