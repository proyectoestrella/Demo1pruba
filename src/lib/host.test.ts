import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOMINIO_POR_DEFECTO,
  SUBDOMINIOS_RESERVADOS,
  SUBRUTAS_SALON,
  dominioRaiz,
  normalizarHostname,
  redireccionWww,
  reescrituraPorDominio,
  resolverHost,
  rutaInternaDeSalon,
  rutaPublicaDeSalon,
  slugAdmiteSubdominio,
  subdominioDeSalon,
} from "./host";

describe("normalizarHostname", () => {
  it("pasa a minúsculas, quita espacios, puerto y punto final", () => {
    expect(normalizarHostname("  PeluChic.SiShow.ES:443 ")).toBe("peluchic.sishow.es");
    expect(normalizarHostname("sishow.es.")).toBe("sishow.es");
    expect(normalizarHostname("peluchic.localhost:8083")).toBe("peluchic.localhost");
    expect(normalizarHostname("")).toBe("");
  });

  it("deja las IPv6 entre corchetes como están", () => {
    expect(normalizarHostname("[::1]:8083")).toBe("[::1]:8083");
  });
});

describe("dominioRaiz", () => {
  it("sin VITE_SISHOW_DOMINIO es sishow.es", () => {
    const antes = process.env.VITE_SISHOW_DOMINIO;
    delete process.env.VITE_SISHOW_DOMINIO;
    try {
      expect(dominioRaiz()).toBe(DOMINIO_POR_DEFECTO);
      expect(DOMINIO_POR_DEFECTO).toBe("sishow.es");
    } finally {
      if (antes !== undefined) process.env.VITE_SISHOW_DOMINIO = antes;
    }
  });

  it("con VITE_SISHOW_DOMINIO usa esa raíz, normalizada", () => {
    const antes = process.env.VITE_SISHOW_DOMINIO;
    process.env.VITE_SISHOW_DOMINIO = " Pruebas.SiShow.dev ";
    try {
      expect(dominioRaiz()).toBe("pruebas.sishow.dev");
      expect(resolverHost("peluchic.pruebas.sishow.dev")).toEqual({ tipo: "salon", slug: "peluchic" });
      expect(resolverHost("peluchic.sishow.es")).toEqual({ tipo: "otro" });
    } finally {
      if (antes === undefined) delete process.env.VITE_SISHOW_DOMINIO;
      else process.env.VITE_SISHOW_DOMINIO = antes;
    }
  });
});

describe("resolverHost", () => {
  const D = "sishow.es";

  it("la raíz y www son la web oficial", () => {
    expect(resolverHost("sishow.es", D)).toEqual({ tipo: "oficial" });
    expect(resolverHost("SISHOW.ES", D)).toEqual({ tipo: "oficial" });
    expect(resolverHost("sishow.es:443", D)).toEqual({ tipo: "oficial" });
    expect(resolverHost("www.sishow.es", D)).toEqual({ tipo: "oficial" });
  });

  it("un subdominio de una etiqueta es la web de ese salón", () => {
    expect(resolverHost("peluchic.sishow.es", D)).toEqual({ tipo: "salon", slug: "peluchic" });
    expect(resolverHost("PeluChic.SiShow.es:443", D)).toEqual({ tipo: "salon", slug: "peluchic" });
    expect(resolverHost("peluchic.sishow.es.", D)).toEqual({ tipo: "salon", slug: "peluchic" });
    expect(resolverHost("barber-hamza-for-men.sishow.es", D)).toEqual({
      tipo: "salon",
      slug: "barber-hamza-for-men",
    });
    expect(resolverHost("3k-peluqueros.sishow.es", D)).toEqual({ tipo: "salon", slug: "3k-peluqueros" });
  });

  it("los subdominios reservados no son salones", () => {
    for (const sub of ["app", "api", "admin", "demo", "mail", "correo", "blog", "send", "status"]) {
      expect(SUBDOMINIOS_RESERVADOS.has(sub)).toBe(true);
      expect(resolverHost(`${sub}.sishow.es`, D)).toEqual({ tipo: "otro" });
    }
  });

  it("más de un nivel o etiquetas inválidas no son salones", () => {
    expect(resolverHost("a.peluchic.sishow.es", D)).toEqual({ tipo: "otro" });
    expect(resolverHost("www.peluchic.sishow.es", D)).toEqual({ tipo: "otro" });
    expect(resolverHost("-peluchic.sishow.es", D)).toEqual({ tipo: "otro" });
    expect(resolverHost("peluchic-.sishow.es", D)).toEqual({ tipo: "otro" });
    expect(resolverHost("pelu_chic.sishow.es", D)).toEqual({ tipo: "otro" });
    expect(resolverHost(`${"a".repeat(64)}.sishow.es`, D)).toEqual({ tipo: "otro" });
    expect(resolverHost(`${"a".repeat(63)}.sishow.es`, D).tipo).toBe("salon");
  });

  it("un dominio que solo termina igual no cuela", () => {
    expect(resolverHost("peluchicsishow.es", D)).toEqual({ tipo: "otro" });
    expect(resolverHost("peluchic.nosishow.es", D)).toEqual({ tipo: "otro" });
    expect(resolverHost("sishow.es.evil.com", D)).toEqual({ tipo: "otro" });
  });

  it("vercel.app, IPs y dominios ajenos se quedan como están", () => {
    expect(resolverHost("prueba28juliokt.vercel.app", D)).toEqual({ tipo: "otro" });
    expect(resolverHost("prueba28juliokt-git-main-estrellavercel-s-projects.vercel.app", D)).toEqual({
      tipo: "otro",
    });
    expect(resolverHost("127.0.0.1:8083", D)).toEqual({ tipo: "otro" });
    expect(resolverHost("[::1]:8083", D)).toEqual({ tipo: "otro" });
    expect(resolverHost("example.com", D)).toEqual({ tipo: "otro" });
    expect(resolverHost("", D)).toEqual({ tipo: "otro" });
  });

  it("en local, localhost hace de raíz para probar subdominios", () => {
    expect(resolverHost("localhost", D)).toEqual({ tipo: "oficial" });
    expect(resolverHost("localhost:8083", D)).toEqual({ tipo: "oficial" });
    expect(resolverHost("peluchic.localhost:8083", D)).toEqual({ tipo: "salon", slug: "peluchic" });
    expect(resolverHost("app.localhost:8083", D)).toEqual({ tipo: "otro" });
    expect(resolverHost("www.localhost:8083", D)).toEqual({ tipo: "otro" });
  });
});

