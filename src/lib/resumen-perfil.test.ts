import { describe, expect, it } from "bun:test";
import { diferenciaDePerfil, resumenCampoPerfil, resumenRestauracion, versionRestaurable, VERSIONES_WEB_SIEMPRE } from "./resumen-perfil";
import { CAMPOS_PERFIL_SIN_REGISTRO } from "./registro-cambios";

describe("frases del historial para el perfil", () => {
  it("textos cortos con antes y después", () => {
    expect(resumenCampoPerfil("name", "Peluchic", "PeluChic Madrid")).toBe("Cambió el nombre del salón: «Peluchic» → «PeluChic Madrid»");
    expect(resumenCampoPerfil("phone", "", "612345678")).toBe("Puso el teléfono: «612345678»");
    expect(resumenCampoPerfil("whatsapp", "612345678", null)).toBe("Quitó el WhatsApp («612345678»)");
  });
  it("imágenes: portada y logo", () => {
    expect(resumenCampoPerfil("heroImage", "https://a/1.jpg", "https://a/2.jpg")).toBe("Nueva foto de portada");
    expect(resumenCampoPerfil("heroImage", "https://a/1.jpg", "")).toBe("Quitada la foto de portada");
    expect(resumenCampoPerfil("logoUrl", null, "https://a/logo.png")).toBe("Nuevo logo");
  });
  it("galería: cuenta fotos añadidas y quitadas", () => {
    expect(resumenCampoPerfil("galeriaPropia", [{ url: "a", alt: "" }], [{ url: "a", alt: "" }, { url: "b", alt: "" }, { url: "c", alt: "" }])).toBe("Galería: añadidas 2 fotos");
    expect(resumenCampoPerfil("galeriaPropia", [{ url: "a", alt: "" }, { url: "b", alt: "" }], [{ url: "b", alt: "" }])).toBe("Galería: quitada 1 foto");
  });
  it("horario de un día y de varios", () => {
    const a = ["10:00–20:00", "10:00–20:00", "", "", "", "", ""];
    expect(resumenCampoPerfil("openingHours", a, ["10:00–14:00", ...a.slice(1)])).toBe("Cambió el horario del lunes: 10:00–20:00 → 10:00–14:00");
    expect(resumenCampoPerfil("openingHours", a, ["", "", "9:00", "", "", "", ""])).toBe("Cambió el horario del salón (lunes, martes, miércoles)");
  });
  it("avatar y colores con el nombre de la persona o del servicio", () => {
    expect(resumenCampoPerfil("avataresEquipo", {}, { "emp-1": { style: "trimly", avatar: "x" } }, { equipo: { "emp-1": "Anca" } })).toBe("Avatar de Anca");
    expect(resumenCampoPerfil("coloresServicio", { s1: 1 }, { s1: 4 }, { servicios: { s1: "Corte" } })).toBe("Cambió el color de Corte en el calendario");
    expect(resumenCampoPerfil("coloresProfesional", {}, { e9: 2 })).toBe("Cambió el color de una profesional en el calendario");
  });
  it("especialidades, carta y textos largos", () => {
    expect(resumenCampoPerfil("specialties", ["Corte"], ["Corte", "Color"])).toBe("Especialidades: + Color");
    expect(resumenCampoPerfil("menu", ["a"], ["a", "b"])).toBe("La carta de servicios y precios: 1 línea nueva");
    expect(resumenCampoPerfil("about", "x", "y")).toBe("Reescribió la presentación");
  });
  it("sin valores, la frase genérica de siempre; campo desconocido entre comillas", () => {
    expect(resumenCampoPerfil("logoUrl")).toBe("Cambió el logo");
    expect(resumenCampoPerfil("cosaNueva", 1, 2)).toBe("Cambió «cosaNueva»: 1 → 2");
  });
});

describe("lo que no se registra", () => {
  it("solo marcas internas, nada que decida la dueña", () => {
    expect([...CAMPOS_PERFIL_SIN_REGISTRO].sort()).toEqual(["id", "setupChecklistDone", "setupChecklistHidden", "slug", "tourPanelVisto"]);
  });
});

describe("restaurar una versión", () => {
  it("solo lo que cambia, con null donde no existía (deshacer lo borra)", () => {
    const antes = { name: "A", heroImage: "1.jpg", whatsapp: "6123", plan: "basico" };
    const despues = { name: "A", heroImage: "0.jpg", plan: "basico" };
    expect(diferenciaDePerfil(antes, despues)).toEqual({ antes: { heroImage: "1.jpg", whatsapp: "6123" }, despues: { heroImage: "0.jpg", whatsapp: null } });
    expect(diferenciaDePerfil(antes, despues, ["name", "heroImage"])).toEqual({ antes: { heroImage: "1.jpg" }, despues: { heroImage: "0.jpg" } });
  });
  it("la frase dice qué vuelve", () => {
    expect(resumenRestauracion("2026-10-21T16:05:00Z", ["heroImage", "logoUrl", "name"])).toMatch(/^Restaurada la versión de tu página del 21 oct.* \(la foto de portada, el logo y 1 más\)$/);
    expect(resumenRestauracion("2026-10-21T16:05:00Z", [])).toContain("era igual");
  });
  it("con cualquier plan se recuperan las últimas N; más atrás, con historial completo", () => {
    expect(versionRestaurable(0, false)).toBe(true);
    expect(versionRestaurable(VERSIONES_WEB_SIEMPRE - 1, false)).toBe(true);
    expect(versionRestaurable(VERSIONES_WEB_SIEMPRE, false)).toBe(false);
    expect(versionRestaurable(VERSIONES_WEB_SIEMPRE + 20, true)).toBe(true);
    expect(versionRestaurable(-1, true)).toBe(false);
  });
});

describe("deshacer una restauración desde el Historial (store)", () => {
  it("una fila perfil.restaurar campo a campo se deshace y devuelve los campos", async () => {
    const { useSalonStore, conRegistroEnPausa } = await import("./store");
    conRegistroEnPausa(() => useSalonStore.getState().updateSalonProfile({ heroImage: "https://x/vieja.jpg", tagline: "Versión vieja" }));
    const antes = { heroImage: "https://x/nueva.jpg", tagline: "Versión nueva" };
    const despues = { heroImage: "https://x/vieja.jpg", tagline: "Versión vieja" };
    useSalonStore.getState().fusionarCambiosRemotos([
      { id: "c-restaurar-1", tipo: "perfil.restaurar", entidad: "perfil", idEntidad: "perfil", antes, despues, resumen: "Restaurada", autor: null, autorNombre: null, fecha: new Date().toISOString(), avisoEnviado: false } as never,
    ]);
    const r = useSalonStore.getState().deshacerCambio("c-restaurar-1");
    expect(r.ok).toBe(true);
    expect(useSalonStore.getState().salonProfile.heroImage).toBe("https://x/nueva.jpg");
    expect(useSalonStore.getState().salonProfile.tagline).toBe("Versión nueva");
  });
});
