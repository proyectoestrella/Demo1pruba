import { describe, expect, it } from "bun:test";
import { profesionalHaceServicios, profesionalesParaServicios, resumenCambioServicios, citasFuturasAfectadas, mapaServiciosTrasGuardar } from "./servicios-profesional";
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

describe("edición en lote de servicios", () => {
  it("resume los cambios como +N / −M", () => {
    expect(resumenCambioServicios(["a", "b"], ["a", "b"])).toMatchObject({ hayCambios: false, texto: "Sin cambios" });
    expect(resumenCambioServicios(["a", "b"], ["b", "c", "d", "e"])).toMatchObject({ añadidos: ["c", "d", "e"], quitados: ["a"], texto: "+3 / −1", hayCambios: true });
    expect(resumenCambioServicios(["a", "b"], ["a"]).texto).toBe("−1");
  });
  const ahora = new Date("2026-10-14T10:00:00");
  const citas = [
    { id: "1", employeeId: "ana", start: "2026-10-15T10:00:00", status: "confirmed", serviceIds: ["corte"] },
    { id: "2", employeeId: "ana", start: "2026-10-10T10:00:00", status: "completed", serviceIds: ["corte"] },
    { id: "3", employeeId: "ana", start: "2026-10-16T10:00:00", status: "cancelled", serviceIds: ["corte"] },
    { id: "4", employeeId: "bea", start: "2026-10-15T10:00:00", status: "confirmed", serviceIds: ["corte"] },
    { id: "5", employeeId: "ana", start: "2026-10-17T10:00:00", status: "pending", serviceIds: ["color", "corte"] },
    { id: "6", employeeId: "ana", start: "2026-10-18T10:00:00", status: "confirmed", serviceIds: ["facial"] },
  ];
  it("avisa solo de citas futuras, vivas y de esa profesional con el servicio quitado", () => {
    expect(citasFuturasAfectadas(["corte"], citas, "ana", ahora).map((c) => c.id)).toEqual(["1", "5"]);
    expect(citasFuturasAfectadas([], citas, "ana", ahora)).toEqual([]);
    expect(citasFuturasAfectadas(["peinado"], citas, "ana", ahora)).toEqual([]);
  });
  it("marcar toda la carta borra la entrada; el resto la guarda", () => {
    const carta = ["corte", "color", "facial"];
    expect(mapaServiciosTrasGuardar({ ana: ["corte"] }, "ana", carta, carta)).toBeUndefined();
    expect(mapaServiciosTrasGuardar(undefined, "ana", ["corte", "x"], carta)).toEqual({ ana: ["corte"] });
    expect(mapaServiciosTrasGuardar({ bea: ["color"] }, "ana", carta, carta)).toEqual({ bea: ["color"] });
  });
});
