import { describe, expect, test } from "bun:test";
import { encodeDemoProfile } from "./demo-profile";
import { slugResolvibleDelPanel } from "./slug-panel";

describe("slug que puede resolver el panel", () => {
  test("un ?d= válido no consulta el salón guardado", () => {
    const demoNelva = encodeDemoProfile({
      name: "Nelva Ortiz",
      team: ["Nelva~Estilista", "Natalia~Manicurista"],
      menu: ["Champú + Corte~30~25~Peluquería"],
    });
    expect(
      slugResolvibleDelPanel({
        slugDesdeUrl: undefined,
        demoRaw: demoNelva,
        slugGuardado: "peluchic",
      }),
    ).toBeUndefined();
  });

  test("sin demo conserva los slugs reales y guardados", () => {
    expect(
      slugResolvibleDelPanel({
        slugDesdeUrl: "nelva-real",
        demoRaw: undefined,
        slugGuardado: "peluchic",
      }),
    ).toBe("nelva-real");
    expect(
      slugResolvibleDelPanel({
        slugDesdeUrl: undefined,
        demoRaw: undefined,
        slugGuardado: "peluchic",
      }),
    ).toBe("peluchic");
  });

  test("una demo registrada activa no resuelve el salón real del mismo slug", () => {
    expect(
      slugResolvibleDelPanel({
        slugDesdeUrl: undefined,
        demoRaw: undefined,
        slugGuardado: "peluchic",
        demoRegistradaActiva: true,
      }),
    ).toBeUndefined();
  });
});
