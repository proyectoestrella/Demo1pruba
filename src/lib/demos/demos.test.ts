import { afterAll, describe, expect, it } from "bun:test";

import {
  inferBusinessType,
  menuDesdeServicios,
  parseMenuEntry,
  parseTeamEntry,
} from "../business-type";
import { blankDemoProfile, decodeDemoProfile, perfilConEnlace } from "../demo-profile";
import { parseFaqEntry, MAX_FAQ_ENTRIES } from "../faq";
import { parseRanges } from "../opening-hours";
import { servicesForType, textosDeCarta } from "../mock/salon";
import { useSalonStore } from "../store";
import { useAccesosDemo } from "../accesos-maqueta";
import { demoPorSlug, demoRegistrada, marcaDeDemo, slugsDeDemos } from "./index";
import { cargarDemoRegistrada, demoRegistradaCargada, perfilDeDemoRegistrada } from "./aplicar";
import { logoDelSalon, logotipoDelSalon } from "../logo-salon";
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

  it("lleva la carta aprobada: 55 servicios válidos, con id estable y nombre sin cortar", () => {
    expect(PELUCHIC.menu).toHaveLength(55);
    const entradas = (PELUCHIC.menu ?? []).map(parseMenuEntry);
    expect(entradas.every((e) => e !== null)).toBe(true);
    expect(entradas.map((e) => e?.id)).toEqual(SERVICIOS_PELUCHIC.map((s) => s.id));
    expect(new Set(entradas.map((e) => e?.id)).size).toBe(55);
    // El nombre más largo de su carta (71 caracteres) llega entero.
    expect(entradas.map((e) => e?.name)).toContain(
      "Linfting pestañas +tinte de pestañas +laminado de cejas+tinte de cejas",
    );
    expect(entradas.every((e) => e && e.priceEur >= 0)).toBe(true);
    expect(entradas.find((e) => e?.id === "higiene-facial-hidroface")?.priceEur).toBe(0);
  });

  it("agrupa la carta en sus siete secciones, en el orden de su web", () => {
    const orden: string[] = [];
    for (const s of SERVICIOS_PELUCHIC) if (!orden.includes(s.categoria)) orden.push(s.categoria);
    expect(orden).toEqual([...CATEGORIAS_PELUCHIC]);
  });

  it("cada servicio tiene su descripción, y el precio literal cuando no es un importe único", () => {
    const servicios = servicesForType("peluqueria", PELUCHIC.menu, textosDeCarta(PELUCHIC));
    expect(servicios).toHaveLength(55);
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

  it("horario confirmado: cierra lunes y domingo, el sábado de 9 a 14", () => {
    expect(PELUCHIC.openingHours[0]).toBe("Cerrado");
    expect(PELUCHIC.openingHours[5]).toBe("9:00–14:00");
    expect(PELUCHIC.openingHours[6]).toBe("Cerrado");
    for (const dia of PELUCHIC.openingHours.slice(1, 5)) expect(dia).toBe("10:00–20:00");
  });

  it("los turnos del equipo caben dentro del horario del salón", () => {
    expect(PELUCHIC.team?.map((t) => parseTeamEntry(t)?.name)).toEqual([
      "María",
      "Anca",
      "Patricia",
    ]);
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
      resenas:
        "https://www.google.com/maps/search/?api=1&query=PeluChic&query_place_id=ChIJc_dY3q0uQg0ReeAzc1Y3irs",
    });
    // El 10 % de su web no está activo en su tienda: no se promete ninguna cifra.
    expect(PELUCHIC.boletin?.texto).not.toMatch(/\d/);
    expect(PELUCHIC.boletin?.condiciones).toBeUndefined();
    expect(PELUCHIC.logoUrl).toBe("/demo/peluchic-logo.png");
    expect(PELUCHIC.plan).toBe("reservas");
    expect(PELUCHIC.galeriaPropia?.length).toBe(12);
    expect(
      PELUCHIC.galeriaPropia?.every(
        (f) => f.url.startsWith("/demo/peluchic-galeria/") && f.alt.length > 10,
      ),
    ).toBe(true);
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
    expect(perfil.teamIds).toEqual(["maria", "anca", "patricia"]);
    expect((perfil as { modulosOcultos?: string[] }).modulosOcultos).toEqual([]);
  });
});

