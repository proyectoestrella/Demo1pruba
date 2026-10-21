import { expect, test } from "bun:test";
import { planDelPanel, rutaIncluidaEnPlan } from "./plan-basico";

test("un salón real con plan «reservas» se pinta como Básico", () => {
  expect(planDelPanel({ salonProfile: { plan: "reservas" }, realSalonSlug: "peluchic" })).toBe("reservas");
  expect(planDelPanel({ salonProfile: {}, realSalonSlug: "peluchic" })).toBe("reservas");
});

test("mientras se resuelve el salón (o falla) manda lo más restrictivo", () => {
  for (const status of ["resolviendo", "fallo", "real"]) {
    expect(
      planDelPanel({ salonProfile: {}, realSalonSlug: null, publicBookingResolution: { slug: "peluchic", status } }),
    ).toBe("reservas");
  }
});

test("la demo de ventas sin salón real conserva todo", () => {
  expect(planDelPanel({ salonProfile: {}, realSalonSlug: null })).toBe("todo-incluido");
  expect(
    planDelPanel({ salonProfile: {}, realSalonSlug: null, publicBookingResolution: { slug: "x", status: "demo" } }),
  ).toBe("todo-incluido");
  expect(planDelPanel({ salonProfile: { plan: "reservas" }, realSalonSlug: null })).toBe("reservas");
});

test("el Básico no tiene Caja, Analítica, Marketing ni Lista de espera; los demás sí", () => {
  for (const ruta of ["/app/caja", "/app/insights", "/app/marketing", "/app/waitlist"]) {
    expect(rutaIncluidaEnPlan(ruta, "reservas")).toBe(false);
    expect(rutaIncluidaEnPlan(ruta, "reservas-asistente")).toBe(true);
  }
  expect(rutaIncluidaEnPlan("/app/calendar", "reservas")).toBe(true);
});
