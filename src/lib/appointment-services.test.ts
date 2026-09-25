import { describe, expect, it } from "bun:test";
import { serviceLabelOf } from "./appointment-services";

describe("serviceLabelOf", () => {
  it("con la carta viva del panel dice el nombre actual; sin ella cae al catálogo de ejemplo", () => {
    const cita = { serviceIds: ["corte-y-peinado"] };
    const carta = { "corte-y-peinado": { id: "corte-y-peinado", name: "Corte, lavado y peinado", description: "", durationMin: 45, priceEur: 25 } };
    expect(serviceLabelOf(cita, carta)).toBe("Corte, lavado y peinado");
    expect(serviceLabelOf(cita)).not.toBe("Corte, lavado y peinado");
  });
});
