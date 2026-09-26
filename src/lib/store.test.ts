import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { selectDemosVisibles, useSalonStore } from "./store";

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

describe("la carta del panel viaja al perfil del salón real", () => {
  it("añadir, apagar y borrar un servicio reescribe salonProfile.menu con ids por nombre", () => {
    const st = useSalonStore.getState();
    st.setRealSalonSlug("salon-de-prueba-carta");
    const nuevo = st.addService({ name: "Mechas balayage", description: "", durationMin: 90, priceEur: 60, category: "Color" });
    expect(nuevo.id).toBe("mechas-balayage");
    expect(useSalonStore.getState().salonProfile.menu).toContain("Mechas balayage~90~60~Color~~mechas-balayage");
    st.updateService(nuevo.id, { active: false });
    expect(useSalonStore.getState().salonProfile.menu).toContain("Mechas balayage~90~60~Color~off~mechas-balayage");
    st.deleteService(nuevo.id);
    expect(useSalonStore.getState().salonProfile.menu?.some((m) => m.startsWith("Mechas balayage"))).toBe(false);
    st.setRealSalonSlug(null);
  });

  it("en una demo (sin slug real) la carta del perfil no se toca", () => {
    const st = useSalonStore.getState();
    st.setRealSalonSlug(null);
    const antes = useSalonStore.getState().salonProfile.menu;
    const nuevo = st.addService({ name: "Prueba demo", description: "", durationMin: 20, priceEur: 10 });
    expect(useSalonStore.getState().salonProfile.menu).toEqual(antes);
    st.deleteService(nuevo.id);
  });
});

describe("el refresco no deshace un cambio local sin guardar", () => {
  it("hydrateFromServer conserva la versión local de la cita marcada y toma el servidor para el resto", async () => {
    const { olvidarCambiosSinGuardar } = await import("./salon-sync");
    const st = useSalonStore.getState();
    st.setRealSalonSlug("salon-refresco");
    const base = { clientId: "c", clientName: "Ana", serviceIds: ["corte"], employeeId: "mario" as const, start: "2026-09-28T08:00:00.000Z", duration: 30, priceEur: 10, status: "pending" as const };
    // La subida falla (no hay servidor en las pruebas): la cita queda marcada como sin guardar.
    const local = st.addAppointment(base);
    st.updateAppointment(local.id, { status: "confirmed" });
    await new Promise((r) => setTimeout(r, 0));
    const remotaVieja = { ...local, status: "pending" as const };
    const otra = { ...base, id: "a-otra", clientName: "Otra" };
    st.hydrateFromServer({ appointments: [remotaVieja, otra], clients: [], waitlist: [] });
    const tras = useSalonStore.getState().appointments;
    expect(tras.find((a) => a.id === local.id)?.status).toBe("confirmed");
    expect(tras.find((a) => a.id === "a-otra")?.clientName).toBe("Otra");
    // Al darla por guardada, el siguiente refresco ya manda el servidor.
    olvidarCambiosSinGuardar();
    st.hydrateFromServer({ appointments: [remotaVieja], clients: [], waitlist: [] });
    expect(useSalonStore.getState().appointments.find((a) => a.id === local.id)?.status).toBe("pending");
    st.setRealSalonSlug(null);
  });
});

describe("demos fuera del panel real", () => {
  it("con slug real no se ven demos guardadas y vaciarDatosDeEjemplo apaga demoActive", () => {
    const st = useSalonStore.getState();
    st.markDemoActive();
    const demos = [{ id: "d1", savedAt: 1, name: "Demo" }] as unknown as typeof st.savedDemos;
    expect(selectDemosVisibles({ savedDemos: demos, realSalonSlug: "salon-real" })).toEqual([]);
    expect(selectDemosVisibles({ savedDemos: demos, realSalonSlug: null })).toBe(demos);
    st.vaciarDatosDeEjemplo();
    expect(useSalonStore.getState().demoActive).toBe(false);
  });
});

