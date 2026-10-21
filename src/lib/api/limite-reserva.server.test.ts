import { describe, expect, it } from "bun:test";
import { admiteIntentoReserva, ipDeCabeceras } from "./limite-reserva.server";

describe("límite de reserva pública por IP", () => {
  it("prefiere la cabecera del proxy de Vercel y el último salto", () => {
    const h = (nombre: string) => ({
      "x-vercel-forwarded-for": "198.51.100.7, 203.0.113.9",
      "x-forwarded-for": "192.0.2.3",
    })[nombre];
    expect(ipDeCabeceras(h)).toBe("203.0.113.9");
  });

  it("corta el intento 13 en diez minutos y reabre al vencer la ventana", () => {
    const slug = `salon-${crypto.randomUUID()}`;
    for (let i = 0; i < 12; i++) expect(admiteIntentoReserva(slug, "203.0.113.20", 1_000)).toBe(true);
    expect(admiteIntentoReserva(slug, "203.0.113.20", 1_001)).toBe(false);
    expect(admiteIntentoReserva(slug, "203.0.113.20", 1_000 + 10 * 60_000)).toBe(true);
  });

  it("separa salones e IP y no bloquea si el proxy no aporta IP", () => {
    const slug = `salon-${crypto.randomUUID()}`;
    for (let i = 0; i < 12; i++) admiteIntentoReserva(slug, "203.0.113.30", 2_000);
    expect(admiteIntentoReserva(`${slug}-otro`, "203.0.113.30", 2_000)).toBe(true);
    expect(admiteIntentoReserva(slug, "203.0.113.31", 2_000)).toBe(true);
    expect(admiteIntentoReserva(slug, null, 2_000)).toBe(true);
  });
});

