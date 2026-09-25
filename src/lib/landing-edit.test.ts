import { describe, expect, it } from "bun:test";

import {
  borradorDesdePerfil,
  hayCambios,
  perfilDesdeBorrador,
  validarBorrador,
  type BorradorLanding,
} from "./landing-edit";
import { decodeDemoProfile, encodeDemoProfile } from "./demo-profile";
import { faqPorDefecto, faqPublica, parseFaqEntry } from "./faq";
import type { SalonProfile } from "./mock/types";

const PERFIL_BASE: SalonProfile = {
  id: "s1",
  slug: "the-best-shave-barber",
  name: "The Best Shave",
  tagline: "Barbería clásica",
  about: "Cortes y afeitado a navaja desde 2011.",
  address: "Calle Mayor 3, Madrid",
  phone: "612 345 678",
  instagram: "@thebestshave",
  openingHours: [
    "10:00–14:00, 17:00–20:00",
    "10:00–14:00, 17:00–20:00",
    "10:00–14:00, 17:00–20:00",
    "10:00–14:00, 17:00–20:00",
    "10:00–20:00",
    "10:00–14:00",
    "Cerrado",
  ],
  rating: 4.8,
  reviewCount: 214,
  specialties: ["corte clásico", "afeitado a navaja"],
};

function borradorValido(patch: Partial<BorradorLanding> = {}): BorradorLanding {
  return { ...borradorDesdePerfil(PERFIL_BASE), ...patch };
}

describe("borradorDesdePerfil", () => {
  it("convierte el perfil publicado en cajas de texto legibles", () => {
    const b = borradorDesdePerfil({
      ...PERFIL_BASE,
      menu: ["Corte~30~15", "Barba~20~10~Barbería"],
      team: ["Adam~Barbero", "Luis"],
      faq: ["¿Tenéis parking?~Sí, en la misma calle."],
      priorityHours: ["10:00-13:00"],
    });
    expect(b.menu).toBe("Corte | 30 | 15\nBarba | 20 | 10 | Barbería");
    expect(b.team).toBe("Adam | Barbero\nLuis");
    expect(b.faq).toBe("¿Tenéis parking? | Sí, en la misma calle.");
    expect(b.priorityHours).toBe("10:00-13:00");
    expect(b.specialties).toBe("corte clásico, afeitado a navaja");
  });

  it("cae al horario por defecto cuando el perfil no trae siete días", () => {
    const b = borradorDesdePerfil({ ...PERFIL_BASE, openingHours: ["10:00–20:00"] });
    expect(b.openingHours).toHaveLength(7);
  });
});