describe("señal: ciclo de vida desde el store", () => {
  const nueva = (extra: Partial<Parameters<ReturnType<typeof useSalonStore.getState>["addAppointment"]>[0]> = {}) =>
    useSalonStore.getState().addAppointment({
      clientId: "c-senal", clientName: "Ana Señal", serviceIds: ["corte"], employeeId: "mario",
      start: new Date(Date.now() + 3 * 24 * 3_600_000).toISOString(), duration: 45, priceEur: 25, status: "pending", ...extra,
    });
  const cita = (id: string) => useSalonStore.getState().appointments.find((a) => a.id === id)!;

  it("pedir, recibir y cobrar: al cobrar se descuenta y la caja lo resta", async () => {
    const { cierreDelDia } = await import("./caja");
    useSalonStore.getState().updateSalonProfile({ depositEnabled: true, depositAmountEur: 10, depositBizumPhone: "600000000" });
    const a = nueva({ start: new Date().toISOString(), status: "confirmed" });
    // Hoy ya empezó: no se puede pedir; se apunta directamente la recibida (la dejó en mano).
    expect(useSalonStore.getState().pedirSenal(a.id)).toBe("SENAL_CITA_CERRADA");
    expect(useSalonStore.getState().recibirSenal(a.id, { metodo: "efectivo", importeEur: 10 })).toBeNull();
    expect(cita(a.id)).toMatchObject({ depositStatus: "recibida", depositReceivedEur: 10, depositMethod: "efectivo" });
    useSalonStore.getState().markPaid(a.id, "tarjeta");
    expect(cita(a.id)).toMatchObject({ depositStatus: "aplicada", depositAppliedEur: 10 });
    const cierre = cierreDelDia([cita(a.id)], [], new Date());
    expect(cierre.total).toBe(15);
    expect(cierre.porMetodo.tarjeta).toBe(15);
    expect(cierre.senalesDescontadas).toBe(10);
    useSalonStore.getState().markPaid(a.id, null);
    expect(cita(a.id).depositStatus).toBe("recibida");
  });

  it("pedirSenal solo cuando se confirma el envío; reenviar no alarga el plazo", () => {
    useSalonStore.getState().updateSalonProfile({ depositEnabled: true, depositAmountEur: 10, depositDeadlineHours: 2 });
    const a = nueva();
    expect(cita(a.id).depositStatus).toBeUndefined();
    expect(useSalonStore.getState().pedirSenal(a.id)).toBeNull();
    const primera = cita(a.id).depositDueAt;
    expect(cita(a.id)).toMatchObject({ depositStatus: "pedida", depositEur: 10, depositPeriodHours: 2 });
    expect(useSalonStore.getState().pedirSenal(a.id)).toBeNull();
    expect(cita(a.id).depositDueAt).toBe(primera);
  });

  it("rechazar (salón) devuelve la recibida; plantón la retiene; deshacer la recupera", () => {
    useSalonStore.getState().updateSalonProfile({ depositEnabled: true, depositAmountEur: 10 });
    const r = nueva();
    useSalonStore.getState().recibirSenal(r.id, { metodo: "bizum" });
    useSalonStore.getState().cancelAppointment(r.id, { porSalon: true });
    expect(cita(r.id)).toMatchObject({ status: "cancelled", depositStatus: "devuelta", depositRefundedEur: 10 });
    useSalonStore.getState().updateAppointment(r.id, { status: "pending" });
    expect(cita(r.id).depositStatus).toBe("recibida");

    const p = nueva();
    useSalonStore.getState().recibirSenal(p.id, { metodo: "bizum" });
    useSalonStore.getState().updateAppointment(p.id, { status: "no-show" });
    expect(cita(p.id).depositStatus).toBe("retenida");
  });

  it("liberación automática: solo con la opción activa y solo las vencidas", () => {
    useSalonStore.getState().updateSalonProfile({ depositEnabled: true, depositAmountEur: 10, depositDeadlineHours: 1, depositAutoRelease: false });
    const a = nueva();
    useSalonStore.getState().pedirSenal(a.id);
    const dentroDeDosHoras = new Date(Date.now() + 2 * 3_600_000);
    expect(useSalonStore.getState().liberarSenalesVencidas(dentroDeDosHoras)).toBe(0);
    expect(cita(a.id).status).toBe("pending");
    useSalonStore.getState().updateSalonProfile({ depositAutoRelease: true });
    expect(useSalonStore.getState().liberarSenalesVencidas(new Date())).toBe(0);
    expect(useSalonStore.getState().liberarSenalesVencidas(dentroDeDosHoras)).toBeGreaterThanOrEqual(1);
    expect(cita(a.id)).toMatchObject({ status: "cancelled", depositStatus: "anulada" });
    useSalonStore.getState().updateSalonProfile({ depositEnabled: false, depositAutoRelease: false });
  });
});

