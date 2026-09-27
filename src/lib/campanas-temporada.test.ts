import { describe, expect, it } from "bun:test";
import { boletinYTienda, coletillaInstagram, eventosDeTemporada, temporadaDeEventos } from "./campanas-temporada";
import { buildCampanas } from "./campanas";
import type { Appointment, Client, Service } from "./mock/types";

const AHORA = new Date("2026-09-28T09:30:00+02:00");
const svc = (id: string, name: string): Service => ({ id, name, description: "", durationMin: 60, priceEur: 50 });
const carta = [svc("novias", "Novias"), svc("peinar", "Peinar"), svc("color", "Color de cobertura en 10 minutos")];
const clientas: Client[] = ["Ana", "Bea", "Carmen"].map((n, i) => ({ id: `c${i}`, name: `${n} Ruiz`, phone: `+34 600 00 00 0${i}`, createdAt: "2025-01-01" }));
const cita = (clientId: string, serviceId: string, start: string, status: Appointment["status"] = "completed"): Appointment => ({
  id: `${clientId}-${start}`, clientId, clientName: clientId, serviceIds: [serviceId], employeeId: "e", start, duration: 60, priceEur: 50, status,
});

describe("campañas de su realidad (lote P)", () => {
  it("la temporada que toca preparar según el mes", () => {
    expect(temporadaDeEventos(AHORA).titulo).toBe("Bodas de otoño y fiestas de fin de año");
    expect(temporadaDeEventos(new Date(2027, 1, 10)).titulo).toBe("Comuniones y bodas de primavera");
  });

  it("novias y eventos: quien vino a un día señalado y no tiene cita puesta", () => {
    const citas = [
      cita("c0", "novias", "2026-06-13T10:00:00+02:00"),
      cita("c1", "color", "2026-09-01T10:00:00+02:00"),
      cita("c2", "novias", "2026-07-04T10:00:00+02:00"),
      cita("c2", "peinar", "2026-10-03T10:00:00+02:00", "confirmed"),
    ];
    const c = eventosDeTemporada(citas, clientas, carta, "PeluChic", AHORA);
    expect(c?.personas.map((p) => p.nombre)).toEqual(["Ana Ruiz"]);
    expect(c?.mensaje).toContain("bodas de otoño");
    expect(c?.mensaje).not.toMatch(/\d+ ?%/);
  });

  it("sin servicios de evento en la carta, no sale", () => {
    expect(eventosDeTemporada([cita("c1", "color", "2026-09-01T10:00:00+02:00")], clientas, [carta[2]], "X", AHORA)).toBeNull();
  });

  it("boletín y tienda: solo nombra lo que existe, sin prometer descuentos", () => {
    const citas = [cita("c1", "color", "2026-09-20T10:00:00+02:00")];
    const ambos = boletinYTienda(citas, clientas, "PeluChic", {
      boletin: { texto: "Suscríbete", url: "https://peluchic.online/" },
      enlaces: { tienda: "https://peluchic.online/tienda/ols/all" },
    }, AHORA);
    expect(ambos?.titulo).toBe("Tu boletín y tu tienda");
    expect(ambos?.mensaje).toContain("https://peluchic.online/tienda/ols/all");
    expect(ambos?.mensaje).not.toMatch(/%/);
    const soloTienda = boletinYTienda(citas, clientas, "X", { enlaces: { tienda: "https://x.es/tienda" } }, AHORA);
    expect(soloTienda?.titulo).toBe("Tu tienda online");
    expect(soloTienda?.mensaje).not.toContain("boletín");
    expect(boletinYTienda(citas, clientas, "X", undefined, AHORA)).toBeNull();
  });

  it("la reseña invita a etiquetar en Instagram si el salón lo tiene", () => {
    expect(coletillaInstagram({ enlaces: { instagram: "https://www.instagram.com/peluchicprofesional" } })).toContain("instagram.com/peluchicprofesional");
    expect(coletillaInstagram(undefined)).toBe("");
    const citas = [cita("c1", "color", "2026-09-26T10:00:00+02:00")];
    const campanas = buildCampanas({
      appointments: citas, clients: clientas, services: carta, employees: [], salonName: "PeluChic", salonAddress: "Madrid", now: AHORA,
      canales: { enlaces: { instagram: "https://www.instagram.com/peluchicprofesional" } },
    });
    expect(campanas.find((c) => c.id === "resena")?.mensaje).toContain("etiquétanos en Instagram");
  });
});