describe("slugAdmiteSubdominio y subdominioDeSalon", () => {
  it("acepta slugs que son etiquetas DNS válidas y no reservadas", () => {
    expect(slugAdmiteSubdominio("peluchic")).toBe(true);
    expect(slugAdmiteSubdominio("PeluChic")).toBe(true);
    expect(slugAdmiteSubdominio("www")).toBe(false);
    expect(slugAdmiteSubdominio("pelu chic")).toBe(false);
    expect(slugAdmiteSubdominio("pelu.chic")).toBe(false);
    expect(slugAdmiteSubdominio("")).toBe(false);
  });

  it("construye el subdominio completo", () => {
    expect(subdominioDeSalon("peluchic", "sishow.es")).toBe("peluchic.sishow.es");
    expect(subdominioDeSalon(" PeluChic ", "sishow.es")).toBe("peluchic.sishow.es");
    expect(subdominioDeSalon("api", "sishow.es")).toBeNull();
  });
});

describe("redireccionWww", () => {
  it("www.sishow.es va a https://sishow.es con la misma ruta, búsqueda y ancla", () => {
    expect(redireccionWww(new URL("http://www.sishow.es/"), "sishow.es")).toBe("https://sishow.es/");
    expect(redireccionWww(new URL("https://WWW.sishow.es:443/precios?x=1#faq"), "sishow.es")).toBe(
      "https://sishow.es/precios?x=1#faq",
    );
  });

  it("el resto de hosts no se redirige", () => {
    for (const u of [
      "https://sishow.es/",
      "https://peluchic.sishow.es/",
      "https://prueba28juliokt.vercel.app/",
      "http://localhost:8083/",
      "http://www.localhost:8083/",
      "https://www.peluchic.sishow.es/",
    ]) {
      expect(redireccionWww(new URL(u), "sishow.es")).toBeNull();
    }
  });
});

describe("rutaInternaDeSalon (subdominio → router)", () => {
  it("la raíz es la portada del salón", () => {
    expect(rutaInternaDeSalon("/", "peluchic")).toBe("/s/peluchic");
    expect(rutaInternaDeSalon("", "peluchic")).toBe("/s/peluchic");
  });

  it("las subrutas del salón cuelgan de la raíz", () => {
    expect(rutaInternaDeSalon("/book", "peluchic")).toBe("/s/peluchic/book");
    expect(rutaInternaDeSalon("/book/", "peluchic")).toBe("/s/peluchic/book/");
    expect(rutaInternaDeSalon("/confirmation", "peluchic")).toBe("/s/peluchic/confirmation");
    expect(rutaInternaDeSalon("/dosier", "peluchic")).toBe("/s/peluchic/dosier");
    expect(rutaInternaDeSalon("/privacidad", "peluchic")).toBe("/s/peluchic/privacidad");
  });

  it("nunca reescribe el panel, la API, los ficheros ni las rutas internas", () => {
    for (const p of [
      "/app",
      "/app/calendar",
      "/api/recordatorios",
      "/api/calendario-externo/google/callback",
      "/aceptar",
      "/demo",
      "/demo/peluchic-logo.png",
      "/assets/index-abc.js",
      "/_serverFn/abc",
      "/_build/x.js",
      "/login",
      "/dashboard",
      "/rutero",
      "/manifest.webmanifest",
      "/favicon.ico",
      "/robots.txt",
      "/s/peluchic",
      "/s/peluchic/book",
      "/s/otro-salon",
      "/booking",
      "/bookings/1",
    ]) {
      expect(rutaInternaDeSalon(p, "peluchic")).toBeNull();
    }
  });
});

