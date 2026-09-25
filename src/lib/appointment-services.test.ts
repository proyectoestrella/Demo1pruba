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
