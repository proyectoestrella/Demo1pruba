import { describe, expect, test } from "bun:test";
import { accionPorEnlace } from "./precedencia-enlace-panel";
import { useSalonStore } from "./store";
import { aplicarPrecedenciaDeEnlace } from "./precedencia-enlace-panel-store";

describe("precedencia del enlace del panel", () => {
  test("?d= manda siempre sobre lo guardado", () => {
    expect(accionPorEnlace({ d: "abc", s: "peluchic", slugGuardado: "kireya" })).toBe("aplicar-demo");
  });
  test("?s= distinto del guardado descarta la demo anterior", () => {
    expect(accionPorEnlace({ s: "peluchic", slugGuardado: "kireya" })).toBe("reiniciar-al-salon");
  });
  test("?s= igual al guardado, o sin parámetros, mantiene lo guardado", () => {
    expect(accionPorEnlace({ s: "kireya", slugGuardado: "kireya" })).toBe("mantener");
    expect(accionPorEnlace({ slugGuardado: "kireya" })).toBe("mantener");
  });
  test("con una demo anterior guardada, s=peluchic deja el perfil de peluchic", () => {
    useSalonStore.getState().updateSalonProfile({ slug: "kireya", name: "Kireya" });
    aplicarPrecedenciaDeEnlace({ s: "peluchic" });
    const p = useSalonStore.getState().salonProfile;
    expect(p.slug).toBe("peluchic");
    expect(p.name).not.toBe("Kireya");
  });
});
