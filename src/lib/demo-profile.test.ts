import { describe, expect, it } from "bun:test";
import {
  blankDemoProfile,
  decodeDemoProfile,
  demoUrl,
  encodeDemoProfile,
  parseGoogleMapsPaste,
  slugify,
} from "./demo-profile";

describe("encode / decode", () => {
  it("devuelve el perfil intacto tras el viaje por la URL", () => {
    const profile = {
      name: "Peluquería Los Ángeles",
      tagline: "Peluquería y estética",
      about: "Peluquería de barrio en Alcalá desde 1998.",
      address: "Calle Mayor 14, Alcalá de Henares",
      phone: "+34 918 123 456",
      instagram: "@pelulosangeles",
      rating: 4.6,
      reviewCount: 87,
      specialties: ["color", "mechas", "recogidos"],
    };
    expect(decodeDemoProfile(encodeDemoProfile(profile))).toEqual(profile);
  });

  it("lleva la foto de portada dentro del enlace", () => {
    const url = "https://ejemplo.test/fotos/local.jpg";
    const encoded = encodeDemoProfile({ name: "Barbería Sur", heroImage: url });
    expect(decodeDemoProfile(encoded)?.heroImage).toBe(url);
  });

  it("omite la foto cuando está vacía", () => {
    const encoded = encodeDemoProfile({ name: "Barbería Sur", heroImage: "" });
    expect(decodeDemoProfile(encoded)).toEqual({ name: "Barbería Sur" });
  });

  it("conserva acentos y eñes", () => {
    const encoded = encodeDemoProfile({ name: "Peluquería Señor Muñoz" });
    expect(decodeDemoProfile(encoded)?.name).toBe("Peluquería Señor Muñoz");
  });

  it("omite los campos vacíos para acortar el enlace", () => {
    const solo = encodeDemoProfile({ name: "Solo el nombre" });
    const todo = encodeDemoProfile({
      name: "Solo el nombre",
      about: "Un texto de presentación bastante largo que ocupa lo suyo.",
      address: "Calle Mayor 14",
    });
    expect(solo.length).toBeLessThan(todo.length);
    expect(decodeDemoProfile(solo)).toEqual({ name: "Solo el nombre" });
  });

  it("produce un enlace manejable para un salón completo", () => {
    const encoded = encodeDemoProfile({
      name: "Peluquería Los Ángeles",
      tagline: "Peluquería y estética",
      address: "Calle Mayor 14, Alcalá de Henares",
      phone: "+34 918 123 456",
      rating: 4.6,
      reviewCount: 87,
      specialties: ["color", "mechas"],
    });
    // Si el blob se dispara, el enlace deja de ser presentable en un chat.
    expect(encoded.length).toBeLessThan(400);
  });
});

describe("equipo real (\"e\") y carta real (\"m\")", () => {
  it("viajan y vuelven intactos por la URL", () => {
    const profile = {
      name: "The Best Shave & Barber",
      team: ["Adam~Cortes y afeitado clásico"],
      menu: ["Corte~30~13", "Corte + barba~45~18", "Arreglo de barba~20~8"],
    };
    expect(decodeDemoProfile(encodeDemoProfile(profile))).toEqual(profile);
  });

  it("acepta un nombre de equipo sin especialidad", () => {
    const encoded = encodeDemoProfile({ name: "Bar", team: ["Adam"] });
    expect(decodeDemoProfile(encoded)?.team).toEqual(["Adam"]);
  });

  it("corta el equipo a 3 entradas", () => {
    const encoded = encodeDemoProfile({
      name: "Bar",
      team: ["Adam", "Bruno", "Carlos", "Diego"],
    });
    expect(decodeDemoProfile(encoded)?.team).toEqual(["Adam", "Bruno", "Carlos"]);
  });

  it("corta la carta a 12 entradas", () => {
    const catorce = Array.from({ length: 14 }, (_, i) => `Servicio ${i}~30~10`);
    const encoded = encodeDemoProfile({ name: "Bar", menu: catorce });
    expect(decodeDemoProfile(encoded)?.menu?.length).toBe(12);
  });

  it("descarta en silencio una entrada de carta con minutos o precio inválidos", () => {
    const encoded = btoa(
      JSON.stringify({
        n: "Bar",
        m: ["Corte~30~13", "Rapado~3~5", "Tinte~30~-4", "Peinado~40~20"],
      }),
    );
    expect(decodeDemoProfile(encoded)?.menu).toEqual(["Corte~30~13", "Peinado~40~20"]);
  });

  it("descarta en silencio una entrada de equipo sin nombre", () => {
    const encoded = btoa(JSON.stringify({ n: "Bar", e: ["Adam", "~Sin nombre", "Bruno"] }));
    expect(decodeDemoProfile(encoded)?.team).toEqual(["Adam", "Bruno"]);
  });

  it("sin \"e\" ni \"m\" no aparecen en el perfil decodificado", () => {
    const encoded = encodeDemoProfile({ name: "Bar" });
    const out = decodeDemoProfile(encoded);
    expect(out?.team).toBeUndefined();
    expect(out?.menu).toBeUndefined();
  });
});

