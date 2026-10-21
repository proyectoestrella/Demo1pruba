import { describe, expect, it } from "bun:test";
import { validarTelefono, normalizarTelefonoSiValido } from "./telefono";
import { phoneKey } from "./salon-rows";

describe("validarTelefono: rechaza lo que no es un teléfono", () => {
  for (const malo of ["1245", "12345678", "abcdefghi", "6123abc78", ""]) {
    it(`rechaza «${malo}»`, () => expect(validarTelefono(malo, "ES").ok).toBe(false));
  }
  it("el mensaje para España dice cuántas cifras son", () => {
    const r = validarTelefono("1245", "ES");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Ese teléfono no parece válido para España: son 9 cifras.");
  });
});

describe("validarTelefono: acepta y normaliza a E.164", () => {
  const casos: [string, string, string][] = [
    ["612345678", "ES", "+34612345678"],
    ["+34 612 34 56 78", "ES", "+34612345678"],
    ["912345678", "ES", "+34912345678"],
    ["+33 6 12 34 56 78", "ES", "+33612345678"],
    ["0033 6 12 34 56 78", "OTRO", "+33612345678"],
    ["06 12 34 56 78", "FR", "+33612345678"],
  ];
  for (const [raw, pais, e164] of casos) {
    it(`${raw} (${pais}) → ${e164}`, () => expect(validarTelefono(raw, pais)).toEqual({ ok: true, e164 }));
  }
});

describe("phone_key no cambia con el formato nuevo", () => {
  it("una ficha antigua «600 111 222» casa con el E.164 «+34600111222»", () => {
    const nuevo = validarTelefono("600111222", "ES");
    expect(nuevo.ok).toBe(true);
    if (nuevo.ok) expect(phoneKey(nuevo.e164)).toBe(phoneKey("600 111 222"));
  });
  it("normalizarTelefonoSiValido deja tal cual lo que no valida (datos del panel)", () => {
    expect(normalizarTelefonoSiValido("1245")).toBe("1245");
    expect(normalizarTelefonoSiValido("600 111 222")).toBe("+34600111222");
  });
});
