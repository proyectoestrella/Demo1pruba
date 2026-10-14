import { describe, expect, it } from "bun:test";
import { busquedaConFicha, enlaceDeFicha, fichaDeBusqueda, mismaFicha } from "./ficha-url";

describe("fichas en la URL", () => {
  it("lee ?clienta= y ?cita=", () => {
    expect(fichaDeBusqueda({ clienta: "c-1" })).toEqual({ tipo: "clienta", id: "c-1" });
    expect(fichaDeBusqueda({ cita: "a-9" })).toEqual({ tipo: "cita", id: "a-9" });
    expect(fichaDeBusqueda({})).toBeNull();
    expect(fichaDeBusqueda(undefined)).toBeNull();
    expect(fichaDeBusqueda({ clienta: "  " })).toBeNull();
    expect(fichaDeBusqueda({ cita: 12 })).toEqual({ tipo: "cita", id: "12" });
  });
  it("si llegan las dos, manda la cita", () => {
    expect(fichaDeBusqueda({ clienta: "c-1", cita: "a-2" })).toEqual({ tipo: "cita", id: "a-2" });
  });
  it("abrir una ficha conserva el resto de la URL (demo ?d=, salón ?s=)", () => {
    const base = { d: "abc123", s: "peluchic", dia: "2026-10-14" };
    expect(busquedaConFicha(base, { tipo: "clienta", id: "c-1" })).toEqual({ ...base, clienta: "c-1" });
  });
  it("pasar de cita a clienta deja solo una", () => {
    expect(busquedaConFicha({ cita: "a-1", d: "x" }, { tipo: "clienta", id: "c-2" })).toEqual({ d: "x", clienta: "c-2" });
    expect(busquedaConFicha({ clienta: "c-2" }, { tipo: "cita", id: "a-1" })).toEqual({ cita: "a-1" });
  });
  it("cerrar quita las dos y no toca lo demás", () => {
    expect(busquedaConFicha({ cita: "a-1", clienta: "c-1", d: "x" }, null)).toEqual({ d: "x" });
  });
  it("no muta la búsqueda original", () => {
    const base = { cita: "a-1" };
    busquedaConFicha(base, null);
    expect(base).toEqual({ cita: "a-1" });
  });
  it("enlace compartible", () => {
    expect(enlaceDeFicha("https://sishow.es/app/calendar?d=zz&cita=a-1", { tipo: "clienta", id: "c-7" }))
      .toBe("https://sishow.es/app/calendar?d=zz&clienta=c-7");
    expect(enlaceDeFicha("https://sishow.es/app", { tipo: "cita", id: "a-3" })).toBe("https://sishow.es/app?cita=a-3");
  });
  it("mismaFicha", () => {
    expect(mismaFicha({ tipo: "cita", id: "1" }, { tipo: "cita", id: "1" })).toBe(true);
    expect(mismaFicha({ tipo: "cita", id: "1" }, { tipo: "clienta", id: "1" })).toBe(false);
    expect(mismaFicha(null, null)).toBe(true);
  });
});
