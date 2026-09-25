import { describe, expect, test } from "bun:test";
import { crearFuentesArena } from "./fuentes-arena";
import { FAMILIAS } from "./catalogo-arena";
import { clients, seedAppointments, seedWaitlist } from "../mock/seed";
import { employees, salon, services } from "../mock/salon";

const ahora = new Date();
const f = crearFuentesArena({ appointments: seedAppointments, clients, services, waitlist: seedWaitlist, salonProfile: salon, equipo: employees, esDemo: true }, ahora);
const mes = { inicio: new Date(ahora.getFullYear(), ahora.getMonth(), 1), fin: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1) };

describe("fuentes del asistente con la demo", () => {
  test("todas las categorías responden sin romperse y con cifras con sentido", () => {
    const c = f.hoy.citasHoy();
    expect(c.total).toBeGreaterThanOrEqual(0);
    expect(c.porProfesional.reduce((s, x) => s + x.citas, 0)).toBe(c.total);
    expect(f.hoy.pendienteDeTi().total).toBeGreaterThanOrEqual(0);
    expect(f.agenda.citasManana().length).toBeGreaterThanOrEqual(0);
    expect(f.clientas.total()).toBe(clients.length);
    expect(f.clientas.mejores(3)).toHaveLength(3);
    expect(f.servicios.carta().length).toBeGreaterThan(0);
    expect(f.dinero.estimacionMes().estimacion).toBe(f.dinero.estimacionMes().cobrado + f.dinero.estimacionMes().previsto);
    expect(Array.isArray(f.senal.pendientes())).toBe(true);
    expect(f.marketing.campanas().length).toBeGreaterThan(0);
    expect(f.configuracion.horarioSalon().dias).toHaveLength(7);
    expect(f.equipo.ocupacionProfesional(mes)).toHaveLength(employees.length);
  });
  test("la clienta se resuelve por nombre y su ficha tiene datos", () => {
    const [c] = f.entidades.clientas(clients[0].name.split(" ")[0]);
    expect(c).toBeDefined();
    expect(f.clientas.datos(c.id)?.telefono).toBe(c.phone);
  });
  test("el catálogo cubre las diez categorías y cada familia tiene 6 ejemplos o más", () => {
    expect(new Set(FAMILIAS.map((x) => x.categoria)).size).toBe(10);
    expect(FAMILIAS.every((x) => x.ejemplos.length >= 6)).toBe(true);
    expect(FAMILIAS).toHaveLength(84);
  });
});
