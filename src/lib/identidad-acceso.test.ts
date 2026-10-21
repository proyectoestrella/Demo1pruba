import { describe, expect, it } from "bun:test";
import { salon } from "./mock/salon";
import {
  manifestDelAcceso,
  perfilInicialDeAcceso,
  slugDeAcceso,
  terminoProfesionalDeAcceso,
  volverAlSitio,
} from "./identidad-acceso";

describe("identidad de las pantallas de acceso", () => {
  it("resuelve primero ?s= y no hereda el salón demo guardado", () => {
    expect(
      slugDeAcceso({ slugDesdeUrl: "peluchic", hostname: "127.0.0.1", slugGuardado: salon.slug }),
    ).toBe("peluchic");
    const perfil = perfilInicialDeAcceso("peluchic", salon);
    expect(perfil).toMatchObject({ name: "PeluChic", logoUrl: "/demo/peluchic-logo.png" });
    expect(terminoProfesionalDeAcceso(perfil)).toBe("profesional");
  });

  it("resuelve cualquier subdominio de salón", () => {
    expect(
      slugDeAcceso({
        slugDesdeUrl: undefined,
        hostname: "peluchic.sishow.es",
        slugGuardado: salon.slug,
      }),
    ).toBe("peluchic");
    expect(
      slugDeAcceso({
        slugDesdeUrl: undefined,
        hostname: "otro.localhost",
        slugGuardado: salon.slug,
      }),
    ).toBe("otro");
  });

  it("respeta un término profesional propio y nunca infiere barbero", () => {
    expect(terminoProfesionalDeAcceso({ terminoProfesional: " Terapeuta " })).toBe("terapeuta");
    expect(terminoProfesionalDeAcceso({})).toBe("profesional");
  });

  it("vuelve a la ruta pública o a la raíz del subdominio propio", () => {
    expect(volverAlSitio("peluchic", "127.0.0.1")).toBe("/s/peluchic");
    expect(volverAlSitio("peluchic", "peluchic.sishow.es")).toBe("/");
    expect(volverAlSitio("otro", "peluchic.sishow.es")).toBe("/s/otro");
  });

  it("elige la instalación de PeluChic desde el slug resuelto", () => {
    expect(manifestDelAcceso("peluchic")).toBe("/manifest-peluchic.webmanifest");
    expect(manifestDelAcceso("otro")).toBe("/manifest-panel.webmanifest");
  });
});
