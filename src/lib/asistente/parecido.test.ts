import { describe, expect, it } from "bun:test";
import { canonica, casan, clasificar, damerau, prepararCandidatos, terminos } from "./parecido";

describe("términos canónicos", () => {
  it("sinónimos del salón caen en la misma palabra", () => {
    expect(canonica("clientes")).toBe(canonica("chica"));
    expect(canonica("reservas")).toBe("cita");
    expect(canonica("facturado")).toBe("dinero");
    expect(canonica("caja")).toBe("dinero");
    expect(canonica("balayage")).toBe("mechas");
    expect(canonica("color")).toBe("tinte");
    expect(canonica("fianza")).toBe("senal");
  });

  it("frases del dominio antes de separar palabras", () => {
    expect(terminos("¿Quién no ha venido hoy?")).toEqual(["quien", "planton", "hoy"]);
    expect(terminos("¿hay alguien en la lista de espera?")).toEqual(["alguien", "listaespera"]);
    expect(terminos("citas de la semana que viene")).toEqual(["cita", "semanaproxima"]);
    expect(terminos("cuanto llevo hoy")).toEqual(["dinero", "hoy"]);
  });
});

describe("faltas de ortografía", () => {
  it("Damerau cuenta la transposición como una", () => {
    expect(damerau("cancelacoin", "cancelacion")).toBe(1);
    expect(damerau("mañaan".normalize("NFD").replace(/[̀-ͯ]/g, ""), "manana")).toBe(1);
  });

  it("tolera según la longitud y nunca en palabras cortas", () => {
    expect(casan("ocupacoin", "ocupacion")).toBe(0.8);
    expect(casan("mes", "mas")).toBe(0);
    expect(casan("hoy", "hay")).toBe(0);
    expect(casan("12", "13")).toBe(0);
  });
});

describe("clasificar con umbral y margen", () => {
  const catalogo = prepararCandidatos([
    { id: "citas_hoy", ejemplos: ["cuántas citas tengo hoy", "qué citas hay hoy", "agenda de hoy"] },
    { id: "citas_manana", ejemplos: ["cuántas citas tengo mañana", "qué citas hay mañana", "agenda de mañana"] },
    { id: "ingresos_hoy", ejemplos: ["cuánto he facturado hoy", "cuánto dinero llevo hoy", "caja de hoy"] },
    { id: "plantones", ejemplos: ["quién no ha venido", "cuántos plantones llevo", "clientas que faltaron"] },
    { id: "lista_espera", ejemplos: ["quién está en la lista de espera", "hay alguien esperando hueco"] },
  ]);

  it("acierta con formas distintas, abreviaturas y faltas", () => {
    for (const [q, id] of [
      ["q citas tngo mñn", "citas_manana"],
      ["¿cuantas reservas hay hoy?", "citas_hoy"],
      ["cuanto llevamos de caja hoy", "ingresos_hoy"],
      ["kien falto", "plantones"],
      ["cuantos no shows", "plantones"],
      ["lista de espera", "lista_espera"],
      ["cuantas cistas tengo hoy", "citas_hoy"],
    ] as const) {
      const r = clasificar(q, catalogo);
      expect({ q, r: r.tipo === "acierto" ? r.id : r.tipo }).toEqual({ q, r: id });
    }
  });

  it("si la pregunta no se parece a nada, no responde", () => {
    expect(clasificar("qué tiempo hace en Madrid", catalogo).tipo).toBe("ninguna");
  });

  it("si dos quedan empatadas, pregunta en vez de elegir", () => {
    const r = clasificar("citas", catalogo);
    expect(r.tipo).toBe("dudosa");
    if (r.tipo === "dudosa") expect(r.opciones.map((o) => o.id).sort()).toEqual(["citas_hoy", "citas_manana"]);
  });
});
