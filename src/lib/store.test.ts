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
