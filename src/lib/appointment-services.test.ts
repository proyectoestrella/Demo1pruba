import { describe, expect, it } from "bun:test";
import { serviceLabelOf, textoPrecioServicio, textoTotalServicios } from "./appointment-services";

describe("serviceLabelOf", () => {
  it("con la carta viva del panel dice el nombre actual; sin ella cae al catálogo de ejemplo", () => {
    const cita = { serviceIds: ["corte-y-peinado"] };
    const carta = { "corte-y-peinado": { id: "corte-y-peinado", name: "Corte, lavado y peinado", description: "", durationMin: 45, priceEur: 25 } };
    expect(serviceLabelOf(cita, carta)).toBe("Corte, lavado y peinado");
    expect(serviceLabelOf(cita)).not.toBe("Corte, lavado y peinado");
  });
});

import { describe as describeLibre, expect as expectLibre, test as testLibre } from "bun:test";
import { idServicioLibre, nombreServicioLibre, serviceLabelOf as etiquetaDe } from "./appointment-services";

describeLibre("servicio libre de una cita («Otro…»)", () => {
  testLibre("se guarda como libre:<nombre> sin comas y se lee con su nombre", () => {
    const id = idServicioLibre("  Recogido, trenza  y flores ");
    expectLibre(id).toBe("libre:Recogido trenza y flores");
    expectLibre(nombreServicioLibre(id)).toBe("Recogido trenza y flores");
    expectLibre(nombreServicioLibre("svc-1")).toBeNull();
    expectLibre(etiquetaDe({ serviceIds: [id] }, {})).toBe("Recogido trenza y flores");
  });
});

const eur = (importe: number) => `${importe.toFixed(2).replace(".", ",")} €`;

describe("precios de Nueva cita", () => {
  it("muestra el literal cuando un servicio sin precio necesita diagnóstico", () => {
    const aDefinir = { priceEur: 0, priceText: "A definir, con diagnóstico" };
    expect(textoPrecioServicio(aDefinir, eur)).toBe("A definir, con diagnóstico");
    expect(textoTotalServicios([aDefinir], 0, eur)).toBe("A definir");
  });

  it("mantiene el precio numérico en los servicios normales", () => {
    const normal = { priceEur: 28.5, priceText: "28,50 € / 35 €" };
    expect(textoPrecioServicio(normal, eur)).toBe("28,50 €");
    expect(textoTotalServicios([normal], 28.5, eur)).toBe("28,50 €");
  });
});

import { lavadoYaIncluido, sumServices as sumar } from "./appointment-services";

describe("lavado incluido en otros servicios (Color de PeluChic)", () => {
  const sv = (id: string, durationMin: number, priceEur: number) => ({ id, name: id, description: "", durationMin, priceEur });
  const lavado = sv("lavado", 15, 10);
  const color = sv("color", 75, 40);
  const corte = sv("corte", 30, 20);
  const cfg = { servicioId: "lavado", incluidoEn: ["color"] };

  it("sin configurar, todo suma como siempre", () => {
    expect(sumar([color, lavado])).toEqual({ durationMin: 90, priceEur: 50 });
  });
  it("Color + lavado suelto: el lavado no cobra ni alarga la cita", () => {
    expect(sumar([color, lavado], cfg)).toEqual({ durationMin: 75, priceEur: 40 });
  });
  it("lavado con un servicio que no lo incluye: se cobra", () => {
    expect(sumar([corte, lavado], cfg)).toEqual({ durationMin: 45, priceEur: 30 });
  });
  it("lavado solo: se cobra; sin lavado en la cita, nada cambia", () => {
    expect(sumar([lavado], cfg)).toEqual({ durationMin: 15, priceEur: 10 });
    expect(sumar([color, corte], cfg)).toEqual({ durationMin: 105, priceEur: 60 });
  });
  it("lavadoYaIncluido ignora configuraciones vacías", () => {
    expect(lavadoYaIncluido(["color", "lavado"], undefined)).toBe(false);
    expect(lavadoYaIncluido(["color", "lavado"], { servicioId: "lavado", incluidoEn: [] })).toBe(false);
    expect(lavadoYaIncluido(["color", "lavado"], cfg)).toBe(true);
  });
});
