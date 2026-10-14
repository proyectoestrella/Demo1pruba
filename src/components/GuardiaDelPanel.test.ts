import { expect, test } from "bun:test";
import { estadoInicialGuardia } from "./GuardiaDelPanel";

test("la puerta del panel empieza igual al renderizar en servidor y navegador", () => {
  // La caché de acceso solo existe en el navegador: leerla durante el render
  // haría que el primer árbol hidratado no coincidiera con el del servidor.
  expect(estadoInicialGuardia()).toBe("comprobando");
});
