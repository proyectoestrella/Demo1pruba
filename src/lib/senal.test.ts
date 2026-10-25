import { describe, expect, it } from "bun:test";
import { aplicaSenal, duracionCartaParaSenal, importeSenal, importeSenalTexto, introCartaSenal, resumenCancelacionSenal, marcadoresQueFaltan, PLANTILLA_SENAL_POR_DEFECTO, reglaSenal, rellenarPlantillaSenal, respuestaFaqSenal, servicioLlevaSenal, textoSenalPublico } from "./senal";
import { mensajeDeFianza } from "./avisos";

const eur = (n: number) => `${n} €`;
const mechas = { serviceIds: ["mechas"], durationMin: 120, priceEur: 80 };
const corte = { serviceIds: ["corte"], durationMin: 45, priceEur: 25 };

describe("una sola regla de señal por salón", () => {
  it("calcula la fianza por la duración de carta y solo cae a la cita si no puede reconocerla", () => {
    const carta = {
      peinar: { durationMin: 40 },
      lavado: { durationMin: 15 },
      color: { durationMin: 45 },
      corte: { durationMin: 30 },
    };
    const r = reglaSenal({ depositEnabled: true, depositMode: "hora", depositHourlyRateEur: 5 });
    const importeDe = (serviceIds: string[], durationMin: number) => importeSenal(r, {
      serviceIds,
      durationMin: duracionCartaParaSenal(serviceIds, carta, durationMin),
      priceEur: 0,
    });

    expect(importeDe(["peinar"], 60)).toBe(5); // 40 min de carta (3 €), sube al mínimo de 5 €
    expect(importeDe(["lavado"], 60)).toBe(5);
    expect(importeDe(["color", "corte"], 120)).toBe(6); // 45 + 30 = 75 min
    expect(importeDe(["otro"], 60)).toBe(5);
    expect(importeDe([], 45)).toBe(5);
  });

  it("decide de forma determinista el texto bajo la carta", () => {
    expect(introCartaSenal({ activa: false })).toBeUndefined();
    expect(introCartaSenal({ activa: true })).toBe(
      "La fianza se calcula según la duración del servicio y se confirma por Bizum.",
    );
  });

  it("sin configurar no hay señal: ni el antiguo «depósito del 20 %» de más de 90 min", () => {
    const r = reglaSenal({});
    expect(r.activa).toBe(false);
    expect(importeSenal(r, mechas)).toBe(0);
    expect(textoSenalPublico(r, mechas, "PeluChic", eur)).toBeNull();
    expect(servicioLlevaSenal(r, { id: "mechas", durationMin: 120, priceEur: 80 })).toBe(false);
  });

  it("un perfil antiguo (activada + importe) sigue igual: fija y a todas", () => {
    const r = reglaSenal({ depositEnabled: true, depositAmountEur: 20, depositBizumPhone: "666 77 67 31" });
    expect(r).toMatchObject({ activa: true, modo: "fijo", aplicaA: "todas", ventanaHoras: 4, horasCancelacion: 24 });
    expect(importeSenal(r, corte)).toBe(20);
    expect(importeSenal(r, mechas)).toBe(20);
  });

  it("porcentaje redondeado al euro y nunca más que el servicio", () => {
    const r = reglaSenal({ depositEnabled: true, depositMode: "porcentaje", depositPercent: 20 });
    expect(importeSenal(r, mechas)).toBe(16);
    const cara = reglaSenal({ depositEnabled: true, depositAmountEur: 50 });
    expect(importeSenal(cara, { serviceIds: ["x"], durationMin: 15, priceEur: 12 })).toBe(12);
  });

  it("por hora redondea cada medio euro hacia arriba, no se topa al precio y funciona con precios ocultos", () => {
    const r = reglaSenal({ depositEnabled: true, depositMode: "hora", depositHourlyRateEur: 5 });
    expect([15, 30, 45, 60, 90, 150, 180].map((durationMin) => importeSenal(r, { serviceIds: ["x"], durationMin, priceEur: 0 }))).toEqual([5, 5, 5, 5, 8, 13, 15]);
    const texto = textoSenalPublico(r, { serviceIds: ["x"], durationMin: 90, priceEur: 0 }, "PeluChic", (n) => `${n.toFixed(2).replace(".", ",")} €`)!;
    expect(texto).toContain("8 €");
    expect(texto).not.toContain(",00 €");
  });

  it("la fianza manual por hora sin teléfono conserva el texto actual", () => {
    const r = reglaSenal({ depositEnabled: true, depositMode: "hora", depositHourlyRateEur: 5, depositDeadlineHours: 4, depositAuto: false, depositAutoRelease: false });
    const texto = textoSenalPublico(r, { serviceIds: ["x"], durationMin: 90, priceEur: 0 }, "PeluChic", eur)!;
    expect(texto).toBe("PeluChic te pedirá una fianza por Bizum de 8 € (5 € por hora de servicio). La dueña confirma la solicitud y entonces el hueco queda reservado; tendrás 4 horas para pagarla y la dueña marcará el pago cuando lo reciba.");
  });

  it("la fianza manual por hora muestra el Bizum configurado, el importe y el plazo", () => {
    const r = reglaSenal({
      depositEnabled: true,
      depositMode: "hora",
      depositHourlyRateEur: 5,
      depositDeadlineHours: 4,
      depositAuto: false,
      depositAutoRelease: false,
      depositBizumPhone: "600 000 000",
    });
    const texto = textoSenalPublico(r, { serviceIds: ["x"], durationMin: 30, priceEur: 0 }, "PeluChic", eur)!;
    expect(texto).toBe("PeluChic te pedirá una fianza por Bizum de 5 € (5 € por hora de servicio). La dueña confirma la solicitud y entonces el hueco queda reservado; tendrás 4 horas para pagarla haciendo un Bizum al 600 000 000, y la dueña marcará el pago cuando lo reciba.");
  });

  it("por hora redondea al euro más cercano, sin inventar 5 € si la tarifa es cero", () => {
    const cinco = reglaSenal({ depositEnabled: true, depositMode: "hora", depositHourlyRateEur: 5 });
    expect(importeSenal(cinco, { serviceIds: ["x"], durationMin: 90, priceEur: 100 })).toBe(8);
    expect(importeSenal(cinco, { serviceIds: ["x"], durationMin: 50, priceEur: 100 })).toBe(5);
    expect(reglaSenal({ depositEnabled: true, depositMode: "hora", depositHourlyRateEur: 0 }).tarifaPorHoraEur).toBe(0);
    expect(importeSenal(reglaSenal({ depositEnabled: true, depositMode: "hora", depositHourlyRateEur: 0 }), { serviceIds: ["x"], durationMin: 90, priceEur: 100 })).toBe(0);
  });

  it("la reserva pública cambia la fianza al cambiar servicios o su duración efectiva", () => {
    const r = reglaSenal({ depositEnabled: true, depositMode: "hora", depositHourlyRateEur: 5 });
    const importeVisible = (durationMin: number) => textoSenalPublico(
      r,
      { serviceIds: ["servicio"], durationMin, priceEur: 0 },
      "PeluChic",
      eur,
      { ocultarImporte: true },
    );
    expect(importeVisible(60)).toContain("5 €");
    expect(importeVisible(90)).toContain("8 €");
    // Duración flexible/manual: se muestra lo que se reservó, no el catálogo.
    expect(importeVisible(150)).toContain("13 €");
  });

  it("a partir de X minutos, por lista de servicios y solo a clientas nuevas", () => {
    const larga = reglaSenal({ depositEnabled: true, depositAppliesTo: "duracion", depositMinMinutes: 60 });
    expect(aplicaSenal(larga, mechas)).toBe(true);
    expect(aplicaSenal(larga, corte)).toBe(false);
    expect(servicioLlevaSenal(larga, { id: "mechas", durationMin: 120, priceEur: 80 })).toBe(true);

    const lista = reglaSenal({ depositEnabled: true, depositAppliesTo: "servicios", depositServiceIds: ["mechas"] });
    expect(aplicaSenal(lista, { ...corte, serviceIds: ["corte", "mechas"] })).toBe(true);
    expect(aplicaSenal(lista, corte)).toBe(false);

    const nuevas = reglaSenal({ depositEnabled: true, depositAppliesTo: "nuevas" });
    expect(aplicaSenal(nuevas, { ...corte, esNueva: true })).toBe(true);
    expect(aplicaSenal(nuevas, { ...corte, esNueva: false })).toBe(false);
    expect(aplicaSenal(nuevas, corte)).toBe(true); // la web no lo sabe: avisa
  });

  it("ventana de 1 a 4 h; un valor raro cae a 4", () => {
    expect(reglaSenal({ depositDeadlineHours: 3 }).ventanaHoras).toBe(3);
    expect(reglaSenal({ depositDeadlineHours: 24 }).ventanaHoras).toBe(4);
  });

  it("la cancelación gratuita: 24 h por defecto, ya no depende de la política de plantón", () => {
    expect(reglaSenal({ depositCancelHours: 48 }).horasCancelacion).toBe(48);
    expect(reglaSenal({}).horasCancelacion).toBe(24);
    // noShowNoticeHours / noShowFeeEur ya no se leen aquí (lote 12): la señal tiene su propia regla.
    expect(reglaSenal({ noShowNoticeHours: 2, noShowFeeEur: 10 }).horasCancelacion).toBe(24);
  });

  it("liberación automática: encendida por defecto; solo `false` explícito la apaga", () => {
    expect(reglaSenal({}).liberacionAutomatica).toBe(true);
    expect(reglaSenal({ depositAutoRelease: true }).liberacionAutomatica).toBe(true);
    expect(reglaSenal({ depositAutoRelease: false }).liberacionAutomatica).toBe(false);
  });
});

