import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { useSalonStore } from "./store";

/**
 * Reservas de la web pública nacen "pending" (ver s.$salonSlug.book.tsx) y el
 * salón las confirma o rechaza desde el panel — ver `PendingRequestsBanner`.
 * Aquí se prueban las dos acciones del store sin montar nada de React.
 */
describe("solicitudes pendientes de confirmar", () => {
  it("anota una reserva ya guardada una sola vez y sin cambiar su id", () => {
    const cita = {
      id: `a-public-test-${crypto.randomUUID()}`,
      clientId: "c-test-publica",
      clientName: "Cliente de prueba",
      serviceIds: ["corte"],
      employeeId: "mario" as const,
      start: "2026-09-26T13:00:00.000Z",
      duration: 30,
      priceEur: 20,
      status: "pending" as const,
    };
    const { addSavedPublicAppointment } = useSalonStore.getState();
    addSavedPublicAppointment(cita);
    addSavedPublicAppointment(cita);
    expect(useSalonStore.getState().appointments.filter((a) => a.id === cita.id)).toEqual([cita]);
  });

  it("confirmar pasa la cita de pendiente a confirmada", () => {
    const { addAppointment, updateAppointment } = useSalonStore.getState();
    const appt = addAppointment({
      clientId: "c-test-confirmar",
      clientName: "Cliente de prueba",
      serviceIds: ["corte"],
      employeeId: "mario",
      start: new Date().toISOString(),
      duration: 30,
      priceEur: 20,
      status: "pending",
    });
    expect(useSalonStore.getState().appointments.find((a) => a.id === appt.id)?.status).toBe(
      "pending",
    );

    updateAppointment(appt.id, { status: "confirmed" });

    expect(useSalonStore.getState().appointments.find((a) => a.id === appt.id)?.status).toBe(
      "confirmed",
    );
  });

  it("rechazar pasa la cita de pendiente a cancelada", () => {
    const { addAppointment, cancelAppointment } = useSalonStore.getState();
    const appt = addAppointment({
      clientId: "c-test-rechazar",
      clientName: "Otro cliente",
      serviceIds: ["corte"],
      employeeId: "mario",
      start: new Date().toISOString(),
      duration: 30,
      priceEur: 20,
      status: "pending",
    });

    cancelAppointment(appt.id);

    expect(useSalonStore.getState().appointments.find((a) => a.id === appt.id)?.status).toBe(
      "cancelled",
    );
  });
});

/**
 * Política de plantón (ver AppointmentDetailSheet.tsx y ClientHistorySheet.tsx):
 * aplicar y cerrar una penalización, probadas aquí sin montar React.
 */
