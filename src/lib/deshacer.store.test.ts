import { beforeEach, describe, expect, it } from "bun:test";
import { useSalonStore } from "./store";
import type { Appointment } from "./mock/types";

function nuevaCita(p: Partial<Appointment> = {}): Appointment {
  return useSalonStore.getState().addAppointment({
    clientId: "c-deshacer", clientName: "Lucía Prueba", serviceIds: ["corte"], employeeId: "mario",
    start: "2026-10-06T08:00:00.000Z", duration: 30, priceEur: 20, status: "confirmed", ...p,
  } as Omit<Appointment, "id">);
}
const cita = (id: string) => useSalonStore.getState().appointments.find((a) => a.id === id)!;
const ultimo = () => useSalonStore.getState().cambios[0];

beforeEach(() => useSalonStore.setState({ cambios: [], miembro: null }));

describe("deshacer en la store", () => {
  it("cancelar deja un cambio con solo el campo que cambió, y deshacerlo devuelve la cita", () => {
    const a = nuevaCita();
    useSalonStore.getState().cancelAppointment(a.id);
    expect(cita(a.id).status).toBe("cancelled");
    const c = ultimo();
    expect(c.tipo).toBe("cita.cancelar");
    expect(c.antes).toMatchObject({ status: "confirmed" });
    expect(c.resumen).toContain("Cancelada la cita de Lucía");
    expect(useSalonStore.getState().deshacerCambio(c.id)).toEqual({ ok: true });
    expect(cita(a.id).status).toBe("confirmed");
    // Queda contado y el original marcado: no se deshace dos veces.
    expect(useSalonStore.getState().cambios[0].deshaceA).toBe(c.id);
    expect(useSalonStore.getState().deshacerCambio(c.id)).toEqual({ ok: false, motivo: "DESHECHO" });
  });

  it("rechazar una solicitud se registra como rechazar", () => {
    const a = nuevaCita({ status: "pending" });
    useSalonStore.getState().cancelAppointment(a.id);
    expect(ultimo().tipo).toBe("cita.rechazar");
  });

  it("si la cita ha cambiado desde entonces, no se pisa: CAMBIADO", () => {
    const a = nuevaCita();
    useSalonStore.getState().cancelAppointment(a.id);
    const c = ultimo();
    useSalonStore.setState((s) => ({ appointments: s.appointments.map((x) => (x.id === a.id ? { ...x, status: "confirmed" } : x)) }));
    expect(useSalonStore.getState().deshacerCambio(c.id)).toEqual({ ok: false, motivo: "CAMBIADO" });
  });

  it("mover y deshacer; si la hora de antes ya está ocupada: SOLAPE", () => {
    const a = nuevaCita({ start: "2026-10-07T08:00:00.000Z" });
    useSalonStore.getState().updateAppointment(a.id, { start: "2026-10-07T10:00:00.000Z" });
    const c = ultimo();
    expect(c.tipo).toBe("cita.mover");
    nuevaCita({ start: "2026-10-07T08:00:00.000Z", clientId: "otra", clientName: "Otra" });
    expect(useSalonStore.getState().deshacerCambio(c.id)).toEqual({ ok: false, motivo: "SOLAPE" });
  });

  it("una acción que llama a otra registra un solo cambio", () => {
    const a = nuevaCita();
    useSalonStore.setState({ salonProfile: { ...useSalonStore.getState().salonProfile, depositEnabled: true, depositAmountEur: 20 } });
    useSalonStore.getState().pedirSenal(a.id);
    const n = useSalonStore.getState().cambios.length;
    useSalonStore.getState().markDepositReceived(a.id, true); // llama por dentro a recibirSenal
    expect(useSalonStore.getState().cambios.length).toBe(n + 1);
    expect(ultimo().tipo).toBe("senal.recibir");
  });

  it("borrar un servicio es reversible y vuelve con el mismo id", () => {
    const s = useSalonStore.getState().addService({ name: "Servicio deshacer", durationMin: 30, priceEur: 10 } as never);
    useSalonStore.getState().deleteService(s.id);
    expect(useSalonStore.getState().services.some((x) => x.id === s.id)).toBe(false);
    expect(ultimo().tipo).toBe("servicio.borrar");
    expect(useSalonStore.getState().deshacerCambio(ultimo().id).ok).toBe(true);
    expect(useSalonStore.getState().services.find((x) => x.id === s.id)?.name).toBe("Servicio deshacer");
  });

  it("permisos: una estilista no deshace lo de otra persona ni citas de otra profesional", () => {
    const a = nuevaCita({ employeeId: "mario" });
    useSalonStore.setState({ miembro: { userId: "maria", rol: "gerente", employeeId: null, displayName: "María" } });
    useSalonStore.getState().cancelAppointment(a.id);
    const c = ultimo();
    expect(c.autor).toBe("maria");
    useSalonStore.setState({ miembro: { userId: "noelia", rol: "estilista", employeeId: "noelia", displayName: "Noelia" } });
    expect(useSalonStore.getState().deshacerCambio(c.id)).toEqual({ ok: false, motivo: "PERMISO" });
    useSalonStore.setState({ miembro: { userId: "sub", rol: "subencargado", employeeId: null, displayName: null } });
    expect(useSalonStore.getState().deshacerCambio(c.id).ok).toBe(true);
  });

  it("clienta ya avisada: se deshace con aviso", () => {
    const a = nuevaCita();
    useSalonStore.getState().cancelAppointment(a.id);
    useSalonStore.getState().marcarAvisoEnviado(ultimo().id);
    expect(useSalonStore.getState().estadoDeshacer(ultimo().id)).toEqual({ puede: true, aviso: "CLIENTA_AVISADA" });
  });

  it("las acciones automáticas no registran nada", () => {
    const n = useSalonStore.getState().cambios.length;
    useSalonStore.getState().liberarSenalesVencidas(new Date("2030-01-01T00:00:00Z"));
    expect(useSalonStore.getState().cambios.length).toBe(n);
  });
});

