import { describe, expect, it } from "bun:test";
import { getConfigCalendarios, urlPublicaDelSitio } from "./config.server";

describe("urlPublicaDelSitio (dirección pública para el aviso push de Google)", () => {
  it("SITE_URL manda sobre las de Vercel", () => {
    expect(
      urlPublicaDelSitio({
        SITE_URL: "https://sishow.es",
        VERCEL_PROJECT_PRODUCTION_URL: "prueba28juliokt.vercel.app",
        VERCEL_URL: "prueba28juliokt-abc123-estrellavercel-s-projects.vercel.app",
      }),
    ).toBe("https://sishow.es");
  });

  it("sin SITE_URL, el dominio de producción del proyecto; nunca la URL única del despliegue si hay otra", () => {
    expect(
      urlPublicaDelSitio({
        VERCEL_PROJECT_PRODUCTION_URL: "sishow.es",
        VERCEL_URL: "prueba28juliokt-abc123-estrellavercel-s-projects.vercel.app",
      }),
    ).toBe("https://sishow.es");
  });

  it("VERCEL_URL solo como último recurso", () => {
    expect(urlPublicaDelSitio({ VERCEL_URL: "prueba28juliokt-abc123.vercel.app" })).toBe("https://prueba28juliokt-abc123.vercel.app");
  });

  it("normaliza protocolo, espacios y barra final; vacío cuenta como ausente", () => {
    expect(urlPublicaDelSitio({ SITE_URL: " sishow.es/ " })).toBe("https://sishow.es");
    expect(urlPublicaDelSitio({ SITE_URL: "http://localhost:8083/" })).toBe("http://localhost:8083");
    expect(urlPublicaDelSitio({ SITE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "sishow.es" })).toBe("https://sishow.es");
    expect(urlPublicaDelSitio({})).toBeUndefined();
  });

  it("getConfigCalendarios().siteUrl sale de ahí y construye el webhook en el dominio público", () => {
    const antes = { SITE_URL: process.env.SITE_URL, VERCEL_URL: process.env.VERCEL_URL };
    process.env.SITE_URL = "https://sishow.es";
    process.env.VERCEL_URL = "prueba28juliokt-abc123.vercel.app";
    try {
      const { siteUrl } = getConfigCalendarios();
      expect(`${siteUrl}/api/calendario-externo/google/webhook`).toBe("https://sishow.es/api/calendario-externo/google/webhook");
    } finally {
      for (const [k, v] of Object.entries(antes)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