describe("un solo mensaje para la clienta", () => {
  it("quita los ceros de relleno en todos los importes de señal", () => {
    const conDecimales = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
    const r = reglaSenal({ depositEnabled: true, depositMode: "hora", depositHourlyRateEur: 5 });
    expect(textoSenalPublico(r, { serviceIds: ["x"], durationMin: 60, priceEur: 0 }, "PeluChic", conDecimales)).not.toContain(",00 €");
    expect(respuestaFaqSenal(r, conDecimales)).toContain("5 € por hora de servicio");
    expect(resumenCancelacionSenal(reglaSenal({ depositEnabled: true, depositAmountEur: 5 }), conDecimales)).toContain("5 €");
    expect(importeSenalTexto(28.5)).toBe("28,50 €");
    expect(importeSenalTexto(5)).toBe("5 €");
  });

  it("pedida por WhatsApp: importe, plazo, que se descuenta y cuándo se devuelve", () => {
    const r = reglaSenal({ depositEnabled: true, depositAmountEur: 20, depositDeadlineHours: 2, depositCancelHours: 24 });
    const t = textoSenalPublico(r, corte, "PeluChic", eur)!;
    expect(t).toContain("PeluChic te pedirá por WhatsApp una señal de 20 €");
    expect(t).toContain("2 horas");
    expect(t).toContain("Se descuenta del precio");
    expect(t).toContain("más de 24 h");
    expect(t).not.toMatch(/dep[oó]sito|20 %/);
  });

  it("automática: enseña el Bizum del salón", () => {
    const r = reglaSenal({ depositEnabled: true, depositAmountEur: 20, depositAuto: true, depositBizumPhone: "666 77 67 31", depositDeadlineHours: 1 });
    expect(textoSenalPublico(r, corte, "PeluChic", eur)).toContain("haz un Bizum de 20 € al 666 77 67 31 en las próximas 1 hora");
  });

  it("solo nuevas y sin saberlo: «si es tu primera visita»", () => {
    const r = reglaSenal({ depositEnabled: true, depositAppliesTo: "nuevas", depositAmountEur: 10 });
    expect(textoSenalPublico(r, corte, "PeluChic", eur)).toMatch(/^Si es tu primera visita, te pediremos/);
  });

  it("la FAQ dice lo mismo que la reserva, o que se paga al terminar", () => {
    expect(respuestaFaqSenal(reglaSenal({}), eur)).toBe("No. Se paga en el salón al terminar.");
    const r = reglaSenal({ depositEnabled: true, depositAppliesTo: "duracion", depositMinMinutes: 60, depositMode: "porcentaje", depositPercent: 20 });
    expect(respuestaFaqSenal(r, eur)).toBe("Solo en los servicios de 60 minutos o más: pedimos una señal del 20 % del servicio por Bizum, con 4 horas para hacerlo. Se descuenta del precio; si cancelas con más de 24 h de antelación, te la devolvemos. Si no llega a tiempo, la cita se anula y el hueco queda libre.");
  });

  it("con liberación automática (por defecto), la web y la FAQ avisan de que el hueco se libera; apagada, no", () => {
    const conLiberacion = reglaSenal({ depositEnabled: true, depositAmountEur: 20, depositCancelHours: 24 });
    const sinLiberacion = reglaSenal({ depositEnabled: true, depositAmountEur: 20, depositCancelHours: 24, depositAutoRelease: false });
    expect(textoSenalPublico(conLiberacion, corte, "PeluChic", eur)).toContain("Si no llega a tiempo, la cita se anula y el hueco queda libre.");
    expect(textoSenalPublico(sinLiberacion, corte, "PeluChic", eur)).not.toContain("se anula");
    expect(respuestaFaqSenal(conLiberacion, eur)).toContain("Si no llega a tiempo, la cita se anula y el hueco queda libre.");
    expect(respuestaFaqSenal(sinLiberacion, eur)).not.toContain("se anula");
  });

  it("con precios ocultos no revela el importe de una señal porcentual", () => {
    const r = reglaSenal({ depositEnabled: true, depositMode: "porcentaje", depositPercent: 25 });
    expect(textoSenalPublico(r, mechas, "PeluChic", eur, { ocultarImporte: true })).toBe("Se pedirá una señal por Bizum.");
    expect(textoSenalPublico(r, mechas, "PeluChic", eur, { ocultarImporte: false })).toContain("20 €");
  });
});

