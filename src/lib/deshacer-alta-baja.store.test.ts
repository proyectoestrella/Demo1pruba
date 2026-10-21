/**
 * Deshacer altas y bajas (citas, fichas, servicios) y la edición completa de la
 * ficha: crear → deshacer borra; borrar → deshacer restaura (si el hueco sigue
 * libre); ningún campo de la ficha queda fuera; las importaciones masivas, sí.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { conRegistroEnPausa, useSalonStore } from "./store";
import { actualDesdeServidor, conflictoConServidor, type Cambio } from "./cambios";
import type { Appointment, Client } from "./mock/types";

const st = () => useSalonStore.getState();
const ultimo = () => st().cambios[0];
const base = { clientId: "c-ab", clientName: "Lucía Prueba", serviceIds: ["corte"], employeeId: "mario", start: "2026-11-03T08:00:00.000Z", duration: 30, priceEur: 20, status: "confirmed" } as Omit<Appointment, "id">;
const gerente = () => useSalonStore.setState({ miembro: { userId: "g", rol: "gerente", employeeId: null, displayName: "Gerente" } });

beforeEach(() => useSalonStore.setState({ cambios: [], miembro: null, appointments: [], clients: [] }));

describe("citas: crear y borrar", () => {
  it("crear se registra y deshacer la borra; si cambió después, avisa", () => {
    const a = st().addAppointment(base);
    const c = ultimo();
    expect(c.tipo).toBe("cita.crear");
    expect(c.resumen).toContain("Cita de Lucía guardada");
    expect(st().deshacerCambio(c.id)).toEqual({ ok: true });
    expect(st().appointments.find((x) => x.id === a.id)).toBeUndefined();

    const b = st().addAppointment(base);
    const c2 = ultimo();
    st().updateAppointment(b.id, { start: "2026-11-03T09:00:00.000Z" });
    expect(st().deshacerCambio(c2.id)).toEqual({ ok: false, motivo: "CAMBIADO" });
    expect(st().appointments.some((x) => x.id === b.id)).toBe(true);
  });

  it("borrar se registra y deshacer restaura la cita entera; si el hueco está ocupado, SOLAPE", () => {
    const a = st().addAppointment(base);
    st().deleteAppointment(a.id);
    const c = ultimo();
    expect(c.tipo).toBe("cita.borrar");
    expect(st().appointments).toHaveLength(0);
    // Otra cita ocupa el hueco: no se pisa.
    const otra = st().addAppointment({ ...base, clientName: "Otra" });
    expect(st().deshacerCambio(c.id)).toEqual({ ok: false, motivo: "SOLAPE" });
    conRegistroEnPausa(() => st().deleteAppointment(otra.id));
    expect(st().deshacerCambio(c.id)).toEqual({ ok: true });
    expect(st().appointments.find((x) => x.id === a.id)).toMatchObject({ clientName: "Lucía Prueba", start: base.start });
  });

  it("borrar algo que no existe no deja cambio", () => {
    st().deleteAppointment("no-existe");
    expect(st().cambios).toHaveLength(0);
  });
});

describe("clientas: crear, borrar y editar cualquier campo", () => {
  const nueva = () => st().addClient({ name: "Ana Ficha", phone: "600111222", email: "ana@x.es", notes: "n1", birthday: "1990-05-01" } as never);

  it("crear se registra y deshacer borra la ficha", () => {
    const cl = nueva();
    expect(ultimo().tipo).toBe("clienta.crear");
    expect(st().deshacerCambio(ultimo().id)).toEqual({ ok: true });
    expect(st().clients.find((x) => x.id === cl.id)).toBeUndefined();
  });

  it("borrar se registra y deshacer restaura la ficha con todos sus datos", () => {
    const cl = nueva();
    conRegistroEnPausa(() => undefined);
    st().deleteClient(cl.id);
    const c = ultimo();
    expect(c.tipo).toBe("clienta.borrar");
    expect(st().clients).toHaveLength(0);
    expect(st().deshacerCambio(c.id)).toEqual({ ok: true });
    expect(st().clients.find((x) => x.id === cl.id)).toMatchObject({ name: "Ana Ficha", phone: "600111222", email: "ana@x.es", notes: "n1", birthday: "1990-05-01" });
  });

  it.each([
    ["name", "Ana Nueva"], ["phone", "611000111"], ["email", "otra@x.es"], ["notes", "n2"], ["birthday", "1991-06-02"], ["address", "Calle 1"], ["taxId", "X123"],
  ] as Array<[keyof Client, string]>)("editar %s se registra y se deshace", (campo, valor) => {
    const cl = nueva();
    const antes = (st().clients.find((x) => x.id === cl.id) as Record<string, unknown>)[campo as string];
    st().updateClient(cl.id, { [campo]: valor } as Partial<Client>);
    const c = ultimo();
    expect(c.tipo).toBe("clienta.editar");
    expect(c.despues).toEqual({ [campo]: valor });
    expect(st().deshacerCambio(c.id)).toEqual({ ok: true });
    expect((st().clients.find((x) => x.id === cl.id) as Record<string, unknown>)[campo as string] ?? null).toBe(antes ?? null);
  });

  it("una importación masiva (en pausa) no deja cambios", () => {
    conRegistroEnPausa(() => {
      const cl = nueva();
      st().updateClient(cl.id, { taxId: "Y1", name: "Cambiada" });
    });
    expect(st().cambios).toHaveLength(0);
  });
});

describe("servicios: crear", () => {
  it("crear un servicio se registra y deshacer lo quita de la carta", () => {
    const s = st().addService({ name: "Servicio Nuevo Test", description: "", durationMin: 20, priceEur: 10, active: true });
    const c = ultimo();
    expect(c.tipo).toBe("servicio.crear");
    expect(c.resumen).toContain("Creado el servicio");
    expect(st().deshacerCambio(c.id)).toEqual({ ok: true });
    expect(st().services.some((x) => x.id === s.id)).toBe(false);
  });
});

describe("equipo y horarios (perfil)", () => {
  it("cambiar el equipo y el horario del equipo deja un cambio por campo, deshacible", () => {
    gerente();
    const horas = { ...(st().salonProfile.teamHours ?? {}), mario: [{ day: 1, open: "09:00", close: "13:00" }] } as never;
    st().updateSalonProfile({ teamHours: horas });
    const c = ultimo();
    expect(c).toMatchObject({ tipo: "perfil.campo", idEntidad: "teamHours" });
    expect(c.resumen).toContain("horario del equipo");
    expect(st().deshacerCambio(c.id)).toEqual({ ok: true });
  });
});

describe("conflicto real con el servidor", () => {
  const cambio = (p: Partial<Cambio>): Cambio => ({ id: "x", tipo: "cita.cancelar", entidad: "cita", idEntidad: "a1", antes: { status: "confirmed" }, despues: { status: "cancelled" }, resumen: "", autor: "g", autorNombre: "g", fecha: new Date().toISOString(), avisoEnviado: false, ...p });
  it("sin respuesta del servidor no hay conflicto que afirmar", () => {
    expect(conflictoConServidor(cambio({}), undefined)).toBe(false);
  });
  it("el servidor ya no tiene lo que dejó el cambio: conflicto", () => {
    expect(conflictoConServidor(cambio({}), { existe: true, valor: { status: "confirmed" } })).toBe(true);
    expect(conflictoConServidor(cambio({}), { existe: true, valor: { status: "cancelled" } })).toBe(false);
    expect(conflictoConServidor(cambio({}), { existe: false, valor: null })).toBe(true);
  });
  it("alta de cita: sigue igual si no la tocaron; cambiada o ya borrada es conflicto", () => {
    const foto = { clientName: "Lucía", start: "2026-11-03T08:00:00.000Z", duration: 30, status: "confirmed" };
    const c = cambio({ tipo: "cita.crear", antes: { cita: null }, despues: { cita: foto } });
    expect(conflictoConServidor(c, { existe: true, valor: { ...foto, updatedAt: "x" } })).toBe(false);
    expect(conflictoConServidor(c, { existe: true, valor: { ...foto, start: "2026-11-03T09:00:00.000Z" } })).toBe(true);
    expect(conflictoConServidor(c, { existe: false, valor: null })).toBe(true);
  });
  it("baja de ficha: ya no existe = sin conflicto; si reapareció, conflicto", () => {
    const c = cambio({ tipo: "clienta.borrar", entidad: "clienta", antes: { clienta: { name: "Ana" } }, despues: { clienta: null } });
    expect(conflictoConServidor(c, { existe: false, valor: null })).toBe(false);
    expect(conflictoConServidor(c, { existe: true, valor: { name: "Ana" } })).toBe(true);
    expect(actualDesdeServidor(c, { existe: false, valor: null })).toEqual({ clienta: null });
  });
  it("cargarEntidadDelServidor mete en la store la cita que este navegador no tenía", () => {
    const c = cambio({});
    st().cargarEntidadDelServidor(c, { existe: true, valor: { ...base, id: "a1", status: "cancelled" } as never });
    expect(st().appointments.find((a) => a.id === "a1")?.status).toBe("cancelled");
  });
});
