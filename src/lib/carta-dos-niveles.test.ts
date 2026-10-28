import { describe, expect, it } from "bun:test";
import { formatMenuEntry, menuDesdeServicios, parseMenuEntry } from "./business-type";
import { servicesForType } from "./mock/salon";
import {
  agruparCartaDosNiveles,
  enlaceConsulta,
  esSoloConsulta,
  tituloDeBloque,
} from "./carta-publica";
import {
  correoAvisoFestivos,
  esDomingo,
  esDomingoOFestivo,
  festivoEn,
  textoAvisoFestivo,
} from "./festivos-madrid";
import type { Service } from "./mock/types";

/** Lectura de la carta tal y como era ANTES de esta tanda (solo seis campos). */
function parseMenuEntryAntiguo(raw: string) {
  const parts = raw.split("~");
  const apagado = parts[4]?.trim().toLowerCase() === "off";
  const id = parts[5]?.trim();
  return {
    name: parts[0].trim(),
    durationMin: Math.round(Number(parts[1])),
    priceEur: Number(parts[2]),
    category: parts[3]?.trim() || undefined,
    ...(apagado ? { active: false } : {}),
    ...(id ? { id } : {}),
  };
}

describe("carta serializada: compatibilidad hacia atrás", () => {
  const guardadas = [
    "Corte~30~15",
    "Corte~30~15~Cortes",
    "Corte~30~15~Cortes~off",
    "Corte~30~15~Cortes~~corte-1",
    "Tinte~60~40.5~Color~off~tinte",
  ];

  it("los perfiles ya guardados se leen igual y no ganan campos nuevos", () => {
    for (const raw of guardadas) {
      const e = parseMenuEntry(raw);
      expect(e).not.toBeNull();
      expect(e?.grupo).toBeUndefined();
      expect(e?.soloConsulta).toBeUndefined();
      expect(e?.name).toBe(parseMenuEntryAntiguo(raw).name);
      expect(e?.category).toBe(parseMenuEntryAntiguo(raw).category);
      expect(e?.id).toBe(parseMenuEntryAntiguo(raw).id);
      expect(e?.active).toBe(parseMenuEntryAntiguo(raw).active);
    }
  });

  it("una entrada sin campos nuevos se vuelve a escribir byte a byte igual", () => {
    for (const raw of guardadas) {
      const e = parseMenuEntry(raw)!;
      expect(formatMenuEntry(e)).toBe(formatMenuEntry(parseMenuEntry(formatMenuEntry(e))!));
    }
    expect(formatMenuEntry({ name: "Corte", durationMin: 30, priceEur: 15 })).toBe("Corte~30~15");
    expect(
      formatMenuEntry({ name: "Corte", durationMin: 30, priceEur: 15, category: "Cortes", id: "c1" }),
    ).toBe("Corte~30~15~Cortes~~c1");
  });

  it("menuDesdeServicios sin grupo ni consulta no cambia el formato", () => {
    expect(
      menuDesdeServicios([{ id: "c1", name: "Corte", durationMin: 30, priceEur: 15, category: "Cortes" }]),
    ).toEqual(["Corte~30~15~Cortes~~c1"]);
  });

  it("los campos nuevos viajan al final: un lector antiguo sigue entendiendo el servicio", () => {
    const raw = formatMenuEntry({
      name: "Novias",
      durationMin: 90,
      priceEur: 150,
      category: "Novias",
      id: "novias",
      grupo: "Peluquería",
      soloConsulta: true,
    });
    expect(raw).toBe("Novias~90~150~Novias~~novias~Peluquería~consulta");
    expect(parseMenuEntryAntiguo(raw)).toEqual({
      name: "Novias",
      durationMin: 90,
      priceEur: 150,
      category: "Novias",
      id: "novias",
    });
    expect(parseMenuEntry(raw)).toEqual({
      name: "Novias",
      durationMin: 90,
      priceEur: 150,
      category: "Novias",
      id: "novias",
      grupo: "Peluquería",
      soloConsulta: true,
    });
  });

  it("servicesForType mezcla perfiles viejos y nuevos: sin grupo, reservable como siempre", () => {
    const carta = servicesForType("peluqueria", [
      "Corte~30~15~Cortes~~corte",
      "Novias~90~150~Novias~~novias~Peluquería~consulta",
      "Facial~45~40~Facial~~facial~Estética",
    ]);
    const [corte, novias, facial] = carta;
    expect(corte.grupo).toBeUndefined();
    expect(corte.soloConsulta).toBeUndefined();
    expect(esSoloConsulta(novias)).toBe(true);
    expect(novias.grupo).toBe("Peluquería");
    expect(facial.grupo).toBe("Estética");
    expect(esSoloConsulta(facial)).toBe(false);
  });

  it("ida y vuelta panel → menu → carta conserva grupo y consulta", () => {
    const menu = menuDesdeServicios([
      { id: "n", name: "Novias", durationMin: 90, priceEur: 150, category: "Novias", grupo: "Peluquería", soloConsulta: true },
    ]);
    const [n] = servicesForType("peluqueria", menu);
    expect(n.grupo).toBe("Peluquería");
    expect(n.soloConsulta).toBe(true);
  });
});