describe("plantilla del WhatsApp de la señal", () => {
  const datos = { nombre: "Ana", salon: "PeluChic", importe: "20 €", bizum: "666 77 67 31", cuando: "el martes a las 17:00", plazo: "tienes hasta hoy a las 12:00 para hacer el Bizum" };

  it("sin plantilla sale exactamente el texto de siempre", () => {
    expect(rellenarPlantillaSenal(undefined, datos)).toBe("Hola Ana, soy PeluChic. Para confirmar tu cita el martes a las 17:00, déjanos 20 € de señal por Bizum al 666 77 67 31; tienes hasta hoy a las 12:00 para hacer el Bizum. En cuanto lo recibamos te la confirmamos. ¡Gracias!");
    expect(rellenarPlantillaSenal("   ", datos)).toBe(rellenarPlantillaSenal(PLANTILLA_SENAL_POR_DEFECTO, datos));
  });

  it("la del salón rellena sus marcadores y deja a la vista los desconocidos", () => {
    expect(rellenarPlantillaSenal("¡Hola {nombre}! {importe} al {bizum}, {plazo}. {firma}", datos)).toBe("¡Hola Ana! 20 € al 666 77 67 31, tienes hasta hoy a las 12:00 para hacer el Bizum. {firma}");
  });

  it("avisa si faltan el importe o el Bizum", () => {
    expect(marcadoresQueFaltan("Hola {nombre}")).toEqual(["{importe}", "{bizum}"]);
    expect(marcadoresQueFaltan(PLANTILLA_SENAL_POR_DEFECTO)).toEqual([]);
  });

  it("mensajeDeFianza usa la plantilla del perfil", () => {
    const m = mensajeDeFianza({ clientName: "Ana", salonName: "PeluChic", startISO: "2026-09-29T15:00:00.000Z", bizumPhone: "600", importeEur: 20, deadlineISO: "2026-09-28T10:00:00.000Z", plantilla: "{salon}: {importe} al {bizum}" }, "2026-09-28T08:00:00.000Z");
    expect(m).toBe("PeluChic: 20 € al 600");
  });
});

