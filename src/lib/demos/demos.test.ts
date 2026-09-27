import { afterAll, describe, expect, it } from "bun:test";

import { inferBusinessType, menuDesdeServicios, parseMenuEntry, parseTeamEntry } from "../business-type";
import { blankDemoProfile } from "../demo-profile";
import { parseFaqEntry, MAX_FAQ_ENTRIES } from "../faq";
import { parseRanges } from "../opening-hours";
import { servicesForType, textosDeCarta } from "../mock/salon";
import { useSalonStore } from "../store";
import { demoPorSlug, demoRegistrada, marcaDeDemo, slugsDeDemos } from "./index";
import { cargarDemoRegistrada, demoRegistradaCargada, perfilDeDemoRegistrada } from "./aplicar";
import { CATEGORIAS_PELUCHIC, PELUCHIC, SERVICIOS_PELUCHIC } from "./peluchic";

describe("registro de demos por slug", () => {
  it("encuentra PeluChic por su slug y nada más", () => {
    expect(demoPorSlug("peluchic")?.name).toBe("PeluChic");
    expect(demoPorSlug("otra")).toBeUndefined();
    expect(demoPorSlug("")).toBeUndefined();
    expect(demoPorSlug(undefined)).toBeUndefined();
    // Un slug con nombre de propiedad de Object no es una demo.
    expect(demoPorSlug("constructor")).toBeUndefined();
    expect(demoPorSlug("__proto__")).toBeUndefined();
    expect(slugsDeDemos()).toEqual(["peluchic"]);
    expect(marcaDeDemo("peluchic")).toMatch(/^peluchic@/);
    expect(marcaDeDemo("otra")).toBeNull();
  });

  it("el slug del perfil es el de la URL corta", () => {
    for (const slug of slugsDeDemos()) expect(demoPorSlug(slug)?.slug).toBe(slug);
  });
});

describe("perfil de PeluChic", () => {
  it("es una peluquería (su semilla es la de peluquería)", () => {
    expect(inferBusinessType(PELUCHIC.tagline, PELUCHIC.name)).toBe("peluqueria");
  });

  it("lleva la carta entera de su web: 60 servicios válidos, con id estable y nombre sin cortar", () => {
    expect(PELUCHIC.menu).toHaveLength(60);
    const entradas = (PELUCHIC.menu ?? []).map(parseMenuEntry);
    expect(entradas.every((e) => e !== null)).toBe(true);
    expect(entradas.map((e) => e?.id)).toEqual(SERVICIOS_PELUCHIC.map((s) => s.id));
    expect(new Set(entradas.map((e) => e?.id)).size).toBe(60);
    // El nombre más largo de su carta (71 caracteres) llega entero.
    expect(entradas.map((e) => e?.name)).toContain(
      "Linfting pestañas +tinte de pestañas +laminado de cejas+tinte de cejas",
    );
    expect(entradas.every((e) => e && e.priceEur > 0)).toBe(true);
  });

  it("agrupa la carta en sus siete secciones, en el orden de su web", () => {
    const orden: string[] = [];
    for (const s of SERVICIOS_PELUCHIC) if (!orden.includes(s.categoria)) orden.push(s.categoria);
    expect(orden).toEqual([...CATEGORIAS_PELUCHIC]);
  });

  it("cada servicio tiene su descripción, y el precio literal cuando no es un importe único", () => {
    const servicios = servicesForType("peluqueria", PELUCHIC.menu, textosDeCarta(PELUCHIC));
    expect(servicios).toHaveLength(60);
    expect(servicios.every((s) => s.description.length > 0)).toBe(true);
    const peinar = servicios.find((s) => s.id === "peinar");
    expect(peinar?.priceEur).toBe(24);
    expect(peinar?.priceText).toBe("24 € / 28 € / 31 €");
    expect(servicios.find((s) => s.id === "novias")?.priceText).toBe("desde 150 € (sin IVA)");
    // Un precio único no lleva texto aparte.
    expect(servicios.find((s) => s.id === "lavado")?.priceText).toBeUndefined();
  });

  it("la carta cabe entera en el perfil de un salón (tope de 60)", () => {
    const servicios = servicesForType("peluqueria", PELUCHIC.menu, textosDeCarta(PELUCHIC));
    expect(menuDesdeServicios(servicios)).toEqual(PELUCHIC.menu ?? []);
  });

  it("horario de su web: cierra lunes y domingo, el sábado de 10 a 14", () => {
    expect(PELUCHIC.openingHours[0]).toBe("Cerrado");
    expect(PELUCHIC.openingHours[5]).toBe("10:00–14:00");
    expect(PELUCHIC.openingHours[6]).toBe("Cerrado");
    for (const dia of PELUCHIC.openingHours.slice(1, 5)) expect(dia).toBe("10:00–20:00");
  });

  it("los turnos del equipo caben dentro del horario del salón", () => {
    expect(PELUCHIC.team?.map((t) => parseTeamEntry(t)?.name)).toEqual(["María", "Sara", "Noelia"]);
    expect(PELUCHIC.teamHours).toHaveLength(PELUCHIC.team?.length ?? 0);
    for (const turnos of PELUCHIC.teamHours ?? []) {
      turnos.forEach((turno, dia) => {
        const salon = parseRanges(PELUCHIC.openingHours[dia]);
        for (const franja of parseRanges(turno)) {
          expect(salon.some((s) => s.start <= franja.start && franja.end <= s.end)).toBe(true);
        }
      });
    }
  });

  it("contacto, enlaces y boletín reales", () => {
    expect(PELUCHIC.whatsapp).toBe("+34 666 77 67 31");
    expect(PELUCHIC.enlaces).toEqual({
      blog: "https://peluchic.online/",
      instagram: "https://www.instagram.com/peluchicprofesional",
      facebook: "https://www.facebook.com/peluchicprofesional/",
      tienda: "https://peluchic.online/tienda/ols/all",
    });
    expect(PELUCHIC.boletin?.texto).toContain("10 %");
    expect(PELUCHIC.logoUrl).toBe("/demo/peluchic-logo.png");
    expect(PELUCHIC.plan).toBe("todo-incluido");
    expect(PELUCHIC.galeriaPropia?.every((f) => f.url.startsWith("/demo/") && f.alt.length > 10)).toBe(true);
  });

  it("sus preguntas frecuentes son válidas y caben", () => {
    expect((PELUCHIC.faq ?? []).length).toBeLessThanOrEqual(MAX_FAQ_ENTRIES);
    expect((PELUCHIC.faq ?? []).every((f) => parseFaqEntry(f) !== null)).toBe(true);
  });
});