const svc = (id: string, name: string, category: string, extra: Partial<Service> = {}): Service => ({
  id,
  name,
  description: "",
  durationMin: 30,
  priceEur: 10,
  category,
  ...extra,
});

describe("agruparCartaDosNiveles", () => {
  const carta = [
    svc("a", "Corte", "Cotidianos", { grupo: "Peluquería" }),
    svc("b", "Hidratación", "Cabello", { grupo: "Peluquería" }),
    svc("c", "Depilación de ceja", "Mirada", { grupo: "Estética" }),
    svc("d", "Masaje", "Corporales", { grupo: "Estética" }),
    svc("e", "Reductor", "Corporales", { grupo: "Estética" }),
    svc("f", "Novias", "Novias", { grupo: "Peluquería", soloConsulta: true }),
    svc("g", "Apagado", "Cabello", { grupo: "Peluquería", active: false }),
  ];

  it("grupo → subcategoría → servicios, en el orden de la carta, sin servicios apagados", () => {
    const b = agruparCartaDosNiveles(carta);
    expect(b.map(tituloDeBloque)).toEqual(["Peluquería", "Estética"]);
    expect(b[0].subcategorias.map((s) => s.categoria)).toEqual(["Cotidianos", "Cabello", "Novias"]);
    expect(b[1].subcategorias.map((s) => [s.categoria, s.servicios.length])).toEqual([
      ["Mirada", 1],
      ["Corporales", 2],
    ]);
    expect(b[0].total).toBe(3);
  });

  it("sin grupo se ve como hoy: un bloque por categoría", () => {
    const b = agruparCartaDosNiveles([svc("a", "Corte", "Cortes"), svc("b", "Tinte", "Color")]);
    expect(b.map((x) => x.grupo)).toEqual([null, null]);
    expect(b.map(tituloDeBloque)).toEqual(["Cortes", "Color"]);
  });

  it("la lupa normaliza tildes y mayúsculas", () => {
    const b = agruparCartaDosNiveles(carta, { texto: "DEPILACION" });
    expect(b).toHaveLength(1);
    expect(b[0].subcategorias[0].servicios[0].name).toBe("Depilación de ceja");
    expect(agruparCartaDosNiveles(carta, { texto: "zzz" })).toEqual([]);
  });
});

describe("solo consulta", () => {
  it("prefiere WhatsApp con el nombre del servicio y cae al correo", () => {
    const s = svc("n", "Novias", "Novias", { soloConsulta: true });
    const wa = enlaceConsulta({ name: "PeluChic", whatsapp: "+34 666 77 67 31" }, s);
    expect(wa?.startsWith("https://wa.me/34666776731?text=")).toBe(true);
    expect(decodeURIComponent(wa!)).toContain("Novias");
    const mail = enlaceConsulta({ correoPrivacidad: "hola@x.es" }, s);
    expect(mail?.startsWith("mailto:hola@x.es?")).toBe(true);
    expect(enlaceConsulta({}, s)).toBeUndefined();
  });
});

describe("domingos y festivos (Madrid)", () => {
  it("detecta domingos", () => {
    expect(esDomingo("2026-11-01")).toBe(true);
    expect(esDomingo("2026-11-03")).toBe(false);
    expect(esDomingo("2027-03-28")).toBe(true);
  });

  it("festivos de 2026 y 2027, incluidos los traslados", () => {
    expect(esDomingoOFestivo("2026-12-08")).toBe(true);
    expect(esDomingoOFestivo("2026-11-02")).toBe(true); // traslado de Todos los Santos
    expect(esDomingoOFestivo("2026-12-07")).toBe(true); // traslado de la Constitución
    expect(esDomingoOFestivo("2027-08-16")).toBe(true); // traslado de la Asunción
    expect(esDomingoOFestivo("2027-03-26")).toBe(true); // Viernes Santo
    expect(festivoEn("2026-04-02")?.nombre).toBe("Jueves Santo");
  });

  it("un día laborable normal no es festivo", () => {
    expect(esDomingoOFestivo("2026-10-28")).toBe(false);
    expect(esDomingoOFestivo("2027-02-10")).toBe(false);
  });

  it("el aviso lleva el correo, y el de ajustes manda sobre el de privacidad", () => {
    expect(correoAvisoFestivos({ correoPrivacidad: "p@x.es" })).toBe("p@x.es");
    expect(correoAvisoFestivos({ correoPrivacidad: "p@x.es", correoDomingosFestivos: "f@x.es" })).toBe("f@x.es");
    expect(correoAvisoFestivos({})).toBeUndefined();
    expect(textoAvisoFestivo("f@x.es")).toBe(
      "Es domingo o festivo: tiene costes especiales. Escríbenos a f@x.es para pedir precio y hora.",
    );
  });
});