describe("la tarjeta de cancelación de la portada dice lo mismo", () => {
  it("sin señal, con señal fija y con porcentaje", () => {
    expect(resumenCancelacionSenal(reglaSenal({}), eur)).toBe("Hasta 24 horas antes, sin coste y sin dar explicaciones.");
    expect(resumenCancelacionSenal(reglaSenal({ depositEnabled: true, depositAmountEur: 20 }), eur)).toBe("Hasta 24 horas antes, sin coste. Para confirmar la cita se pide una señal de 20 € por Bizum que se descuenta del servicio.");
    expect(resumenCancelacionSenal(reglaSenal({ depositEnabled: true, depositMode: "porcentaje", depositPercent: 25, depositCancelHours: 48 }), eur)).toBe("Hasta 2 días antes, sin coste. Para confirmar la cita se pide una señal del 25 % por Bizum que se descuenta del servicio.");
  });
});

it("fianza: el lavado incluido en el Color no cuenta para la duración (25-oct)", () => {
  const carta = { color: { durationMin: 60 }, lavado: { durationMin: 15 } };
  const lav = { servicioId: "lavado", incluidoEn: ["color"] };
  expect(duracionCartaParaSenal(["color", "lavado"], carta, 75)).toBe(75);
  expect(duracionCartaParaSenal(["color", "lavado"], carta, 75, lav)).toBe(60);
  expect(duracionCartaParaSenal(["lavado"], carta, 15, lav)).toBe(15);
});
