import { describe, expect, it } from "bun:test";

import { fusionarPerfil } from "./perfil-parche";

/**
 * La garantía del arreglo: un campo que este navegador NO ha tocado no puede
 * volver atrás por culpa de lo que este navegador creía que valía.
 */
describe("fusionarPerfil", () => {
  it("un campo que no viene en el parche se queda con el valor del servidor", () => {
    const servidor = { name: "The Best Shave", phone: "600 999 888", tagline: "Barbería" };
    // El iPad lleva abierto desde ayer y solo toca el horario.
    const fusionado = fusionarPerfil(servidor, { openingHours: ["L-V 10-20"] });
    // El teléfono que se cambió desde el móvil sigue siendo el nuevo.
    expect(fusionado.phone).toBe("600 999 888");
    expect(fusionado.openingHours).toEqual(["L-V 10-20"]);
    expect(fusionado.name).toBe("The Best Shave");
  });

  it("lo que sí viene en el parche pisa al servidor", () => {
    expect(fusionarPerfil({ phone: "viejo" }, { phone: "nuevo" }).phone).toBe("nuevo");
  });

  it("un array del parche gana entero: borrar un servicio tiene que poder borrarse", () => {
    const servidor = { menu: [{ id: "corte" }, { id: "barba" }] };
    const fusionado = fusionarPerfil(servidor, { menu: [{ id: "corte" }] });
    expect(fusionado.menu).toEqual([{ id: "corte" }]);
  });

  it("undefined es «no tocar»; null es «vaciar a propósito»", () => {
    const servidor = { instagram: "@best", nota: 4.8 };
    const fusionado = fusionarPerfil(servidor, { instagram: undefined, nota: null });
    expect(fusionado.instagram).toBe("@best");
    expect(fusionado.nota).toBeNull();
  });

  it("no muta el objeto del servidor", () => {
    const servidor = { phone: "600" };
    fusionarPerfil(servidor, { phone: "700" });
    expect(servidor.phone).toBe("600");
  });

  it("un parche vacío deja el perfil exactamente igual", () => {
    const servidor = { a: 1, b: [2], c: { d: 3 } };
    expect(fusionarPerfil(servidor, {})).toEqual(servidor);
  });
});