describe("rutaPublicaDeSalon (router → enlace en el subdominio)", () => {
  it("quita el prefijo del propio salón", () => {
    expect(rutaPublicaDeSalon("/s/peluchic", "peluchic")).toBe("/");
    expect(rutaPublicaDeSalon("/s/peluchic/", "peluchic")).toBe("/");
    expect(rutaPublicaDeSalon("/s/peluchic/book", "peluchic")).toBe("/book");
    expect(rutaPublicaDeSalon("/s/peluchic/confirmation", "peluchic")).toBe("/confirmation");
    expect(rutaPublicaDeSalon("/s/peluchic/privacidad", "peluchic")).toBe("/privacidad");
  });

  it("deja como están otro salón, prefijos parecidos, subrutas desconocidas y el resto", () => {
    expect(rutaPublicaDeSalon("/s/otro", "peluchic")).toBeNull();
    expect(rutaPublicaDeSalon("/s/peluchic-2/book", "peluchic")).toBeNull();
    expect(rutaPublicaDeSalon("/s/peluchic/galeria", "peluchic")).toBeNull();
    expect(rutaPublicaDeSalon("/app", "peluchic")).toBeNull();
    expect(rutaPublicaDeSalon("/login", "peluchic")).toBeNull();
    expect(rutaPublicaDeSalon("/", "peluchic")).toBeNull();
  });

  it("ida y vuelta: lo público vuelve a sí mismo", () => {
    for (const p of ["/", "/book", "/confirmation", "/dosier", "/privacidad"]) {
      const interna = rutaInternaDeSalon(p, "peluchic");
      expect(interna).not.toBeNull();
      expect(rutaPublicaDeSalon(interna as string, "peluchic")).toBe(p);
    }
  });
});

describe("SUBRUTAS_SALON y los ficheros de rutas", () => {
  const dirRutas = join(dirname(fileURLToPath(import.meta.url)), "..", "routes");
  const ficheros = readdirSync(dirRutas);

  it("coincide con src/routes/s.$salonSlug.<subruta>.tsx", () => {
    const subrutas = ficheros
      .map((f) => /^s\.\$salonSlug\.([a-z0-9-]+)\.tsx$/.exec(f)?.[1])
      .filter((x): x is string => !!x && x !== "index");
    expect([...subrutas].sort()).toEqual([...SUBRUTAS_SALON].sort());
  });

  it("ninguna subruta choca con una ruta de primer nivel", () => {
    const primerNivel = new Set(
      ficheros
        .filter((f) => !f.startsWith("s.") && !f.startsWith("__") && /\.tsx?$/.test(f))
        .map((f) => f.split(".")[0]),
    );
    for (const sub of SUBRUTAS_SALON) expect(primerNivel.has(sub)).toBe(false);
  });
});

describe("reescrituraPorDominio (par rewrite del router)", () => {
  const rw = reescrituraPorDominio("sishow.es");
  const entrada = (u: string) => rw.input({ url: new URL(u) })?.href ?? null;
  const salida = (u: string) => rw.output({ url: new URL(u) })?.href ?? null;

  it("en el subdominio de un salón traduce en los dos sentidos y conserva ?d= y el ancla", () => {
    expect(entrada("https://peluchic.sishow.es/?d=abc#carta")).toBe("https://peluchic.sishow.es/s/peluchic?d=abc#carta");
    expect(entrada("https://peluchic.sishow.es/book?d=abc&service=tinte")).toBe(
      "https://peluchic.sishow.es/s/peluchic/book?d=abc&service=tinte",
    );
    expect(salida("https://peluchic.sishow.es/s/peluchic/book?d=abc")).toBe("https://peluchic.sishow.es/book?d=abc");
    expect(salida("https://peluchic.sishow.es/s/peluchic?d=abc")).toBe("https://peluchic.sishow.es/?d=abc");
    expect(entrada("http://peluchic.localhost:8083/book")).toBe("http://peluchic.localhost:8083/s/peluchic/book");
  });

  it("en el subdominio no toca /app, /api ni /_serverFn", () => {
    expect(entrada("https://peluchic.sishow.es/app")).toBeNull();
    expect(entrada("https://peluchic.sishow.es/api/recordatorios")).toBeNull();
    expect(entrada("https://peluchic.sishow.es/_serverFn/x")).toBeNull();
    expect(salida("https://peluchic.sishow.es/app/calendar")).toBeNull();
  });

  it("en sishow.es, www, vercel.app y localhost no hace nada", () => {
    for (const u of [
      "https://sishow.es/",
      "https://sishow.es/s/peluchic/book",
      "https://www.sishow.es/s/peluchic",
      "https://prueba28juliokt.vercel.app/s/peluchic?d=abc",
      "http://localhost:8083/s/peluchic",
      "https://api.sishow.es/",
    ]) {
      expect(entrada(u)).toBeNull();
      expect(salida(u)).toBeNull();
    }
  });
});
