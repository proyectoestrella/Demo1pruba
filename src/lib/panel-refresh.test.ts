import { expect, it } from "bun:test";
import { debeAplazarRefresco, haceCuanto } from "./panel-refresh";

it("aplaza la lectura si la pestaña está oculta o hay una edición o subida", () => {
  expect(debeAplazarRefresco(false, false, false)).toBe(true);
  expect(debeAplazarRefresco(true, true, false)).toBe(true);
  expect(debeAplazarRefresco(true, false, true)).toBe(true);
  expect(debeAplazarRefresco(true, false, false)).toBe(false);
});

it("expresa la edad del último refresco en lenguaje breve", () => {
  expect(haceCuanto(0, 90_000)).toBe("hace 1 min");
});