/**
 * El `?d=` de Nelva Ortiz con el que se ensaya la demo del martes (peluquería,
 * estética y bienestar de Alcobendas). Es el caso real del fallo: el navegador
 * ya había abierto /demo/peluchic y la web de Nelva enseñaba el logotipo
 * caligráfico de PeluChic en la barra y en el héroe.
 */
const ENLACE_NELVA =
  "eyJuIjoiTmVsdmEgT3J0aXoiLCJ0IjoiUGVsdXF1ZXLDrWEsIEVzdMOpdGljYSB5IEJpZW5lc3RhciIsImQiOiJBdi4gZGUgbGEgRXJtaXRhLCAyLCBMb2MgNSwgMjgxMDggQWxjb2JlbmRhcywgTWFkcmlkLCBFc3Bhw7FhIiwicCI6IjkxNiA2MjAgNTY0IiwiciI6NC45LCJjIjoxNDIsIm8iOlsiMDk6MDDigJMyMTowMCIsIjA5OjAw4oCTMjE6MDAiLCIwOTowMOKAkzIxOjAwIiwiMDk6MDDigJMyMTowMCIsIjA5OjAw4oCTMjE6MDAiLCIwOTowMOKAkzE1OjAwIiwiQ2VycmFkbyJdLCJlIjpbIk5lbHZhfkVzdGlsaXN0YSB5IEVzdGV0aWNpc3RhIiwiTmF0YWxpYX5Fc3RpbGlzdGEgeSBNYW5pY3VyaXN0YSIsIkbDoXRpbWF-RXN0aWxpc3RhIl0sIm0iOlsiQ2hhbXDDuiArIENvcnRlICsgUGVpbmFkb340NX40M35QZWx1cXVlcsOtYSIsIkNoYW1ww7ogKyBDb3J0ZX4zMH4yNX5QZWx1cXVlcsOtYSIsIkNoYW1ww7ogKyBQZWluYWRvfjMwfjIyflBlbHVxdWVyw61hIiwiQ2hhbXDDuiArIENvbG9yfjYwfjM4fkNvbG9yIiwiQ2hhbXDDuiArIEJhcnJvcyAoY29sb3IgdmVnZXRhbCl-OTB-NTh-Q29sb3IiLCIxMDAlIEdsb3NzfjMwfjIwfkNvbG9yIiwiQWxpc2FkbyBjb24gS2VyYXRpbmF-MTIwfjEwMH5Gb3JtYSIsIkNvcnRlIMOJbCAoY2hhbXDDuiArIGNvcnRlKX4zMH4yMX5QYXJhIMOJbCIsIk94aWdlbmFudGUgVklQIE8yIGNvbiBSZW1vZGVsaW5nfjYwfjkwfkVzdMOpdGljYSIsIklsdW1pbmFkb3IgUGlnbSA0MDB-NjB-OTB-RXN0w6l0aWNhIiwiQm9vc3RlciBWSVAgTzJ-NjB-OTB-RXN0w6l0aWNhIiwiSW55ZWNjacOzbiBkZSBDb2zDoWdlbm9-MzB-MzB-RXN0w6l0aWNhIl0sImVuIjp7InciOiJodHRwczovL25lbHZhb3J0aXouY29tLyJ9LCJtbyI6WyJlcXVpcG8iXX0";