describe("política de plantón (\"q\"/\"w\") y reparto de agenda (\"k\"/\"u\")", () => {
  it("viajan y vuelven intactas por la URL", () => {
    const profile = {
      name: "The Best Shave & Barber",
      noShowFeeEur: 7,
      noShowNoticeHours: 2,
    };
    expect(decodeDemoProfile(encodeDemoProfile(profile))).toEqual(profile);
  });

  it("k y u viajan igual, independientes de q/w", () => {
    const profile = { name: "Cardedal", smartSpread: true, lastSlotBufferMin: 90 };
    expect(decodeDemoProfile(encodeDemoProfile(profile))).toEqual(profile);
  });

  it("0 o ausente en la penalización no ocupa sitio en el enlace", () => {
    const encoded = encodeDemoProfile({ name: "Bar", noShowFeeEur: 0 });
    const out = decodeDemoProfile(encoded);
    expect(out?.noShowFeeEur).toBeUndefined();
    expect(out).toEqual({ name: "Bar" });
  });

  it("el aviso mínimo no viaja si la penalización está desactivada", () => {
    const encoded = encodeDemoProfile({ name: "Bar", noShowNoticeHours: 3 });
    expect(decodeDemoProfile(encoded)?.noShowNoticeHours).toBeUndefined();
  });

  it("smartSpread en false no ocupa sitio en el enlace", () => {
    const encoded = encodeDemoProfile({ name: "Bar", smartSpread: false });
    expect(decodeDemoProfile(encoded)?.smartSpread).toBeUndefined();
  });

  it("descarta una penalización fuera de rango (0-50€)", () => {
    const encoded = btoa(JSON.stringify({ n: "Bar", q: 999 }));
    expect(decodeDemoProfile(encoded)?.noShowFeeEur).toBeUndefined();
  });

  it("descarta un colchón de cierre fuera de rango (0-240min)", () => {
    const encoded = btoa(JSON.stringify({ n: "Bar", u: 500 }));
    expect(decodeDemoProfile(encoded)?.lastSlotBufferMin).toBeUndefined();
  });

  it("un enlace sin q/w/k/u no trae ninguno de los cuatro campos", () => {
    const out = decodeDemoProfile(encodeDemoProfile({ name: "Bar" }));
    expect(out?.noShowFeeEur).toBeUndefined();
    expect(out?.noShowNoticeHours).toBeUndefined();
    expect(out?.smartSpread).toBeUndefined();
    expect(out?.lastSlotBufferMin).toBeUndefined();
  });
});

describe("blankDemoProfile apaga q/w/k/u por defecto", () => {
  it("no hereda la política de plantón ni el reparto de una demo anterior", () => {
    const blank = blankDemoProfile();
    expect(blank.noShowFeeEur).toBe(0);
    expect(blank.smartSpread).toBe(false);
  });

  it("tampoco hereda las franjas prioritarias de una demo anterior", () => {
    expect(blankDemoProfile().priorityHours).toEqual([]);
  });
});

