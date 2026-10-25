import { describe, expect, it } from "bun:test";
import {
  diaCompletoParaProfesional,
  topeCitasDiaProfesional,
  ERROR_BLOQUEO_MANUAL,
  ERROR_FUERA_HORARIO,
  ERROR_HUECO_OCUPADO,
  ERROR_PRIVACIDAD_NO_CONFIRMADA,
  datosReservaPublicaDesdeCarta,
  faltaColumnaAcusePrivacidad,
  haLeidoAvisoPrivacidad,
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

  it("requiere confirmar la lectura del aviso y explica el rechazo del servidor", () => {
    expect(haLeidoAvisoPrivacidad(true)).toBe(true);
    expect(haLeidoAvisoPrivacidad(false)).toBe(false);
    expect(haLeidoAvisoPrivacidad(undefined)).toBe(false);
    expect(mensajeErrorReserva(new Error(ERROR_PRIVACIDAD_NO_CONFIRMADA))).toContain("Confirma que has leído");
  });

  it("detecta si falta la columna de acuse para no guardar reservas sin rastro", () => {
    expect(faltaColumnaAcusePrivacidad({ message: "column privacy_notice_acknowledged_at does not exist" })).toBe(true);
    expect(faltaColumnaAcusePrivacidad({ message: "column reminder_sent_at does not exist" })).toBe(false);
    expect(faltaColumnaAcusePrivacidad(null)).toBe(false);
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

describe("datos de una reserva pública", () => {
  const perfil = {
    name: "PeluChic",
    tagline: "Peluquería",
    menu: ["Corte~30~20~~~corte", "Color~60~40~~~color"],
  };

  it("recalcula carta, precio y duración y guarda el extremo alto si es flexible", () => {
    expect(datosReservaPublicaDesdeCarta(perfil, ["corte", "color"])).toEqual({ durationMin: 90, priceEur: 60 });
    expect(datosReservaPublicaDesdeCarta({ ...perfil, duracionFlexible: true }, ["corte", "color"])).toEqual({ durationMin: 135, priceEur: 60 });
  });

  it("rechaza ids ausentes o servicios inactivos en vez de creer al navegador", () => {
    expect(datosReservaPublicaDesdeCarta(perfil, ["inventado"])).toBeNull();
    expect(datosReservaPublicaDesdeCarta({ ...perfil, menu: ["Corte~30~20~~off~corte"] }, ["corte"])).toBeNull();
    // El servidor recalcula con el mismo criterio: Color + lavado suelto no cobra el lavado dos veces.
    const conLavado = { ...perfil, menu: ["Color~60~40~~~color", "Lavado~15~10~~~lavado"], lavado: { servicioId: "lavado", incluidoEn: ["color"] } };
    expect(datosReservaPublicaDesdeCarta(conLavado, ["color", "lavado"])).toEqual({ durationMin: 60, priceEur: 40 });
    // Apagado por la gerente: suma todo.
    expect(datosReservaPublicaDesdeCarta({ ...conLavado, lavado: { servicioId: "", incluidoEn: [] } }, ["color", "lavado"])).toEqual({ durationMin: 75, priceEur: 50 });
    // Sin configurar (25-oct): por defecto el Color incluye el lavado suelto.
    expect(datosReservaPublicaDesdeCarta({ ...conLavado, lavado: undefined }, ["color", "lavado"])).toEqual({ durationMin: 60, priceEur: 40 });
  });
});

describe("tope de citas al día (PeluChic 9 por profesional)", () => {
  const fechaDe = (iso: string) => iso.slice(0, 10);
  const cita = (status: string, emp = "anca") => ({ employeeId: emp, start: "2026-10-28T09:00:00Z", status });
  it("solo cuentan las confirmadas: 9 pendientes no llenan el día", () => {
    expect(diaCompletoParaProfesional(Array.from({ length: 9 }, () => cita("pending")), "anca", "2026-10-28", fechaDe, 9)).toBe(false);
    expect(diaCompletoParaProfesional(Array.from({ length: 9 }, () => cita("confirmed")), "anca", "2026-10-28", fechaDe, 9)).toBe(true);
    expect(diaCompletoParaProfesional(Array.from({ length: 9 }, () => cita("confirmed", "maria")), "anca", "2026-10-28", fechaDe, 9)).toBe(false);
  });
  it("el tope sale del perfil o del salón", () => {
    expect(topeCitasDiaProfesional({}, "peluchic")).toBe(9);
    expect(topeCitasDiaProfesional({}, "otro")).toBeNull();
    expect(topeCitasDiaProfesional({ maxCitasDiaProfesional: 12 }, "peluchic")).toBe(12);
  });
});
