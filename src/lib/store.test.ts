import { describe, expect, it } from "bun:test";
import { useSalonStore } from "./store";

/**
 * Reservas de la web pública nacen "pending" (ver s.$salonSlug.book.tsx) y el
 * salón las confirma o rechaza desde el panel — ver `PendingRequestsBanner`.
 * Aquí se prueban las dos acciones del store sin montar nada de React.
 */
describe("solicitudes pendientes de confirmar", () => {
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
});