describe("penalización por plantón", () => {
  const originalProfile = useSalonStore.getState().salonProfile;
  beforeEach(() => useSalonStore.setState({ salonProfile: { ...originalProfile, noShowFeeEur: 7 } }));
  afterEach(() => useSalonStore.setState({ salonProfile: originalProfile }));
  it("applyPenalty marca al cliente con el importe y la nota", () => {
    const { addClient, applyPenalty } = useSalonStore.getState();
    const cliente = addClient({ name: "Cliente Plantón", phone: "+34 600 000 099" });

    applyPenalty(cliente.id, 7, "No vino el 12 sept · Corte");

    const actualizado = useSalonStore.getState().clients.find((c) => c.id === cliente.id);
    expect(actualizado?.penaltyEur).toBe(7);
    expect(actualizado?.penaltyNote).toBe("No vino el 12 sept · Corte");
  });

  it("clearPenalty('perdonado') limpia la deuda del cliente", () => {
    const { addClient, applyPenalty, clearPenalty } = useSalonStore.getState();
    const cliente = addClient({ name: "Otro Cliente", phone: "+34 600 000 098" });
    applyPenalty(cliente.id, 7, "No vino");

    clearPenalty(cliente.id, "perdonado");

    const actualizado = useSalonStore.getState().clients.find((c) => c.id === cliente.id);
    expect(actualizado?.penaltyEur).toBeUndefined();
  });

  it("clearPenalty('cobrado') también limpia la deuda", () => {
    const { addClient, applyPenalty, clearPenalty } = useSalonStore.getState();
    const cliente = addClient({ name: "Tercer Cliente", phone: "+34 600 000 097" });
    applyPenalty(cliente.id, 7, "No vino");

    clearPenalty(cliente.id, "cobrado");

    const actualizado = useSalonStore.getState().clients.find((c) => c.id === cliente.id);
    expect(actualizado?.penaltyEur).toBeUndefined();
  });

  it("reviewPenalty('Mantener') deja la deuda pendiente pero marca revisado", () => {
    const { addClient, applyPenalty, reviewPenalty } = useSalonStore.getState();
    const cliente = addClient({ name: "Cuarto Cliente", phone: "+34 600 000 096" });
    applyPenalty(cliente.id, 7, "Llegó tarde", { reason: "late", lateMinutes: 15 });

    reviewPenalty(cliente.id);

    const actualizado = useSalonStore.getState().clients.find((c) => c.id === cliente.id);
    // Sigue debiendo el recargo: "Mantener" no es "Perdonar" ni "Cobrado".
    expect(actualizado?.penaltyEur).toBe(7);
    expect(actualizado?.penaltyReviewedAt).toBeTruthy();
  });

  it("una nueva penalización sobre un cliente ya revisado vuelve a contar como nueva", () => {
    const { addClient, applyPenalty, reviewPenalty } = useSalonStore.getState();
    const cliente = addClient({ name: "Quinto Cliente", phone: "+34 600 000 095" });
    applyPenalty(cliente.id, 7, "No vino");
    reviewPenalty(cliente.id);
    expect(
      useSalonStore.getState().clients.find((c) => c.id === cliente.id)?.penaltyReviewedAt,
    ).toBeTruthy();

    applyPenalty(cliente.id, 7, "No vino otra vez");

    const actualizado = useSalonStore.getState().clients.find((c) => c.id === cliente.id);
    expect(actualizado?.penaltyReviewedAt).toBeUndefined();
  });
});

describe("salón sin recargo", () => {
  const originalProfile = useSalonStore.getState().salonProfile;
  beforeEach(() => useSalonStore.setState({ salonProfile: { ...originalProfile, noShowFeeEur: 0 } }));
  afterEach(() => useSalonStore.setState({ salonProfile: originalProfile }));

  it("marcar una cita como no vino no genera deuda aunque se intente aplicar", () => {
    const { addClient, addAppointment, updateAppointment, applyPenalty, setDeuda } = useSalonStore.getState();
    const cliente = addClient({ name: "Sin recargo", phone: "600000088" });
    const cita = addAppointment({
      clientId: cliente.id, clientName: cliente.name, serviceIds: ["corte"],
      employeeId: "mario", start: new Date().toISOString(), duration: 30,
      priceEur: 20, status: "confirmed",
    });
    updateAppointment(cita.id, { status: "no-show" });
    applyPenalty(cliente.id, 7, "No vino");
    setDeuda(cliente.id, { penaltyEur: 7, penaltyBlock: true });
    const state = useSalonStore.getState();
    expect(state.appointments.find((a) => a.id === cita.id)?.status).toBe("no-show");
    expect(state.clients.find((c) => c.id === cliente.id)?.penaltyEur).toBeUndefined();
    expect(state.clients.find((c) => c.id === cliente.id)?.penaltyBlock).toBeUndefined();
  });

  it("bloquear y desbloquear a mano no crea deuda", () => {
    const { addClient, setManualBlock } = useSalonStore.getState();
    const cliente = addClient({ name: "Bloqueada", phone: "600000089" });
    setManualBlock(cliente.id, true);
    expect(useSalonStore.getState().clients.find((c) => c.id === cliente.id)).toMatchObject({ manualBlock: true });
    expect(useSalonStore.getState().clients.find((c) => c.id === cliente.id)?.penaltyEur).toBeUndefined();
    setManualBlock(cliente.id, false);
    expect(useSalonStore.getState().clients.find((c) => c.id === cliente.id)?.manualBlock).toBe(false);
  });
});