describe("franjas prioritarias (\"y\")", () => {
  it("viajan y vuelven intactas por la URL", () => {
    const profile = { name: "Cardedal", priorityHours: ["09:00-11:00", "17:00-18:30"] };
    expect(decodeDemoProfile(encodeDemoProfile(profile))).toEqual(profile);
  });

  it("se cortan a 3 rangos", () => {
    const encoded = encodeDemoProfile({
      name: "Bar",
      priorityHours: ["09:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00"],
    });
    expect(decodeDemoProfile(encoded)?.priorityHours).toEqual([
      "09:00-10:00",
      "10:00-11:00",
      "11:00-12:00",
    ]);
  });

  it("descarta en silencio un rango corrupto o al revés", () => {
    const encoded = btoa(
      JSON.stringify({ n: "Bar", y: ["09:00-11:00", "no-es-un-rango", "15:00-14:00"] }),
    );
    expect(decodeDemoProfile(encoded)?.priorityHours).toEqual(["09:00-11:00"]);
  });

  it("vacío no ocupa sitio en el enlace", () => {
    const encoded = encodeDemoProfile({ name: "Bar", priorityHours: [] });
    expect(decodeDemoProfile(encoded)).toEqual({ name: "Bar" });
  });

  it("sin \"y\" no aparece en el perfil decodificado", () => {
    expect(decodeDemoProfile(encodeDemoProfile({ name: "Bar" }))?.priorityHours).toBeUndefined();
  });
});

describe("decode tolera basura", () => {
  it("devuelve null sin parámetro", () => {
    expect(decodeDemoProfile(undefined)).toBeNull();
    expect(decodeDemoProfile("")).toBeNull();
  });

  it("devuelve null si el enlace llegó partido o corrupto", () => {
    expect(decodeDemoProfile("no-es-base64-valido!!")).toBeNull();
    expect(decodeDemoProfile(encodeDemoProfile({ name: "Corte" }).slice(0, 5))).toBeNull();
  });

  it("ignora un JSON que no es un objeto", () => {
    expect(decodeDemoProfile(btoa("[1,2,3]"))).toBeNull();
    expect(decodeDemoProfile(btoa('"texto suelto"'))).toBeNull();
  });

  it("descarta una nota fuera de escala en vez de mostrarla", () => {
    expect(decodeDemoProfile(btoa(JSON.stringify({ r: 9.7 })))).toBeNull();
    expect(decodeDemoProfile(btoa(JSON.stringify({ n: "Bar", r: 9.7 })))).toEqual({
      name: "Bar",
    });
  });

  it("descarta un número de reseñas negativo", () => {
    expect(decodeDemoProfile(btoa(JSON.stringify({ n: "Bar", c: -5 })))).toEqual({
      name: "Bar",
    });
  });
});

describe("slugify", () => {
  it("convierte el nombre en algo legible en un chat", () => {
    expect(slugify("Peluquería Los Ángeles")).toBe("peluqueria-los-angeles");
    expect(slugify("Barbería  &  Co.")).toBe("barberia-co");
  });

  it("no deja guiones sueltos en los extremos", () => {
    expect(slugify("  ¡Corte!  ")).toBe("corte");
  });

  it("cae en 'demo' cuando no hay nombre", () => {
    expect(demoUrl({}, "https://x.test")).toContain("/s/demo?");
  });
});

describe("parseGoogleMapsPaste", () => {
  it("saca nombre, nota, reseñas, dirección y teléfono de una ficha pegada", () => {
    const pegado = `Peluquería Los Ángeles
4,6(87)
Peluquería
Calle Mayor 14, 28801 Alcalá de Henares, Madrid
918 12 34 56`;
    const out = parseGoogleMapsPaste(pegado);
    expect(out.name).toBe("Peluquería Los Ángeles");
    expect(out.rating).toBe(4.6);
    expect(out.reviewCount).toBe(87);
    expect(out.address).toBe("Calle Mayor 14, 28801 Alcalá de Henares, Madrid");
    expect(out.phone).toBe("918 12 34 56");
  });

  it("entiende el formato con separador y la palabra reseñas", () => {
    const out = parseGoogleMapsPaste("Barbería Pepe\n4,8 · 312 reseñas\nAvenida de la Paz 3");
    expect(out.rating).toBe(4.8);
    expect(out.reviewCount).toBe(312);
    expect(out.address).toBe("Avenida de la Paz 3");
  });

  it("separa los miles del número de reseñas", () => {
    const out = parseGoogleMapsPaste("Salón Grande\n4,5(1.234)");
    expect(out.reviewCount).toBe(1234);
  });

  it("no inventa campos cuando el texto no los trae", () => {
    const out = parseGoogleMapsPaste("Solo un nombre suelto");
    expect(out.name).toBe("Solo un nombre suelto");
    expect(out.phone).toBeUndefined();
    expect(out.address).toBeUndefined();
    expect(out.rating).toBeUndefined();
  });

  it("no devuelve nada con texto vacío", () => {
    expect(parseGoogleMapsPaste("   \n  \n ")).toEqual({});
  });
});
