import { describe, expect, test } from "bun:test";
import { apartadoGuia, guiaAsistente } from "./guia";
import { INTENCIONES } from "./intenciones";

describe("guía del asistente", () => {
  test("no anuncia funciones fuera de plan ni dudas técnicas", () => {
    const ejemplos = new Set(guiaAsistente(50).flatMap((t) => t.ejemplos));
    for (const i of INTENCIONES.filter((x) => x.grupo === "plan" || x.grupo === "tecnica")) expect(ejemplos.has(`¿${i.pregunta.replace(/^¿|\?$/g, "")}?`)).toBe(false);
    expect(guiaAsistente().map((t) => t.id)).toEqual(["hoy", "agenda", "clientas", "equipo", "servicios", "dinero", "senal", "marketing", "configuracion"]);
  });
  test("los ejemplos son preguntas con signos y tildes", () => {
    for (const t of guiaAsistente()) for (const e of t.ejemplos) expect(e).toMatch(/^¿.+\?$/);
  });
  test("apartados con su título", () => {
    expect(apartadoGuia("§6 y §8")).toBe("§6 Equipo y §8 Mi página de reservas");
    expect(apartadoGuia("§0")).toBe("§0 Antes de empezar");
    expect(apartadoGuia(null)).toBeNull();
  });
});
