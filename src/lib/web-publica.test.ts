import { describe, expect, test } from "bun:test";
import { listaConY, notaEs } from "./web-publica";

describe("web pública", () => {
  test("lista con «y» antes del último", () => {
    expect(listaConY(["novias", "madrinas", "eventos"])).toBe("novias, madrinas y eventos");
    expect(listaConY(["color"])).toBe("color");
    expect(listaConY([" ", ""])).toBe("");
  });
  test("nota con coma decimal", () => {
    expect(notaEs(4.5)).toBe("4,5");
    expect(notaEs(5)).toBe("5");
  });
});
