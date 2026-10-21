import { afterEach, beforeEach, describe, expect, test } from "bun:test";
// Instancia propia del módulo: otras pruebas importan la store, que lo usa.
// @ts-expect-error el sufijo ?aislado solo fuerza una instancia nueva en bun
import * as modulo from "./almacen-diferido?aislado";

const { cancelarEscrituraDiferida, crearAlmacenDiferido, volcarEscrituraDiferida } =
  modulo as typeof import("./almacen-diferido");

describe("almacén diferido de la copia local", () => {
  const datos = new Map<string, string>();
  const antes = (globalThis as { window?: unknown }).window;
  const antesDoc = (globalThis as { document?: unknown }).document;

  beforeEach(() => {
    datos.clear();
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {
      localStorage: {
        getItem: (k: string) => datos.get(k) ?? null,
        setItem: (k: string, v: string) => void datos.set(k, v),
        removeItem: (k: string) => void datos.delete(k),
      },
      addEventListener: () => {},
    } });
    (globalThis as Record<string, unknown>).document = { addEventListener: () => {}, visibilityState: "visible" };
  });
  afterEach(() => {
    cancelarEscrituraDiferida();
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: antes });
    (globalThis as Record<string, unknown>).document = antesDoc;
  });

  test("no escribe al instante, pero las lecturas ya ven lo último", () => {
    const a = crearAlmacenDiferido<{ n: number }>();
    a.setItem("k", { state: { n: 1 }, version: 1 });
    expect(datos.has("k")).toBe(false);
    expect((a.getItem("k") as { state: { n: number } }).state.n).toBe(1);
  });

  test("al volcar escribe una sola vez el último estado", () => {
    const a = crearAlmacenDiferido<{ n: number }>();
    a.setItem("k", { state: { n: 1 }, version: 1 });
    a.setItem("k", { state: { n: 2 }, version: 1 });
    volcarEscrituraDiferida();
    expect(JSON.parse(datos.get("k")!).state.n).toBe(2);
  });

  test("cancelar (cierre de sesión) impide que lo pendiente resucite", () => {
    const a = crearAlmacenDiferido<{ n: number }>();
    a.setItem("k", { state: { n: 1 }, version: 1 });
    cancelarEscrituraDiferida();
    volcarEscrituraDiferida();
    expect(datos.has("k")).toBe(false);
  });

  test("removeItem borra también lo pendiente", () => {
    const a = crearAlmacenDiferido<{ n: number }>();
    a.setItem("k", { state: { n: 1 }, version: 1 });
    a.removeItem("k");
    volcarEscrituraDiferida();
    expect(datos.has("k")).toBe(false);
  });

  test("respeta puedeEscribir (web oficial no deja datos)", () => {
    const a = crearAlmacenDiferido<{ n: number }>({ puedeEscribir: () => false });
    a.setItem("k", { state: { n: 1 }, version: 1 });
    volcarEscrituraDiferida();
    expect(datos.has("k")).toBe(false);
  });
});
