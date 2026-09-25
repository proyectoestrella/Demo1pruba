import { describe, expect, test } from "bun:test";
import { fechaEnZona, horaEnZona } from "../zona-horaria";
import { diaEnZona, horaCorta, minutoEnZona } from "./reloj";

describe("reloj con caché: igual que Intl en cualquier instante", () => {
  const zonas = ["Europe/Madrid", "Atlantic/Canary", "America/Mexico_City", "Asia/Kolkata"];
  // Cubre los cambios de hora de 2026 (29 mar y 25 oct en Europa).
  const inicio = Date.UTC(2026, 2, 28, 20);
  test("día y minuto coinciden con fechaEnZona / horaEnZona", () => {
    for (const tz of zonas) {
      for (let t = inicio; t < inicio + 3 * 86_400_000; t += 7 * 60_000 + 13_000) {
        expect([tz, t, diaEnZona(new Date(t), tz)]).toEqual([tz, t, fechaEnZona(new Date(t), tz)]);
        const [h, m] = horaEnZona(new Date(t), tz).split(":").map(Number);
        expect([tz, t, minutoEnZona(new Date(t), tz)]).toEqual([tz, t, h * 60 + m]);
      }
    }
    const oct = Date.UTC(2026, 9, 25, 0);
    for (let t = oct; t < oct + 4 * 3_600_000; t += 60_000) expect(diaEnZona(new Date(t), "Europe/Madrid")).toBe(fechaEnZona(new Date(t), "Europe/Madrid"));
  });
  test("hora corta sin cero a la izquierda", () => {
    expect(horaCorta("2026-09-25T07:05:00Z", "Europe/Madrid")).toBe("9:05");
  });
});
