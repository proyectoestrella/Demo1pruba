import { describe, expect, it } from "bun:test";
import type { Appointment, Client, WaitlistEntry } from "../mock/types";
import type { Acceso } from "./autorizacion";
import { recortarDatosPanel } from "./recorte";

const cita = (id: string, employeeId: string, clientId: string, status = "confirmed"): Appointment =>
  ({ id, employeeId, clientId, clientName: `Clienta ${clientId}`, serviceIds: ["tinte"], start: "2026-09-25T10:00:00Z", duration: 60, priceEur: 35, status, paidAt: "x" }) as Appointment;
const datos = {
  appointments: [cita("a1", "noelia", "c1"), cita("a2", "sara", "c2"), cita("a3", "sara", "c3", "cancelled")],
  clients: [{ id: "c1", name: "Lucía", phone: "1", notes: "usa el 8" }, { id: "c2", name: "Marta", phone: "2" }, { id: "c3", name: "Elena", phone: "3" }] as Client[],
  waitlist: [{ id: "w1", clientName: "Paula" }] as WaitlistEntry[],
};
const miembro = (rol: "gerente" | "estilista" | "recepcion", employeeId: string | null = null): Acceso => ({ tipo: "miembro", userId: "u", rol, employeeId, displayName: null });

describe("recorte de datos por rol", () => {
  it("gerente y demo: todo tal cual", () => {
    expect(recortarDatosPanel(miembro("gerente"), datos)).toEqual(datos);
    expect(recortarDatosPanel({ tipo: "demo" }, datos)).toEqual(datos);
  });

  it("estilista: sus citas completas; las de otras como bloque ocupado sin clienta ni precio", () => {
    const r = recortarDatosPanel(miembro("estilista", "noelia"), datos);
    const suya = r.appointments.find((a) => a.id === "a1")!;
    expect(suya.clientName).toBe("Clienta c1");
    const ajena = r.appointments.find((a) => a.id === "a2")!;
    expect(ajena.bloqueOcupado).toBe(true);
    expect([ajena.clientName, ajena.clientId, ajena.priceEur, ajena.serviceIds.length, (ajena as { paidAt?: string }).paidAt]).toEqual(["", "", 0, 0, undefined]);
    expect(JSON.stringify(r.appointments)).not.toContain("c2");
    // La cancelada ajena no se manda.
    expect(r.appointments.some((a) => a.id === "a3")).toBe(false);
  });

  it("estilista: solo sus clientas y sin lista de espera", () => {
    const r = recortarDatosPanel(miembro("estilista", "noelia"), datos);
    expect(r.clients.map((c) => c.id)).toEqual(["c1"]);
    expect(r.waitlist).toEqual([]);
  });

  it("estilista sin profesional vinculada: nada suyo, todo como ocupado", () => {
    const r = recortarDatosPanel(miembro("estilista", null), datos);
    expect(r.appointments.every((a) => a.bloqueOcupado)).toBe(true);
    expect(r.clients).toEqual([]);
  });

  it("recepción: ve todas las citas y clientas y la lista de espera", () => {
    const r = recortarDatosPanel(miembro("recepcion"), datos);
    expect(r.appointments.length).toBe(3);
    expect(r.clients.length).toBe(3);
    expect(r.waitlist.length).toBe(1);
  });

  it("ajeno: nada", () => {
    expect(recortarDatosPanel({ tipo: "ajeno" }, datos)).toEqual({ appointments: [], clients: [], waitlist: [] });
  });
});