describe("un enlace ?d= de otro salón no hereda la marca de PeluChic", () => {
  const CAMPOS_DE_MARCA_DE_PELUCHIC = [
    "logoUrl",
    "logotipoClaroUrl",
    "logotipoOscuroUrl",
    "whatsapp",
    "boletin",
    "galeriaPropia",
    "descripcionesServicios",
    "preciosLiterales",
    "destacados",
    "teamExperience",
    "serviciosPorProfesional",
    "bloqueosAgenda",
    "diasEspeciales",
    "preguntasReserva",
  ] as const;

  it("todo campo que define la demo de PeluChic está en blanco en un enlace, salvo lo que es del navegador", () => {
    // Si alguien añade un campo a PELUCHIC y no lo pone en blankDemoProfile,
    // este test avisa antes de que se cuele en la demo de otro salón.
    const delNavegador = ["id", "slug", "timeZone", "plan", "calendario", "teamIds", "teamHours"];
    const enBlanco = blankDemoProfile() as unknown as Record<string, unknown>;
    const sinBlanquear = Object.keys(PELUCHIC).filter(
      (campo) => !delNavegador.includes(campo) && !(campo in enBlanco),
    );
    expect(sinBlanquear).toEqual([]);
  });

  it("el enlace de Nelva se descodifica y no trae ningún logotipo", () => {
    const nelva = decodeDemoProfile(ENLACE_NELVA);
    expect(nelva?.name).toBe("Nelva Ortiz");
    expect((nelva as Record<string, unknown>).logotipoClaroUrl).toBeUndefined();
    expect((nelva as Record<string, unknown>).logotipoOscuroUrl).toBeUndefined();
  });

  it("lo que ve la web pública (guardado = PeluChic, encima el enlace) no lleva el logotipo de PeluChic", () => {
    const guardado = perfilDeDemoRegistrada(PELUCHIC);
    expect(guardado.logotipoClaroUrl).toBe("/demo/peluchic-logotipo-blanco.webp");
    const visto = perfilConEnlace(guardado, decodeDemoProfile(ENLACE_NELVA) ?? {});
    expect(visto.name).toBe("Nelva Ortiz");
    for (const campo of CAMPOS_DE_MARCA_DE_PELUCHIC) expect(visto[campo]).toBeUndefined();
    // Los enlaces son los que trae SU enlace (solo su web), no el Instagram ni el blog de PeluChic.
    expect(visto.enlaces).toEqual({ web: "https://nelvaortiz.com/" });
    expect(logotipoDelSalon(visto, true, "claro")).toBeNull();
    expect(logotipoDelSalon(visto, true, "oscuro")).toBeNull();
    expect(logoDelSalon(visto, true)).toBeNull();
  });

  it("y al aplicarlo a la store (lo que hace la web al abrir el enlace) tampoco queda nada en lo guardado", () => {
    cargarDemoRegistrada("peluchic", { panel: true });
    expect(useSalonStore.getState().salonProfile.logotipoOscuroUrl).toBe(
      "/demo/peluchic-logotipo-oscuro.webp",
    );
    useSalonStore
      .getState()
      .updateSalonProfile({ ...blankDemoProfile(), ...decodeDemoProfile(ENLACE_NELVA) });
    const guardado = useSalonStore.getState().salonProfile;
    expect(guardado.name).toBe("Nelva Ortiz");
    for (const campo of CAMPOS_DE_MARCA_DE_PELUCHIC) expect(guardado[campo]).toBeUndefined();
    expect(guardado.enlaces).toEqual({ web: "https://nelvaortiz.com/" });
    useSalonStore.getState().resetSalonProfile();
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
    useSalonStore.setState({
      payments: [{ id: "p-otra-demo" } as never],
      cambios: [{ id: "c-otra" } as never],
    });
    expect(cargarDemoRegistrada("peluchic", { panel: true })).toBe(true);
    const st = useSalonStore.getState();
    expect(st.salonProfile.name).toBe("PeluChic");
    expect(st.salonProfile.slug).toBe("peluchic");
    expect(st.services).toHaveLength(55);
    expect(st.services.find((s) => s.id === "mechas")?.priceText).toBe("46,50 € / 106,50 €");
    expect(st.appointments.length).toBeGreaterThan(1000);
    expect(st.payments).toEqual([]);
    expect(st.cambios).toEqual([]);
    expect(st.realSalonSlug).toBeNull();
    expect(st.demoActive).toBe(true);
    expect(demoRegistradaCargada("peluchic")).toBe(true);
  });

  it("la puerta /demo/<slug> entra como la gerente y en el panel de siempre", () => {
    useAccesosDemo.setState({ verComo: "demo-diego", claveEquipo: "otra", miembros: [] });
    useSalonStore.setState({ panelV2: true });
    cargarDemoRegistrada("peluchic", { panel: true });
    expect(useAccesosDemo.getState().verComo).toBeNull();
    expect(useAccesosDemo.getState().miembros).toBeNull();
    expect(useSalonStore.getState().panelV2).toBe(false);
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

describe("las fotos de la galería existen, en 600 y 1200 px", () => {
  it("cada foto de galeriaPropia está en public/ con su versión pequeña", async () => {
    for (const foto of PELUCHIC.galeriaPropia ?? []) {
      const grande = new URL(`../../../public${foto.url}`, import.meta.url);
      const pequena = new URL(
        `../../../public${foto.url.replace("-1200.webp", "-600.webp")}`,
        import.meta.url,
      );
      expect(await Bun.file(grande).exists()).toBe(true);
      expect(await Bun.file(pequena).exists()).toBe(true);
    }
  });
});

describe("el ?d= lleva lo del lote 18 (vista previa de Mi página)", () => {
  it("ida y vuelta: enlaces, WhatsApp, boletín, galería, logo y textos de la carta", async () => {
    const { encodeDemoProfile, decodeDemoProfile } = await import("../demo-profile");
    const vuelta = decodeDemoProfile(encodeDemoProfile(PELUCHIC, { cartaCompleta: true }));
    expect(vuelta?.menu).toHaveLength(55);
    expect(vuelta?.enlaces).toEqual(PELUCHIC.enlaces);
    expect(vuelta?.whatsapp).toBe(PELUCHIC.whatsapp);
    expect(vuelta?.boletin).toEqual(PELUCHIC.boletin);
    expect(vuelta?.galeriaPropia).toEqual(PELUCHIC.galeriaPropia);
    expect(vuelta?.logoUrl).toBe(PELUCHIC.logoUrl);
    expect(vuelta?.descripcionesServicios).toEqual(PELUCHIC.descripcionesServicios);
    expect(vuelta?.preciosLiterales).toEqual(PELUCHIC.preciosLiterales);
    // Un enlace para compartir sigue cortando la carta en 12.
    expect(decodeDemoProfile(encodeDemoProfile(PELUCHIC))?.menu).toHaveLength(12);
  });

  it("descarta direcciones peligrosas o mal formadas", async () => {
    const { encodeDemoProfile, decodeDemoProfile, urlSegura } = await import("../demo-profile");
    expect(urlSegura("javascript:alert(1)")).toBeNull();
    expect(urlSegura("data:text/html,x", true)).toBeNull();
    expect(urlSegura("//malo.com/x.jpg", true)).toBeNull();
    expect(urlSegura("/demo/foto.webp", true)).toBe("/demo/foto.webp");
    expect(urlSegura("/demo/foto.webp")).toBeNull();
    const raw = btoa(
      JSON.stringify({
        n: "X",
        en: { i: "javascript:alert(1)", f: "https://facebook.com/x" },
        gp: [
          ["javascript:x", "a"],
          ["https://a.com/b.jpg", "b"],
        ],
        bo: { t: "Hola", u: "javascript:x" },
      }),
    );
    const d = decodeDemoProfile(raw);
    expect(d?.enlaces).toEqual({ facebook: "https://facebook.com/x" });
    expect(d?.galeriaPropia).toEqual([{ url: "https://a.com/b.jpg", alt: "b" }]);
    expect(d?.boletin).toBeUndefined();
  });

  it("el enlace público del panel de una demo registrada es el corto", async () => {
    const { panelPublicLink } = await import("../panel-public-link");
    expect(panelPublicLink(perfilDeDemoRegistrada(PELUCHIC), null, true)).toBe("/s/peluchic");
  });
});
