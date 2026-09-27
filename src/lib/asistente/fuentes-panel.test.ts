import { describe, expect, test } from "bun:test";
import { crearFuentesPanel } from "./fuentes-panel";
import type { FuentesAsistente } from "./fuentes";
import { clients, seedAppointments, seedWaitlist } from "../mock/seed";
import { employees, salon, services } from "../mock/salon";
import type { Appointment, Client } from "../mock/types";

const estado = { appointments: seedAppointments, clients, services, waitlist: seedWaitlist, salonProfile: salon, realSalonSlug: null };
const f: FuentesAsistente = crearFuentesPanel(() => estado, () => employees, { enlace: () => "https://sishow.app/s/demo" });

// Fixtura propia (barrido 27-sep): una clienta con observaciones reales y una
// visita con nota técnica, para el bug «de X no tienes nada apuntado» aunque
// la ficha sí tuviera algo — ver resolutores/clientas.ts § notasClienta.
const clientaConNotas: Client = { id: "zz-elena", name: "Elena de Prueba", phone: "600 000 111", createdAt: "2025-01-01", notes: "Usa el número 8" };
const citaConNotaTecnica: Appointment = {
  id: "zz-cita-1", clientId: clientaConNotas.id, clientName: clientaConNotas.name,
  serviceIds: [services[0].id], employeeId: employees[0].id, start: "2026-05-28T10:00:00Z",
  duration: 60, priceEur: 40, status: "completed", colorFormula: "Mechas finas, oxidante 20 vol",
  technicalNotes: "Dejar libre el contorno; comprobar elasticidad.",
};
const estadoConNotas = {
  appointments: [...seedAppointments, citaConNotaTecnica],
  clients: [...clients, clientaConNotas],
  services, waitlist: seedWaitlist, salonProfile: salon, realSalonSlug: null,
};
const fConNotas: FuentesAsistente = crearFuentesPanel(() => estadoConNotas, () => employees, {});
const hoy = new Date();
const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

describe("adaptador a FuentesAsistente de BACKEND", () => {
  test("estado y ficha con los tipos de la interfaz", () => {
    const e = f.estado();
    expect(e.citas.length).toBe(seedAppointments.length);
    expect(e.equipo.every((p) => p.id && p.name)).toBe(true);
    const ficha = f.fichaClienta(clients[0].id)!;
    expect(ficha.gastoTotal).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(ficha.visitas)).toBe(true);
    expect(f.fichaClienta("no-existe")).toBeNull();
  });
  test("agenda: huecos, jornada y horario en su formato", () => {
    const h = f.huecos(dia) ?? [];
    expect(h.every((x) => x.minutos >= 30 && +new Date(x.hasta) > +new Date(x.desde))).toBe(true);
    const j = f.jornada(employees[0].id, dia);
    expect(j?.franjas.every((x) => /^\d{2}:\d{2}$/.test(x.desde))).toBe(true);
    expect(typeof f.horarioResumen()).toBe("string");
  });
  test("configuración, señal y marketing responden sin inventar", () => {
    expect(f.enlaceReservas()).toBe("https://sishow.app/s/demo");
    expect(f.senal.regla()?.activa).toBe(false);
    // «Barbería Pepe» es una barbería: las tres preguntas de siempre solo se
    // activan por defecto en peluquería/unisex (preguntas-reserva.ts), igual
    // que en la reserva pública real — aquí no hay ninguna que inventar.
    expect(f.preguntasReserva()).toEqual([]);
    expect(f.marketing.campanas()?.length).toBeGreaterThan(0);
    const franja = f.marketing.franjaFloja();
    if (franja) expect(franja.pct).toBeGreaterThanOrEqual(0);
  });
  test("ficha: las observaciones no salen dos veces y la nota técnica de la visita llega al asistente", () => {
    const ficha = fConNotas.fichaClienta(clientaConNotas.id)!;
    // Antes: `avisos` traía «Observaciones: Usa el número 8» Y el resolutor
    // volvía a añadir `Client.notes` crudo aparte → el texto salía dos veces.
    expect(ficha.avisos.some((a) => a.startsWith("Observaciones:"))).toBe(false);
    expect(ficha.ultimoColor?.formula).toBe("Mechas finas, oxidante 20 vol");
    expect(ficha.ultimaNotaTecnica?.texto).toBe("Dejar libre el contorno; comprobar elasticidad.");
  });
});
