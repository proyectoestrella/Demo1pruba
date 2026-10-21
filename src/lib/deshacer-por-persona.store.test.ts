/**
 * Deshacer por persona y aparato (store): permisos de estilista vs gerente,
 * conflicto con confirmación, cambios traídos del servidor y aparato.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { conRegistroEnPausa, useSalonStore } from "./store";
import type { Appointment } from "./mock/types";
import type { Cambio } from "./cambios";

const nueva = (p: Partial<Appointment> = {}): Appointment =>
  useSalonStore.getState().addAppointment({
    clientId: "c-p", clientName: "Lucía Prueba", serviceIds: ["corte"], employeeId: "mario",
    start: "2026-10-06T08:00:00.000Z", duration: 30, priceEur: 20, status: "confirmed", ...p,
  } as Omit<Appointment, "id">);
const cita = (id: string) => useSalonStore.getState().appointments.find((a) => a.id === id)!;
const ultimo = () => useSalonStore.getState().cambios[0];
const miembro = (userId: string, rol: "gerente" | "estilista", employeeId: string | null) =>
  useSalonStore.setState({ miembro: { userId, rol, employeeId, displayName: userId } });

beforeEach(() => useSalonStore.setState({ cambios: [], miembro: null }));

describe("cada cambio lleva su aparato y su autora", () => {
  it("guarda dispositivo (id + nombre) y profesional", () => {
    miembro("noelia", "estilista", "mario");
    const a = nueva();
    useSalonStore.getState().cancelAppointment(a.id);
    const c = ultimo();
    expect(c.autor).toBe("noelia");
    expect(c.empleadoId).toBe("mario");
    expect(c.dispositivoId && c.dispositivoId.length >= 8).toBe(true);
    expect(typeof c.dispositivoNombre).toBe("string");
  });
});

describe("permisos: la estilista solo deshace lo suyo; la gerente, todo", () => {
  it("una estilista NO puede deshacer lo de otra (PERMISO); la gerente sí", () => {
    miembro("sara", "estilista", "mario");
    const a = nueva();
    useSalonStore.getState().cancelAppointment(a.id);
    const deSara = ultimo();
    miembro("noelia", "estilista", "mario");
    expect(useSalonStore.getState().deshacerCambio(deSara.id)).toEqual({ ok: false, motivo: "PERMISO" });
    expect(cita(a.id).status).toBe("cancelled");
    miembro("gerente", "gerente", null);
    expect(useSalonStore.getState().deshacerCambio(deSara.id)).toEqual({ ok: true });
    expect(cita(a.id).status).toBe("confirmed");
  });
  it("lo suyo sí, aunque lo hiciera otro aparato (viene del servidor)", () => {
    miembro("noelia", "estilista", "mario");
    const a = nueva();
    useSalonStore.getState().updateAppointment(a.id, { status: "cancelled" });
    const real = ultimo();
    // Como si otro aparato lo hubiera hecho: se borra de la store y vuelve «del servidor».
    useSalonStore.setState({ cambios: [] });
    const remoto: Cambio = { ...real, dispositivoId: "otro-aparato", dispositivoNombre: "iPhone · Safari" };
    useSalonStore.getState().fusionarCambiosRemotos([remoto]);
    expect(useSalonStore.getState().estadoDeshacer(remoto.id)).toEqual({ puede: true });
    expect(useSalonStore.getState().deshacerCambio(remoto.id)).toEqual({ ok: true });
    expect(cita(a.id).status).toBe("confirmed");
  });
});

describe("conflicto: avisa y solo pisa con confirmación", () => {
  it("si la cita cambió después: CAMBIADO; con forzar se vuelve a lo de antes", () => {
    miembro("gerente", "gerente", null);
    const a = nueva();
    useSalonStore.getState().cancelAppointment(a.id);
    const c = ultimo();
    useSalonStore.setState((s) => ({ appointments: s.appointments.map((x) => (x.id === a.id ? { ...x, status: "in-progress" } : x)) }));
    expect(useSalonStore.getState().estadoDeshacer(c.id)).toEqual({ puede: false, motivo: "CAMBIADO" });
    expect(useSalonStore.getState().deshacerCambio(c.id)).toEqual({ ok: false, motivo: "CAMBIADO" });
    expect(cita(a.id).status).toBe("in-progress");
    expect(useSalonStore.getState().estadoDeshacer(c.id, true)).toEqual({ puede: true });
    expect(useSalonStore.getState().deshacerCambio(c.id, true)).toEqual({ ok: true });
    expect(cita(a.id).status).toBe("confirmed");
  });
  it("forzar nunca salta el permiso", () => {
    miembro("sara", "estilista", "mario");
    const a = nueva();
    useSalonStore.getState().cancelAppointment(a.id);
    const c = ultimo();
    miembro("noelia", "estilista", "mario");
    expect(useSalonStore.getState().deshacerCambio(c.id, true)).toEqual({ ok: false, motivo: "PERMISO" });
  });
  it("si la cita ya no existe: NO_ESTA (no es un CAMBIADO confuso)", () => {
    miembro("gerente", "gerente", null);
    const a = nueva();
    useSalonStore.getState().cancelAppointment(a.id);
    const c = ultimo();
    useSalonStore.setState((s) => ({ appointments: s.appointments.filter((x) => x.id !== a.id) }));
    expect(useSalonStore.getState().deshacerCambio(c.id, true)).toEqual({ ok: false, motivo: "NO_ESTA" });
  });
});

describe("fusionar cambios del servidor", () => {
  it("añade los nuevos y respeta un «deshecho» que otro aparato ya hizo", () => {
    miembro("gerente", "gerente", null);
    const a = nueva();
    useSalonStore.getState().cancelAppointment(a.id);
    const c = ultimo();
    useSalonStore.getState().fusionarCambiosRemotos([{ ...c, deshechoEn: "2026-10-22T10:00:00.000Z", deshechoPor: "x" }]);
    expect(useSalonStore.getState().cambios.find((x) => x.id === c.id)?.deshechoEn).toBe("2026-10-22T10:00:00.000Z");
    expect(useSalonStore.getState().estadoDeshacer(c.id)).toEqual({ puede: false, motivo: "DESHECHO" });
  });
});

describe("notas de la ficha de la clienta", () => {
  it("editar las notas se registra y se deshace; una importación masiva (en pausa) no", () => {
    miembro("gerente", "gerente", null);
    const cl = useSalonStore.getState().addClient({ name: "Ficha Prueba", phone: "600000001", notes: "antes" } as never);
    useSalonStore.getState().updateClient(cl.id, { notes: "después" });
    const c = ultimo();
    expect(c.tipo).toBe("clienta.editar");
    expect(c.antes).toEqual({ notes: "antes" });
    expect(useSalonStore.getState().deshacerCambio(c.id)).toEqual({ ok: true });
    expect(useSalonStore.getState().clients.find((x) => x.id === cl.id)?.notes).toBe("antes");
    const n = useSalonStore.getState().cambios.length;
    conRegistroEnPausa(() => useSalonStore.getState().updateClient(cl.id, { taxId: "X1", address: "Calle 1" }));
    expect(useSalonStore.getState().cambios.length).toBe(n);
  });
});
