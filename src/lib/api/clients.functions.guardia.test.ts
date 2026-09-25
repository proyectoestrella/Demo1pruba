/**
 * La misma vigilancia que `salons.functions.guardia.test.ts`, para el fichero
 * que se quedó fuera de ella: hasta el 25/09/2026 `registerBookingClient`
 * insertaba citas confirmadas en cualquier slug sin comprobar nada.
 */
import { describe, expect, it } from "bun:test";

const FUENTE = await Bun.file(new URL("./clients.functions.ts", import.meta.url)).text();

describe("registerBookingClient no puede tocar un salón real", () => {
  it("lleva el sobre de la sesión y pregunta quién llama", () => {
    expect(FUENTE).toContain(".middleware([conSesion])");
    expect(FUENTE).toContain("acceso(data.salonSlug)");
  });

  it("corta antes de escribir si el slug no es una demo", () => {
    const corte = FUENTE.indexOf('quien.tipo !== "demo"');
    const escritura = FUENTE.indexOf(".insert(");
    expect(corte).toBeGreaterThan(-1);
    expect(corte).toBeLessThan(escritura);
  });

  it("solo escribe en leads_demo, nunca en clients ni appointments", () => {
    expect(FUENTE).toContain('from("leads_demo")');
    expect(FUENTE).not.toContain('from("clients")');
    expect(FUENTE).not.toContain('from("appointments")');
    expect(FUENTE).not.toContain('"confirmed"');
  });
});
