import { describe, expect, it } from "bun:test";
import { aplicaSenal, importeSenal, reglaSenal, respuestaFaqSenal, servicioLlevaSenal, textoSenalPublico } from "./senal";

const eur = (n: number) => `${n} €`;
const mechas = { serviceIds: ["mechas"], durationMin: 120, priceEur: 80 };
const corte = { serviceIds: ["corte"], durationMin: 45, priceEur: 25 };

describe("una sola regla de señal por salón", () => {
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

  it("la cancelación gratuita sale de la regla o de la política de plantón", () => {
    expect(reglaSenal({ depositCancelHours: 48 }).horasCancelacion).toBe(48);
    expect(reglaSenal({ noShowNoticeHours: 2 }).horasCancelacion).toBe(2);
  });
});

describe("un solo mensaje para la clienta", () => {
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
    expect(respuestaFaqSenal(r, eur)).toBe("Solo en los servicios de 60 minutos o más: pedimos una señal del 20 % del servicio por Bizum, con 4 horas para hacerlo. Se descuenta del precio; si cancelas con más de 24 h de antelación, te la devolvemos.");
  });
});
