import { describe, expect, it } from "bun:test";
import { faqPublica } from "./faq";

describe("FAQ pública sin recargo", () => {
  const propias = [
    "¿Hay recargo?~Sí, 7 € por plantón",
    "¿Cómo va la señal?~Se pide por Bizum y se descuenta del servicio",
  ];

  it("oculta la pregunta de penalización y conserva la señal", () => {
    expect(faqPublica("peluqueria", 0, 2, propias)).toEqual([
      { q: "¿Cómo va la señal?", a: "Se pide por Bizum y se descuenta del servicio" },
    ]);
  });

  it("con recargo activo mantiene las preguntas propias", () => {
    expect(faqPublica("peluqueria", 7, 2, propias)).toHaveLength(2);
  });
});
