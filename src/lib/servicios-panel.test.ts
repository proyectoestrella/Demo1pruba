import { describe, expect, it } from "bun:test";
import { agruparCarta, normalizar } from "./servicios-panel";
import { servicesForType, textosDeCarta } from "./mock/salon";
import { PELUCHIC } from "./demos/peluchic";
import { useSalonStore } from "./store";
import { cargarDemoRegistrada } from "./demos/aplicar";

const carta = servicesForType("peluqueria", PELUCHIC.menu, textosDeCarta(PELUCHIC));

describe("la carta del panel por secciones", () => {
  it("agrupa los 60 servicios de PeluChic en sus siete secciones, en orden", () => {
    const grupos = agruparCarta(carta);
    expect(grupos.map((g) => g.categoria)).toEqual([
      "Trabajos Cotidianos Peluquería", "Tratamientos Cuero Cabelludo", "Tratamientos Cabello",
      "Trabajos de la Mirada", "Trabajos Faciales", "Trabajos Corporales", "Trabajos de Cámara y Foco",
    ]);
    expect(grupos.reduce((t, g) => t + g.servicios.length, 0)).toBe(60);
    expect(grupos[0]).toMatchObject({ desde: 10, hasta: 65.5 });
  });

  it("busca sin tildes por nombre, sección o descripción", () => {
    expect(normalizar("Depilación ")).toBe("depilacion");
    // «depilacion» encuentra los dos servicios de depilación y los laminados, que la incluyen.
    const ids = agruparCarta(carta, { texto: "depilacion" }).flatMap((g) => g.servicios.map((s) => s.id));
    expect(ids).toContain("depilacion-ceja");
    expect(ids).toContain("depilacion-limpieza-ceja");
    expect(ids).toContain("laminado-cejas");
    expect(ids).not.toContain("tratamiento-keratina");
    expect(agruparCarta(carta, { texto: "BALAYAGE" }).flatMap((g) => g.servicios.map((s) => s.id))).toEqual(["mechas"]);
    expect(agruparCarta(carta, { texto: "no existe" })).toEqual([]);
  });

  it("filtra por sección", () => {
    const g = agruparCarta(carta, { categoria: "Trabajos de Cámara y Foco" });
    expect(g).toHaveLength(1);
    expect(g[0].servicios.map((s) => s.name)).toEqual(["Maquillaje de Correccion", "Peluqueria focos", "Novias"]);
  });

  it("una carta sin secciones queda en un solo grupo", () => {
    expect(agruparCarta(servicesForType("peluqueria", ["Corte~30~15", "Tinte~60~35"]))).toHaveLength(1);
  });
});

describe("descripciones de la carta: Servicios y perfil van a la par", () => {
  it("editar la descripción en Servicios la escribe en el perfil, y al revés", () => {
    cargarDemoRegistrada("peluchic");
    useSalonStore.getState().updateService("peinar", { description: "Secado con cepillo y plancha." });
    expect(useSalonStore.getState().salonProfile.descripcionesServicios?.peinar).toBe("Secado con cepillo y plancha.");
    const otras = { ...useSalonStore.getState().salonProfile.descripcionesServicios, lavado: "Lavado a tu medida." };
    useSalonStore.getState().updateSalonProfile({ descripcionesServicios: otras, preciosLiterales: { ...PELUCHIC.preciosLiterales, lavado: "10 € / 12 €" } });
    const lavado = useSalonStore.getState().services.find((s) => s.id === "lavado");
    expect(lavado?.description).toBe("Lavado a tu medida.");
    expect(lavado?.priceText).toBe("10 € / 12 €");
    useSalonStore.getState().resetSalonProfile();
    useSalonStore.setState({ payments: [], cambios: [] });
  });
});
