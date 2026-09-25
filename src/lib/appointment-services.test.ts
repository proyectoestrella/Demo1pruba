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