describe("un enlace ?d= no hereda nada de la demo registrada", () => {
  it("blankDemoProfile deja en blanco logo, enlaces, WhatsApp, boletín, galería y textos de la carta", () => {
    const encima = { ...PELUCHIC, ...blankDemoProfile() };
    expect(encima.enlaces).toBeUndefined();
    expect(encima.whatsapp).toBeUndefined();
    expect(encima.boletin).toBeUndefined();
    expect(encima.galeriaPropia).toBeUndefined();
    expect(encima.descripcionesServicios).toBeUndefined();
    expect(encima.preciosLiterales).toBeUndefined();
    expect(encima.logoUrl).toBeUndefined();
  });

  it("y el perfil registrado pisa lo de la demo anterior", () => {
    const perfil = perfilDeDemoRegistrada(PELUCHIC);
    expect(perfil.name).toBe("PeluChic");
    expect(perfil.teamIds).toBeUndefined();
    expect((perfil as { modulosOcultos?: string[] }).modulosOcultos).toEqual([]);
  });
});

describe("cargar la demo registrada en la store", () => {
  // La store es un módulo compartido por todos los ficheros de pruebas: se
  // devuelve al salón de ejemplo para no dejarles PeluChic cargada.
  afterAll(() => {
    useSalonStore.getState().resetSalonProfile();
    useSalonStore.setState({ payments: [], cambios: [] });
  });
  it("sustituye el salón entero y deja la agenda sembrada con su carta", () => {
    useSalonStore.setState({ payments: [{ id: "p-otra-demo" } as never], cambios: [{ id: "c-otra" } as never] });
    expect(cargarDemoRegistrada("peluchic", { panel: true })).toBe(true);
    const st = useSalonStore.getState();
    expect(st.salonProfile.name).toBe("PeluChic");
    expect(st.salonProfile.slug).toBe("peluchic");
    expect(st.services).toHaveLength(60);
    expect(st.services.find((s) => s.id === "mechas")?.priceText).toBe("46,50 € / 106,50 €");
    expect(st.appointments.length).toBeGreaterThan(1000);
    expect(st.payments).toEqual([]);
    expect(st.cambios).toEqual([]);
    expect(st.realSalonSlug).toBeNull();
    expect(st.demoActive).toBe(true);
    expect(demoRegistradaCargada("peluchic")).toBe(true);
  });

  it("un ?d= encima invalida la carga: la próxima visita sin ?d= la vuelve a cargar", () => {
    cargarDemoRegistrada("peluchic");
    useSalonStore.getState().updateSalonProfile({ ...blankDemoProfile(), name: "PeluChic" });
    expect(demoRegistradaCargada("peluchic")).toBe(false);
  });

  it("un slug sin demo registrada no toca nada", () => {
    const antes = useSalonStore.getState().salonProfile;
    expect(cargarDemoRegistrada("no-existe")).toBe(false);
    expect(useSalonStore.getState().salonProfile).toBe(antes);
    expect(demoRegistrada("no-existe")).toBeUndefined();
  });
});
