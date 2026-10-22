import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { CAMPOS_PERFIL_SIN_REGISTRO } from "./registro-cambios";
import { hasSeenTour, markTourSeen } from "./tour";

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let valores: Map<string, string>;

beforeEach(() => {
  valores = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (clave: string) => valores.get(clave) ?? null,
      setItem: (clave: string, valor: string) => valores.set(clave, valor),
    },
  });
});

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("visita guiada del panel", () => {
  it("acepta como vista tanto la marca local como la del perfil remoto", () => {
    expect(hasSeenTour()).toBe(false);
    valores.set("trimly-tour-visto", "1");
    expect(hasSeenTour()).toBe(true);
    valores.clear();
    expect(hasSeenTour(true)).toBe(true);
  });

  it("al cerrarla guarda en el dispositivo y avisa para persistir en servidor", () => {
    let avisos = 0;
    markTourSeen(() => { avisos += 1; });
    expect(valores.get("trimly-tour-visto")).toBe("1");
    expect(avisos).toBe(1);
  });

  it("la preferencia interna no ensucia el historial de cambios", () => {
    expect(CAMPOS_PERFIL_SIN_REGISTRO.has("tourPanelVisto")).toBe(true);
  });
});
