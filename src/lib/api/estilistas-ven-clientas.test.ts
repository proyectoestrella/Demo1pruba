/** PeluChic 22-oct: Patricia y Anca (estilistas) con «Ve toda la agenda» ven TODAS las clientas. */
import { describe, expect, it } from "bun:test";
import { recortarDatosPanel } from "./recorte";

const datos = {
  appointments: [{ id: "a1", clientId: "c1", employeeId: "maria", start: "2026-10-28T09:00:00Z", duration: 30, status: "confirmed" }],
  clients: [{ id: "c1", name: "Clienta de María" }, { id: "c2", name: "Clienta sin citas" }],
  waitlist: [],
} as never;

describe("estilistas y clientas", () => {
  it("con «Ve toda la agenda», la estilista ve todas las clientas (también las que no son suyas)", () => {
    const patricia = { tipo: "miembro", userId: "u2", rol: "estilista", employeeId: "patricia", displayName: "Patricia", permisosExtra: { verAgendaCompleta: true } } as never;
    const r = recortarDatosPanel(patricia, datos) as { clients: unknown[] };
    expect(r.clients).toHaveLength(2);
  });
  it("sin ese permiso, solo las suyas", () => {
    const anca = { tipo: "miembro", userId: "u3", rol: "estilista", employeeId: "anca", displayName: "Anca" } as never;
    const r = recortarDatosPanel(anca, datos) as { clients: unknown[] };
    expect(r.clients.length).toBeLessThan(2);
  });
});
