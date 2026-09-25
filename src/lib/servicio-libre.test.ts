/**
 * Servicios libres de una sola cita (`libre:<nombre>`, lote 9g de FRONTEND)
 * en las piezas de BACKEND: ficha, CSV, estadística por servicio y
 * recordatorio. Nunca debe verse el id en bruto.
 */
import { describe, expect, it } from "bun:test";
import { idServicioLibre, nombreServicioLibre } from "./appointment-services";
import { serviceMix } from "./derive";
import { citasToCsv } from "./export-csv";
import { fichaDeClienta } from "./ficha-clienta";
import { serviceMap } from "./mock/salon";
import type { Appointment } from "./mock/types";

const libre = idServicioLibre("Mechas raras, de las caras");
const conocido = Object.values(serviceMap)[0];
const cita = (extra: Partial<Appointment> = {}): Appointment => ({
  id: "a-1", clientId: "c-1", clientName: "Ana", serviceIds: [libre], employeeId: "mario",
  start: "2026-09-20T08:00:00.000Z", duration: 60, priceEur: 50, status: "completed", ...extra,
});

describe("servicios libres en BACKEND", () => {
  it("el id no lleva comas y el nombre se recupera", () => {
    expect(libre).toBe("libre:Mechas raras de las caras");
    expect(nombreServicioLibre(libre)).toBe("Mechas raras de las caras");
    expect(nombreServicioLibre(conocido.id)).toBeNull();
  });

  it("la ficha de la clienta enseña el nombre, no «libre:…»", () => {
    const ficha = fichaDeClienta("c-1", { clientes: [{ id: "c-1", name: "Ana", phone: "600", createdAt: "2026-01-01T00:00:00.000Z" }], citas: [cita()], servicios: [], equipo: [], ahora: new Date("2026-09-25T10:00:00.000Z") } as never);
    expect(JSON.stringify(ficha)).toContain("Mechas raras de las caras");
    expect(JSON.stringify(ficha)).not.toContain("libre:");
  });

  it("el CSV exporta el nombre", () => {
    const csv = citasToCsv([cita()], {}, {});
    expect(csv).toContain("Mechas raras de las caras");
    expect(csv).not.toContain("libre:");
  });

  it("la estadística por servicio incluye los libres y la suma cuadra con el total", () => {
    const mix = serviceMix([
      cita(),
      cita({ id: "a-2", priceEur: 40 }),
      cita({ id: "a-3", serviceIds: [conocido.id, libre], priceEur: conocido.priceEur + 30 }),
    ]);
    const fila = mix.find((m) => m.name === "Mechas raras de las caras")!;
    expect(fila.bookings).toBe(3);
    expect(fila.revenue).toBe(50 + 40 + 30);
    expect(mix.find((m) => m.name === conocido.name)!.revenue).toBe(conocido.priceEur);
    expect(mix.reduce((s, m) => s + m.revenue, 0)).toBe(50 + 40 + conocido.priceEur + 30);
  });
});