describe("señal: reajuste al cambiar servicio u hora", () => {
  const nueva = () => useSalonStore.getState().addAppointment({
    clientId: "c-reaj", clientName: "Reajuste", serviceIds: ["mechas"], employeeId: "mario",
    start: new Date(Date.now() + 3 * 24 * 3_600_000).toISOString(), duration: 120, priceEur: 80, status: "confirmed",
  });
  const cita = (id: string) => useSalonStore.getState().appointments.find((a) => a.id === id)!;

  it("porcentaje: pasar a un servicio más barato deja la diferencia a devolver y al cobrar se descuenta solo lo debido", () => {
    useSalonStore.getState().updateSalonProfile({ depositEnabled: true, depositMode: "porcentaje", depositPercent: 25, depositAppliesTo: "todas" });
    const a = nueva();
    expect(useSalonStore.getState().recibirSenal(a.id, { metodo: "bizum" })).toBeNull();
    expect(cita(a.id)).toMatchObject({ depositReceivedEur: 20 });
    useSalonStore.getState().updateAppointment(a.id, { serviceIds: ["corte"], priceEur: 40, duration: 45 });
    expect(cita(a.id)).toMatchObject({ depositStatus: "recibida", depositEur: 10, depositRefundedEur: 10 });
    useSalonStore.getState().markPaid(a.id, "efectivo");
    expect(cita(a.id)).toMatchObject({ depositStatus: "aplicada", depositAppliedEur: 10, depositRefundedEur: 10 });
    expect(useSalonStore.getState().confirmarDevolucionSenal(a.id)).toBeNull();
    expect(cita(a.id).depositRefundedAt).toBeDefined();
  });

  it("a un servicio sin señal (regla por duración): se devuelve entera", () => {
    useSalonStore.getState().updateSalonProfile({ depositEnabled: true, depositMode: "fijo", depositAmountEur: 20, depositAppliesTo: "duracion", depositMinMinutes: 60 });
    const a = nueva();
    useSalonStore.getState().recibirSenal(a.id, { metodo: "bizum" });
    useSalonStore.getState().updateAppointment(a.id, { serviceIds: ["corte"], priceEur: 25, duration: 30 });
    expect(cita(a.id)).toMatchObject({ depositStatus: "devuelta", depositEur: 0, depositRefundedEur: 20 });
  });

  it("adelantar la cita recorta el plazo de la señal pedida", () => {
    useSalonStore.getState().updateSalonProfile({ depositEnabled: true, depositMode: "fijo", depositAmountEur: 20, depositAppliesTo: "todas", depositDeadlineHours: 4 });
    const a = nueva();
    useSalonStore.getState().pedirSenal(a.id);
    const enUnaHora = new Date(Date.now() + 3_600_000).toISOString();
    useSalonStore.getState().updateAppointment(a.id, { start: enUnaHora });
    expect(cita(a.id).depositDueAt).toBe(enUnaHora);
    useSalonStore.getState().updateSalonProfile({ depositEnabled: false, depositAppliesTo: "todas" });
  });
});

describe("caja (lote 11)", () => {
  it("registrarPago añade al array local; borrarPago lo quita", () => {
    const antes = useSalonStore.getState().payments.length;
    const p = useSalonStore.getState().registrarPago({
      importeEur: 20, metodo: "efectivo", concepto: "servicio", fecha: new Date().toISOString(),
    });
    expect(p.id).toBeTruthy();
    expect(p.origen).toBe("sishow");
    expect(useSalonStore.getState().payments).toHaveLength(antes + 1);
    expect(useSalonStore.getState().payments[0]).toMatchObject({ importeEur: 20, metodo: "efectivo" });
    useSalonStore.getState().borrarPago(p.id);
    expect(useSalonStore.getState().payments.find((x) => x.id === p.id)).toBeUndefined();
  });

  it("en una demo (sin salón real), cargarPagos y cerrarCaja no tocan la red y no rompen", async () => {
    expect(useSalonStore.getState().realSalonSlug).toBeNull();
    await useSalonStore.getState().cargarPagos("2026-01-01", "2026-01-31");
    const cierre = await useSalonStore.getState().cerrarCaja("2026-01-01", 50);
    expect(cierre).toBeNull();
  });
});
