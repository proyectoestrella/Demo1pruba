import { expect, test } from "bun:test";
import { estadoInicialReservaPublica } from "./hidratacion";

test("la reserva pública comienza resolviendo antes de leer estado del navegador", () => {
  // Un resultado guardado en localStorage puede existir solo en el cliente;
  // el servidor y el primer render hidratado deben usar este mismo valor.
  expect(estadoInicialReservaPublica()).toBe("resolviendo");
});
