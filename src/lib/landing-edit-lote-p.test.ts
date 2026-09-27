import { describe, expect, it } from "bun:test";
import { borradorDesdePerfil, perfilDesdeBorrador, validarBorrador } from "./landing-edit";
import { PELUCHIC } from "./demos/peluchic";

const base = () => borradorDesdePerfil(PELUCHIC);

describe("Mi página: enlaces, WhatsApp, boletín, galería y descripciones (lote P)", () => {
  it("el perfil de PeluChic pasa por el editor sin perder nada", () => {
    const b = base();
    expect(validarBorrador({ ...b, team: "" })).toEqual([]);
    const p = perfilDesdeBorrador(b);
    expect(p.whatsapp).toBe(PELUCHIC.whatsapp);
    expect(p.enlaces).toEqual(PELUCHIC.enlaces);
    expect(p.boletin).toEqual(PELUCHIC.boletin);
    expect(p.galeriaPropia).toEqual(PELUCHIC.galeriaPropia);
    expect(p.descripcionesServicios).toEqual(PELUCHIC.descripcionesServicios);
  });

  it("vaciar un campo lo quita de verdad (presente y sin valor)", () => {
    const p = perfilDesdeBorrador({ ...base(), whatsapp: "", enlaces: { blog: "", instagram: "", facebook: "", tienda: "", web: "" }, boletinTexto: "", boletinUrl: "", galeria: [] });
    for (const campo of ["whatsapp", "enlaces", "boletin", "galeriaPropia"] as const) {
      expect(campo in p).toBe(true);
      expect(p[campo]).toBeUndefined();
    }
  });

  it("sin ninguna descripción escrita no toca las de la carta", () => {
    expect("descripcionesServicios" in perfilDesdeBorrador({ ...base(), descripciones: {} })).toBe(false);
  });

  it("explica en español lo que falta", () => {
    const errores = validarBorrador({
      ...base(),
      team: "",
      whatsapp: "123",
      enlaces: { ...base().enlaces, instagram: "instagram.com/peluchic" },
      boletinTexto: "",
      boletinUrl: "https://peluchic.online/",
      galeria: [{ url: "/demo/foto.webp", alt: "" }, { url: "javascript:alert(1)", alt: "Algo" }],
    });
    const campos = errores.map((e) => e.campo);
    expect(campos).toContain("whatsapp");
    expect(campos).toContain("enlaces");
    expect(campos).toContain("boletinTexto");
    expect(errores.filter((e) => e.campo === "galeria").map((e) => e.mensaje)).toEqual([
      expect.stringContaining("Foto 1: falta el texto alternativo"),
      expect.stringContaining("Foto 2: la dirección"),
    ]);
  });
});
