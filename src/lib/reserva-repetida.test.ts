import { expect, test } from "bun:test";
import { ultimaReservaEsRepetible } from "./reserva-repetida";

test("repetir la última cita no ofrece una profesional que ya no hace todos los servicios", () => {
  const cita = { employeeId: "maria", serviceIds: ["corte", "color"] };
  expect(ultimaReservaEsRepetible(cita, { corte: {}, color: {} }, ["maria"], { maria: ["corte"] })).toBe(false);
  expect(ultimaReservaEsRepetible(cita, { corte: {}, color: {} }, ["maria"], { maria: ["corte", "color"] })).toBe(true);
});