describe("validarBorrador", () => {
  it("no pone pegas a un borrador correcto", () => {
    expect(validarBorrador(borradorValido())).toEqual([]);
  });

  it("exige el nombre del salón", () => {
    const errores = validarBorrador(borradorValido({ name: "   " }));
    expect(errores.map((e) => e.campo)).toContain("name");
  });

  it("rechaza un teléfono que no es un teléfono", () => {
    const errores = validarBorrador(borradorValido({ phone: "llámanos" }));
    expect(errores).toHaveLength(1);
    expect(errores[0].campo).toBe("phone");
    expect(errores[0].mensaje).toContain("612 345 678");
  });

  it("acepta el teléfono escrito con prefijo y espacios", () => {
    expect(validarBorrador(borradorValido({ phone: "+34 612 34 56 78" }))).toEqual([]);
  });

  it("deja el teléfono vacío pasar: es opcional", () => {
    expect(validarBorrador(borradorValido({ phone: "" }))).toEqual([]);
  });

  it("rechaza un precio negativo y dice qué hacer", () => {
    const errores = validarBorrador(borradorValido({ menu: "Corte | 30 | -5" }));
    expect(errores).toHaveLength(1);
    expect(errores[0].campo).toBe("menu");
    expect(errores[0].mensaje).toContain("no puede ser negativo");
  });

  it("rechaza una duración imposible", () => {
    const errores = validarBorrador(borradorValido({ menu: "Corte | 0 | 15" }));
    expect(errores[0].mensaje).toContain("entre 5 y 240");
  });

  it("rechaza un servicio al que le falta el precio", () => {
    const errores = validarBorrador(borradorValido({ menu: "Corte | 30" }));
    expect(errores[0].mensaje).toContain("Corte | 30 | 15");
  });

  it("acepta un precio con coma decimal", () => {
    expect(validarBorrador(borradorValido({ menu: "Corte | 30 | 13,50" }))).toEqual([]);
  });

  it("rechaza un horario que abre y cierra a la misma hora", () => {
    const horas = [...borradorValido().openingHours];
    horas[0] = "10:00–10:00";
    const errores = validarBorrador(borradorValido({ openingHours: horas }));
    expect(errores[0].campo).toBe("openingHours");
    expect(errores[0].mensaje).toContain("Lunes");
  });

  it("rechaza una hora que no existe", () => {
    const horas = [...borradorValido().openingHours];
    horas[2] = "25:00–30:00";
    const errores = validarBorrador(borradorValido({ openingHours: horas }));
    expect(errores[0].mensaje).toContain("no es una hora real");
  });

  it("acepta «Cerrado» y el cierre pasada medianoche", () => {
    const horas = [...borradorValido().openingHours];
    horas[0] = "Cerrado";
    horas[1] = "22:00–02:00";
    expect(validarBorrador(borradorValido({ openingHours: horas }))).toEqual([]);
  });

  it("rechaza una foto de portada que no es una foto", () => {
    const errores = validarBorrador(borradorValido({ heroImage: "https://ejemplo.com/local" }));
    expect(errores[0].campo).toBe("heroImage");
    expect(errores[0].mensaje).toContain(".jpg");
  });

  it("acepta la foto del proxy propio de siShow (/api/foto?…), la de las demos", () => {
    expect(validarBorrador(borradorValido({ heroImage: "/api/foto?place=ChIJc&i=0" }))).toEqual([]);
  });

  it("rechaza una foto sin http", () => {
    const errores = validarBorrador(borradorValido({ heroImage: "local.jpg" }));
    expect(errores[0].mensaje).toContain("https://");
  });

  it("acepta una foto con parámetros detrás de la extensión", () => {
    expect(
      validarBorrador(borradorValido({ heroImage: "https://ejemplo.com/a.jpg?w=800" })),
    ).toEqual([]);
  });

  it("rechaza una pregunta sin respuesta", () => {
    const errores = validarBorrador(borradorValido({ faq: "¿Tenéis parking?" }));
    expect(errores[0].campo).toBe("faq");
  });

  it("rechaza una franja prioritaria del revés", () => {
    const errores = validarBorrador(borradorValido({ priorityHours: "18:00-10:00" }));
    expect(errores[0].campo).toBe("priorityHours");
  });

  it("avisa cuando hay más servicios de los que caben", () => {
    const menu = Array.from({ length: 13 }, (_, i) => `Servicio ${i} | 30 | 15`).join("\n");
    const errores = validarBorrador(borradorValido({ menu }));
    expect(errores.some((e) => e.mensaje.includes("Ahora hay 13"))).toBe(true);
  });

  it("devuelve TODOS los fallos de una vez, no solo el primero", () => {
    const errores = validarBorrador(
      borradorValido({ name: "", phone: "x", menu: "Corte | 30 | -5" }),
    );
    expect(errores.map((e) => e.campo).sort()).toEqual(["menu", "name", "phone"]);
  });
});

describe("perfilDesdeBorrador", () => {
  it("deja el perfil en forma canónica", () => {
    const p = perfilDesdeBorrador(
      borradorValido({
        name: "  The Best Shave  ",
        menu: "Corte | 30 | 13,5\nBarba | 20 | 10 | Barbería",
        team: "Adam | Barbero",
        faq: "¿Tenéis parking? | Sí, en la misma calle.",
        priorityHours: "10:00-13:00",
        specialties: " corte clásico ,, navaja ",
      }),
    );
    expect(p.name).toBe("The Best Shave");
    expect(p.menu).toEqual(["Corte~30~13.5", "Barba~20~10~Barbería"]);
    expect(p.team).toEqual(["Adam~Barbero"]);
    expect(p.faq).toEqual(["¿Tenéis parking?~Sí, en la misma calle."]);
    expect(p.priorityHours).toEqual(["10:00-13:00"]);
    expect(p.specialties).toEqual(["corte clásico", "navaja"]);
  });

  it("vaciar una caja apaga de verdad esa sección, no deja lo anterior", () => {
    const p = perfilDesdeBorrador(borradorValido({ menu: "", team: "", faq: "" }));
    expect(p.menu).toEqual([]);
    expect(p.team).toEqual([]);
    expect(p.faq).toEqual([]);
  });

  it("normaliza el horario escrito con guion corto", () => {
    const horas = [...borradorValido().openingHours];
    horas[0] = "10:00-14:00";
    horas[6] = "";
    const p = perfilDesdeBorrador(borradorValido({ openingHours: horas }));
    expect(p.openingHours?.[0]).toBe("10:00–14:00");
    expect(p.openingHours?.[6]).toBe("Cerrado");
  });

  it("ida y vuelta: perfil → borrador → perfil no pierde nada", () => {
    const original: SalonProfile = {
      ...PERFIL_BASE,
      menu: ["Corte~30~15", "Barba~20~10~Barbería"],
      team: ["Adam~Barbero", "Luis"],
      faq: ["¿Tenéis parking?~Sí, en la misma calle."],
      priorityHours: ["10:00-13:00"],
      heroImage: "https://ejemplo.com/local.jpg",
    };
    const vuelta = perfilDesdeBorrador(borradorDesdePerfil(original));
    expect(vuelta.menu).toEqual(original.menu);
    expect(vuelta.team).toEqual(original.team);
    expect(vuelta.faq).toEqual(original.faq);
    expect(vuelta.priorityHours).toEqual(original.priorityHours);
    expect(vuelta.openingHours).toEqual(original.openingHours);
    expect(vuelta.name).toBe(original.name);
  });
});

