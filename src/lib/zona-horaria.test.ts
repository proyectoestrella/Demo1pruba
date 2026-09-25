import { describe, expect, it } from "bun:test";
import { fechaEnZona, horaEnZona, isoDelSalon, momentoLocal, zonaDelSalon } from "./zona-horaria";

describe("agenda del salón ↔ instantes ISO", () => {
  it("las 10:00 de Madrid en verano son las 08:00Z, y en invierno las 09:00Z", () => {
    expect(isoDelSalon("2026-09-28", "10:00")).toBe("2026-09-28T08:00:00.000Z");
    expect(isoDelSalon("2027-01-11", "10:00")).toBe("2027-01-11T09:00:00.000Z");
  });

  it("ida y vuelta exacta, también el día del cambio de hora", () => {
    for (const [f, h] of [["2026-10-25", "09:30"], ["2026-10-25", "17:00"], ["2026-03-29", "10:00"], ["2026-06-15", "20:30"]]) {
      const iso = isoDelSalon(f, h);
      expect(fechaEnZona(iso)).toBe(f);
      expect(horaEnZona(iso)).toBe(h);
    }
  });

  it("momentoLocal devuelve el día de la semana y el minuto en Madrid", () => {
    expect(momentoLocal("2026-09-28T08:00:00.000Z")).toEqual({ weekday: 1, minuto: 600 });
    expect(momentoLocal("2026-09-26T22:30:00.000Z")).toEqual({ weekday: 0, minuto: 30 });
  });

  it("no depende de la zona horaria del proceso", () => {
    // El preload fija TZ=Europe/Madrid; con otra zona el resultado es el mismo
    // porque todo pasa por Intl con la zona explícita.
    expect(isoDelSalon("2026-09-28", "10:00", "UTC")).toBe("2026-09-28T10:00:00.000Z");
    expect(isoDelSalon("2026-09-28", "10:00", "America/New_York")).toBe("2026-09-28T14:00:00.000Z");
  });
});

describe("zonaDelSalon", () => {
  it("usa la del perfil si es válida y Madrid si falta o es inválida", () => {
    expect(zonaDelSalon({ timeZone: "Atlantic/Canary" })).toBe("Atlantic/Canary");
    expect(zonaDelSalon({})).toBe("Europe/Madrid");
    expect(zonaDelSalon({ timeZone: "Marte/Olympus" })).toBe("Europe/Madrid");
    expect(zonaDelSalon(null)).toBe("Europe/Madrid");
  });
});
