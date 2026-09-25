import { describe, expect, it } from "bun:test";
import { normalizar, numerosEnCifras, palabras, raiz, raices, sinTildes } from "./normalizar";

describe("normalizar", () => {
  it("minúsculas, sin tildes y la ñ como n", () => {
    expect(sinTildes("¿Cuántas CITAS hay Mañana?")).toBe("¿cuantas citas hay manana?");
  });

  it("quita signos pero conserva horas, fechas y decimales", () => {
    expect(normalizar("¿Qué tengo el 5/10 a las 17:30?")).toBe("que tengo el 5/10 a las 17:30");
    expect(normalizar("¡¡Hola!! ... ¿cuánto es 12,5 €?")).toBe("hola cuanto es 12.5 euros");
  });

  it("expande abreviaturas de chat por palabra entera", () => {
    expect(normalizar("q citas tngo mñn")).toBe("que citas tengo manana");
    expect(normalizar("kien viene hoy xq no lo se")).toBe("quien viene hoy por que no lo se");
    expect(normalizar("tb quiero saber las del finde")).toBe("tambien quiero saber las del fin de semana");
    // «q» dentro de otra palabra no se toca.
    expect(normalizar("quique")).toBe("quique");
  });

  it("números en letras a cifras; «una» se queda", () => {
    expect(normalizar("cuantas citas en los ultimos treinta dias")).toBe("cuantas citas en los ultimos 30 dias");
    expect(normalizar("treinta y cinco euros")).toBe("35 euros");
    expect(normalizar("doscientos cincuenta")).toBe("250");
    expect(normalizar("dentro de dos horas")).toBe("dentro de 2 horas");
    expect(normalizar("una cita")).toBe("una cita");
    expect(numerosEnCifras(["veintitres", "clientas"])).toEqual(["23", "clientas"]);
  });
});

describe("raíz ligera", () => {
  it("plurales y derivados caen juntos", () => {
    expect(raiz("citas")).toBe(raiz("cita"));
    expect(raiz("clientas")).toBe(raiz("clientes"));
    expect(raiz("cancelaciones")).toBe(raiz("cancelacion"));
    expect(raiz("cancelaciones")).toBe(raiz("canceladas"));
    expect(raiz("veces")).toBe("vez");
  });

  it("no toca palabras cortas ni números", () => {
    expect(raiz("hoy")).toBe("hoy");
    expect(raiz("30")).toBe("30");
  });

  it("palabras sin vacías; raíces", () => {
    expect(palabras("¿Me dices qué citas tengo hoy, por favor?")).toEqual(["dices", "citas", "hoy"]);
    expect(raices("clientas que no vienen")).toEqual(["client", "no", "vien"]);
    expect(raiz("vinieron")).toBe("vin");
    expect(raiz("cuestan")).toBe(raiz("cuesta"));
  });
});