describe("hayCambios", () => {
  it("distingue tocar algo de no tocar nada", () => {
    const a = borradorValido();
    expect(hayCambios(a, borradorDesdePerfil(PERFIL_BASE))).toBe(false);
    expect(hayCambios(a, { ...a, name: "Otro" })).toBe(true);
  });
});

describe("faq en el enlace de la demo", () => {
  it("viaja dentro del ?d= y vuelve igual", () => {
    const faq = ["¿Tenéis parking?~Sí, en la misma calle."];
    const decodificado = decodeDemoProfile(encodeDemoProfile({ name: "X", faq }));
    expect(decodificado?.faq).toEqual(faq);
  });

  it("una pregunta sin respuesta no se cuela en el enlace", () => {
    const decodificado = decodeDemoProfile(
      encodeDemoProfile({ name: "X", faq: ["¿Tenéis parking?"] }),
    );
    expect(decodificado?.faq).toBeUndefined();
  });

  it("un enlace sin faq no trae preguntas propias", () => {
    expect(decodeDemoProfile(encodeDemoProfile({ name: "X" }))?.faq).toBeUndefined();
  });
});

describe("faqPublica", () => {
  it("sin preguntas propias enseña las generadas de siempre", () => {
    expect(faqPublica("barberia", 0, 2, undefined)).toEqual(faqPorDefecto("barberia", 0, 2));
    expect(faqPublica("barberia", 0, 2, [])).toEqual(faqPorDefecto("barberia", 0, 2));
  });

  it("con preguntas propias manda el salón, enteras", () => {
    const propias = faqPublica("barberia", 0, 2, ["¿Tenéis parking?~Sí."]);
    expect(propias).toEqual([{ q: "¿Tenéis parking?", a: "Sí." }]);
  });

  it("descarta las entradas rotas y se queda con las buenas", () => {
    expect(faqPublica("barberia", 0, 2, ["rota", "¿Y esta?~Sí."])).toEqual([
      { q: "¿Y esta?", a: "Sí." },
    ]);
  });

  it("la política de plantón cambia la respuesta generada", () => {
    const conFee = faqPorDefecto("barberia", 7, 3)[0].a;
    expect(conFee).toContain("3 h antes");
    expect(conFee).toContain("penalización");
  });
});

describe("parseFaqEntry", () => {
  it("la respuesta puede llevar «~» dentro sin partirse", () => {
    expect(parseFaqEntry("¿Horario?~De 10 a 14~y de 17 a 20")).toEqual({
      q: "¿Horario?",
      a: "De 10 a 14~y de 17 a 20",
    });
  });

  it("sin pregunta o sin respuesta devuelve null", () => {
    expect(parseFaqEntry("~Sí")).toBeNull();
    expect(parseFaqEntry("¿Y?~")).toBeNull();
    expect(parseFaqEntry("")).toBeNull();
  });
});

describe("logo del salón en el editor", () => {
  const conLogo = (logoUrl: string) => ({ ...borradorDesdePerfil(PERFIL_BASE), logoUrl });
  const erroresLogo = (b: BorradorLanding) => validarBorrador(b).filter((e) => e.campo === "logoUrl");
  it("vacío, un enlace de imagen o un fichero de la demo valen, y se guardan limpios", () => {
    expect(erroresLogo(conLogo(""))).toEqual([]);
    expect(erroresLogo(conLogo("https://misalon.es/logo.svg"))).toEqual([]);
    expect(erroresLogo(conLogo("/demo/peluchic-logo.png"))).toEqual([]);
    expect(perfilDesdeBorrador(conLogo("  https://misalon.es/logo.png ")).logoUrl).toBe("https://misalon.es/logo.png");
  });
  it("rechaza lo que no es un enlace o no es una imagen", () => {
    expect(erroresLogo(conLogo("logo.png"))).toHaveLength(1);
    expect(erroresLogo(conLogo("https://misalon.es/"))).toHaveLength(1);
  });
});