describe("deshacer cambios del perfil (lote 9b)", () => {
  it("cada campo que cambia deja su propio cambio, con su inverso", () => {
    const antes = useSalonStore.getState().salonProfile.about;
    useSalonStore.getState().updateSalonProfile({ about: "Texto nuevo de la landing", teamHours: [["10:00–14:00"]] as never });
    const [c1, c2] = useSalonStore.getState().cambios;
    expect([c1.tipo, c2.tipo]).toEqual(["perfil.campo", "perfil.campo"]);
    const about = useSalonStore.getState().cambios.find((c) => c.idEntidad === "about")!;
    expect(about.resumen).toBe("Cambiado el texto «Sobre nosotros»");
    expect(useSalonStore.getState().deshacerCambio(about.id).ok).toBe(true);
    expect(useSalonStore.getState().salonProfile.about).toBe(antes);
  });

  it("una estilista no deshace un cambio de la landing; la gerente sí", () => {
    useSalonStore.setState({ miembro: { userId: "maria", rol: "gerente", employeeId: null, displayName: "María" } });
    useSalonStore.getState().updateSalonProfile({ address: "Calle Nueva 1" });
    const c = useSalonStore.getState().cambios[0];
    useSalonStore.setState({ miembro: { userId: "maria2", rol: "estilista", employeeId: "noelia", displayName: null } });
    expect(useSalonStore.getState().estadoDeshacer(c.id)).toEqual({ puede: false, motivo: "PERMISO" });
  });

  it("cargar un perfil (en pausa) no deja nada en el historial", async () => {
    const { conRegistroEnPausa } = await import("./store");
    const n = useSalonStore.getState().cambios.length;
    conRegistroEnPausa(() => useSalonStore.getState().updateSalonProfile({ name: "Otro salón cargado" }));
    expect(useSalonStore.getState().cambios.length).toBe(n);
  });

  it("las marcas internas de la lista de configuración no se registran", () => {
    const n = useSalonStore.getState().cambios.length;
    useSalonStore.getState().updateSalonProfile({ setupChecklistHidden: true } as never);
    expect(useSalonStore.getState().cambios.length).toBe(n);
  });
});

describe("WhatsApp y aviso a la clienta (lote 9b)", () => {
  it("abrir el WhatsApp de una cita marca su última modificación como avisada", () => {
    const a = nuevaCita({ start: "2026-10-08T08:00:00.000Z" });
    useSalonStore.getState().updateAppointment(a.id, { start: "2026-10-08T10:00:00.000Z" });
    const mover = ultimo();
    const otra = nuevaCita({ start: "2026-10-09T08:00:00.000Z", clientId: "otra2" });
    useSalonStore.getState().cancelAppointment(otra.id);
    const marcado = useSalonStore.getState().abrirWhatsAppDeCita(a.id, "https://wa.me/34600000000?text=x");
    expect(marcado).toBe(mover.id);
    expect(useSalonStore.getState().cambios.find((c) => c.id === mover.id)?.avisoEnviado).toBe(true);
    // La de la otra cita no se toca.
    expect(useSalonStore.getState().cambios.find((c) => c.idEntidad === otra.id)?.avisoEnviado).toBe(false);
    expect(useSalonStore.getState().estadoDeshacer(mover.id)).toEqual({ puede: true, aviso: "CLIENTA_AVISADA" });
  });

  it("sin modificaciones recientes de esa cita no marca nada", () => {
    const a = nuevaCita({ start: "2026-10-10T08:00:00.000Z" });
    expect(useSalonStore.getState().abrirWhatsAppDeCita(a.id, "https://wa.me/1")).toBeNull();
  });
});
