import { describe, expect, it } from "bun:test";
import { profesionalHaceServicios, profesionalesParaServicios } from "./servicios-profesional";
import type { Employee } from "./mock/types";

const equipo = [
  { id: "ana", name: "Ana" },
  { id: "bea", name: "Bea" },
  { id: "cora", name: "Cora" },
] as Employee[];

describe("servicios por profesional", () => {
  const mapa = { ana: ["corte", "color"], bea: ["corte"], cora: [] };

  it("una lista ausente o vacía conserva que hace todos los servicios", () => {
    expect(profesionalHaceServicios("cora", ["facial"], mapa)).toBe(true);
    expect(profesionalHaceServicios("nadie", ["facial"], mapa)).toBe(true);
  });

  it("solo deja elegir a quien hace todos los servicios de la reserva", () => {
    expect(profesionalesParaServicios(equipo, ["corte", "color"], mapa).map((e) => e.id)).toEqual(["ana", "cora"]);
    expect(profesionalesParaServicios(equipo, ["color", "facial"], mapa).map((e) => e.id)).toEqual(["cora"]);
  });
});
