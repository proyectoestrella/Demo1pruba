import { expect, test } from "bun:test";
import { rutaSoloCompleto, usaTpv123 } from "./plan-basico";

test("el Básico no expone las rutas fuera del Anexo I", () => {
  for (const ruta of ["/app/caja", "/app/marketing", "/app/insights", "/app/waitlist", "/app/demos"]) {
    expect(rutaSoloCompleto(ruta)).toBe(true);
  }
  expect(rutaSoloCompleto("/app/calendar")).toBe(false);
});

test("TPV 123 solo se nombra cuando el salón confirmó ese origen", () => {
  expect(usaTpv123({ clientImportOrigin: "tpv123" })).toBe(true);
  expect(usaTpv123({})).toBe(false);
});
