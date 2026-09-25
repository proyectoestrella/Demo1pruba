import { describe, expect, test } from "bun:test";
import { crearFuentesPanel } from "./fuentes-panel";
import type { FuentesAsistente } from "./fuentes";
import { clients, seedAppointments, seedWaitlist } from "../mock/seed";
import { employees, salon, services } from "../mock/salon";

const estado = { appointments: seedAppointments, clients, services, waitlist: seedWaitlist, salonProfile: salon, realSalonSlug: null };
const f: FuentesAsistente = crearFuentesPanel(() => estado, () => employees, { enlace: () => "https://sishow.app/s/demo" });
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
});
