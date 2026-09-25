import { describe, expect, test } from "bun:test";
import { idPreguntaNueva, preguntaPorSalud, preguntasAplicables, preguntasDelSalon, preguntasPorDefecto } from "./preguntas-maqueta";

describe("preguntas de reserva", () => {
  test("sin lista, las tres de siempre según los interruptores; con lista, manda la lista aunque esté vacía", () => {
    expect(preguntasDelSalon({}).map((q) => q.id)).toEqual(["hairLength", "hasColor", "recentChemical"]);
    expect(preguntasDelSalon({ bookingQuestionsEnabled: false }).every((q) => !q.activa)).toBe(true);
    expect(preguntasDelSalon({ bookingQuestionsRequired: true }).every((q) => q.obligatoria)).toBe(true);
    expect(preguntasDelSalon({ preguntasReserva: [] })).toEqual([]);
  });
  test("aplicables: activas y de algún servicio elegido, en orden", () => {
    const lista = [...preguntasPorDefecto(), { id: "pregunta1", texto: "¿Para qué evento?", tipo: "texto" as const, obligatoria: true, activa: true, servicios: ["novia"] }];
    lista[0].activa = false;
    expect(preguntasAplicables(lista, ["corte"]).map((q) => q.id)).toEqual(["hasColor", "recentChemical"]);
    expect(preguntasAplicables(lista, ["novia"]).map((q) => q.id)).toEqual(["hasColor", "recentChemical", "pregunta1"]);
  });
  test("id nuevo sin choques y aviso de salud", () => {
    const lista = [...preguntasPorDefecto(), { id: "pregunta1", texto: "x", tipo: "texto" as const, obligatoria: false, activa: true }];
    expect(idPreguntaNueva(lista)).toBe("pregunta2");
    expect(preguntaPorSalud("¿Tienes alguna alergia?")).toBe(true);
    expect(preguntaPorSalud("¿Estás embarazada?")).toBe(true);
    expect(preguntaPorSalud("¿Qué largo de pelo tienes?")).toBe(false);
  });
});
