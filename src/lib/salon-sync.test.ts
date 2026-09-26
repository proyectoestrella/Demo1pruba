import { afterEach, describe, expect, it, mock } from "bun:test";

/**
 * La garantía más importante de todo el backend: una demo de venta (las ~54 del
 * rutero, sin fila en `salons`) no llama a Supabase NUNCA. Se prueba contando
 * las llamadas reales a las server functions con el módulo interceptado.
 */
const llamadas: string[] = [];
const argumentosCitas: unknown[] = [];
/** Cuando está a `true`, TODA subida falla: es como tener la red caída. */
let fallarTodo = false;
let noGuardado = false;
let rechazo: string | null = null;
const registra =
  (nombre: string) =>
  (...args: unknown[]) => {
    llamadas.push(nombre);
    if (["syncAppointment", "syncAppointmentPatch", "applyClientPenalty", "clearClientPenalty"].includes(nombre)) argumentosCitas.push(args[0]);
    if (fallarTodo) return Promise.reject(new Error("red caída"));
    if (rechazo) return Promise.resolve({ synced: false as const, reason: rechazo });
    if (noGuardado) return Promise.resolve({ synced: false as const });
    return Promise.resolve({ synced: true as const });
  };

mock.module("./api/salons.functions", () => ({
  syncAppointment: registra("syncAppointment"),
  syncAppointmentPatch: registra("syncAppointmentPatch"),
  deleteAppointment: registra("deleteAppointment"),
  saveSalonProfile: registra("saveSalonProfile"),
  patchSalonProfile: registra("patchSalonProfile"),
  applyClientPenalty: registra("applyClientPenalty"),
  clearClientPenalty: registra("clearClientPenalty"),
  saveClientNotes: registra("saveClientNotes"),
  saveClient: registra("saveClient"),
  syncWaitlistEntry: registra("syncWaitlistEntry"),
  deleteWaitlistEntry: registra("deleteWaitlistEntry"),
  getSalonProfile: registra("getSalonProfile"),
  listSalonData: registra("listSalonData"),
  checkClientPenalty: registra("checkClientPenalty"),
}));

const idsDePago: string[] = [];
mock.module("./api/pagos.functions", () => ({
  registrarPago: (a: { data: { pago: { id: string } } }) => { idsDePago.push(a.data.pago.id); return registra("registrarPago")(a); },
  borrarPago: registra("borrarPago"),
  listarPagos: registra("listarPagos"),
  cerrarCaja: registra("cerrarCaja"),
}));

const {
  cambioSinGuardar,
  olvidarCambiosSinGuardar,
  pushAppointment,
  pushAppointmentPatch,
  pushManualBlock,
  guardarReservaPublica,
  pushAppointmentDeletion,
  pushSalonProfile,
  pushSalonProfilePatch,
  pushPenalty,
  pushPenaltyCleared,
  pushClientNotes,
  pushClient,
  pushPago,
  esperaDeReintentoParaPruebas,
  ESPERAS_REINTENTO_MS,
} = await import("./salon-sync");
// Los reintentos automáticos esperan 1 s, 3 s y 9 s: en pruebas, sin espera.
const esperasPedidas: number[] = [];
esperaDeReintentoParaPruebas(async (ms) => { esperasPedidas.push(ms); });
const { salon } = await import("./mock/salon");
const { leerAvisos, limpiarAvisos } = await import("./avisos-sync");

const cita = {
  id: "a-new-1",
  clientId: "c-1",
  clientName: "Marta",
  serviceIds: ["corte"],
  employeeId: "mario" as const,
  start: "2026-09-26T13:00:00.000Z",
  duration: 30,
  priceEur: 15,
  status: "pending" as const,
};

const cliente = {
  id: "c-1",
  name: "Marta",
  phone: "+34 600 111 222",
  createdAt: "2026-09-01T00:00:00.000Z",
  notes: "Usa el número 8",
};

it("el alta de una ficha sin cita se sube solo en un salón real", () => {
  pushClient(null, cliente);
  expect(llamadas).toEqual([]);
  pushClient("salon-real", cliente);
  expect(llamadas).toEqual(["saveClient"]);
});

afterEach(() => {
  llamadas.length = 0;
  argumentosCitas.length = 0;
  fallarTodo = false;
  noGuardado = false;
  rechazo = null;
  limpiarAvisos();
  olvidarCambiosSinGuardar();
});

describe("salon-sync con slug null (demo de venta)", () => {
  it("no hace ni una sola llamada a Supabase", () => {
    pushAppointment(null, cita);
    pushAppointmentDeletion(null, "a-new-1");
    pushSalonProfile(null, salon);
    pushSalonProfilePatch(null, { phone: "600 111 222" });
    pushPenalty(null, cliente, 7, "No vino");
    pushPenaltyCleared(null, cliente, "Perdonada");
    pushClientNotes(null, cliente);
    expect(llamadas).toEqual([]);
  });
});

describe("salon-sync con un salón real", () => {
  it("la reserva pública espera la confirmación real", async () => {
    await expect(
      guardarReservaPublica("the-best-shave-barber", cita, { name: "Marta", phone: "600111222" }),
    ).resolves.toBeUndefined();
    expect(llamadas).toEqual(["syncAppointment"]);
    expect(argumentosCitas[0]).toMatchObject({ data: { localId: cita.id, status: "pending" } });
  });

  it("un fallo de red conserva el id para reintentar sin duplicar la solicitud", async () => {
    fallarTodo = true;
    const cliente = { name: "Marta", phone: "600111222" };
    await expect(guardarReservaPublica("the-best-shave-barber", cita, cliente)).rejects.toThrow(
      "red caída",
    );
    fallarTodo = false;
    await guardarReservaPublica("the-best-shave-barber", cita, cliente);
    expect(argumentosCitas).toHaveLength(2);
    expect(argumentosCitas[1]).toEqual(argumentosCitas[0]);
  });

  it("no confunde `synced: false` con una cita guardada", async () => {
    noGuardado = true;
    await expect(
      guardarReservaPublica("the-best-shave-barber", cita, { name: "Marta", phone: "600111222" }),
    ).rejects.toThrow("RESERVA_NO_GUARDADA");
  });

  it("propaga el motivo del rechazo para mostrar el mensaje preciso", async () => {
    rechazo = "RESERVA_HUECO_OCUPADO";
    await expect(
      guardarReservaPublica("the-best-shave-barber", cita, { name: "Marta", phone: "600111222" }),
    ).rejects.toThrow("RESERVA_HUECO_OCUPADO");
  });

  it("sube la cita, el borrado y el perfil", () => {
    pushAppointment("the-best-shave-barber", cita);
    pushAppointmentDeletion("the-best-shave-barber", "a-new-1");
    pushSalonProfile("the-best-shave-barber", salon);
    expect(llamadas).toEqual(["syncAppointment", "deleteAppointment", "saveSalonProfile"]);
  });

  it("sube penalización, perdón y notas del cliente", () => {
    pushPenalty("the-best-shave-barber", cliente, 7, "No vino");
    pushPenaltyCleared("the-best-shave-barber", cliente, "Perdonada");
    pushClientNotes("the-best-shave-barber", cliente);
    expect(llamadas).toEqual(["applyClientPenalty", "clearClientPenalty", "saveClientNotes"]);
  });

  it("sin teléfono no hay ficha que marcar: no se llama a nada", () => {
    const sinTelefono = { ...cliente, phone: "" };
    pushPenalty("the-best-shave-barber", sinTelefono, 7);
    pushPenaltyCleared("the-best-shave-barber", sinTelefono);
    pushClientNotes("the-best-shave-barber", sinTelefono);
    pushPenalty("the-best-shave-barber", undefined, 7);
    expect(llamadas).toEqual([]);
  });
});

/**
 * Lo que el dueño ve cuando algo NO se guarda. Antes de esto, un fallo de red
 * acababa en la consola del navegador y en ningún otro sitio: el cambio se
 * veía hecho en pantalla y no lo estaba.
 */
describe("un fallo de guardado se ve en pantalla y se puede reintentar", () => {
  it("la cita que no sube deja un aviso en español, con el nombre del cliente", async () => {
    fallarTodo = true;
    pushAppointment("the-best-shave-barber", cita);
    await esperarAvisos();

    expect(leerAvisos()).toHaveLength(1);
    expect(leerAvisos()[0]!.mensaje).toBe(
      "No hemos podido guardar la cita de Marta. Se ve en esta pantalla, pero todavía no está guardado.",
    );
  });

  it("ningún aviso menciona tecnologías ni códigos de error", async () => {
    fallarTodo = true;
    pushAppointment("the-best-shave-barber", cita);
    pushSalonProfile("the-best-shave-barber", salon);
    pushPenalty("the-best-shave-barber", cliente, 7, "No vino");
    pushClientNotes("the-best-shave-barber", cliente);
    await esperarAvisos();

    expect(leerAvisos().length).toBeGreaterThanOrEqual(4);
    for (const aviso of leerAvisos()) {
      for (const jerga of ["Supabase", "sync", "Sync", "error", "PGRST", "fetch", "null"]) {
        expect(aviso.mensaje).not.toContain(jerga);
      }
    }
  });

  it("el perfil que no sube se cuenta sin hablar de perfiles ni de bases de datos", async () => {
    fallarTodo = true;
    pushSalonProfile("the-best-shave-barber", salon);
    await esperarAvisos();
    expect(leerAvisos()[0]!.mensaje).toContain("los datos de tu salón");
  });

  it("el botón de reintentar vuelve a subir, y si ya va bien no deja aviso nuevo", async () => {
    fallarTodo = true;
    pushAppointment("the-best-shave-barber", cita);
    await esperarAvisos();
    const reintentar = leerAvisos()[0]!.reintentar;
    expect(reintentar).toBeDefined();

    llamadas.length = 0;
    limpiarAvisos();
    fallarTodo = false;
    reintentar!();
    await esperarAvisos();

    expect(llamadas).toEqual(["syncAppointment"]);
    expect(leerAvisos()).toEqual([]);
  });

  it("si el reintento también falla, el aviso vuelve a aparecer", async () => {
    fallarTodo = true;
    pushAppointment("the-best-shave-barber", cita);
    await esperarAvisos();
    const reintentar = leerAvisos()[0]!.reintentar!;

    // El componente descarta el aviso al pulsar; la red sigue caída.
    limpiarAvisos();
    reintentar();
    await esperarAvisos();

    expect(leerAvisos()).toHaveLength(1);
    expect(leerAvisos()[0]!.mensaje).toContain("la cita de Marta");
    // Y sigue ofreciendo reintentar: el bucle lo cierra el dueño, no el código.
    expect(leerAvisos()[0]!.reintentar).toBeDefined();
  });

  it("cuando va bien no aparece ningún aviso", async () => {
    pushAppointment("the-best-shave-barber", cita);
    pushSalonProfile("the-best-shave-barber", salon);
    await esperarAvisos();
    expect(leerAvisos()).toEqual([]);
  });
});

/** Las subidas son fire-and-forget: hay que dejar correr la cola de promesas. */
async function esperarAvisos() {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

/**
 * El perfil ya no se sube entero desde Ajustes. Subirlo entero era lo que
 * permitía que un navegador con el perfil viejo en `localStorage` revirtiera
 * un campo cambiado desde otro dispositivo.
 */
describe("el perfil sube el parche, no el perfil entero", () => {
  it("usa patchSalonProfile, no saveSalonProfile", () => {
    pushSalonProfilePatch("the-best-shave-barber", { phone: "600 999 888" });
    expect(llamadas).toEqual(["patchSalonProfile"]);
  });

  it("un parche sin nada que decir no toca la red", () => {
    pushSalonProfilePatch("the-best-shave-barber", {});
    pushSalonProfilePatch("the-best-shave-barber", { phone: undefined });
    expect(llamadas).toEqual([]);
  });

  it("si el parche no sube, el dueño se entera", async () => {
    fallarTodo = true;
    pushSalonProfilePatch("the-best-shave-barber", { phone: "600 999 888" });
    await esperarAvisos();
    expect(leerAvisos()[0]!.mensaje).toContain("los datos de tu salón");
  });
});

describe("parche por campos desde el panel", () => {
  it("un parche que solo trae status no lleva la nota ni ningún otro campo", async () => {
    pushAppointmentPatch("the-best-shave-barber", { ...cita, note: "nota local vieja" }, { status: "confirmed" }, cliente);
    await Promise.resolve();
    expect(llamadas).toEqual(["syncAppointmentPatch"]);
    const enviado = argumentosCitas[0] as { data: { patch: Record<string, unknown> } };
    expect(enviado.data.patch).toEqual({ status: "confirmed" });
    expect(enviado.data.patch).not.toHaveProperty("note");
    expect(enviado.data.patch).not.toHaveProperty("technicalNotes");
  });

  it("la cita entera manda la nota limpia y las respuestas en su campo", () => {
    pushAppointment("the-best-shave-barber", { ...cita, note: "Trae foto", bookingAnswers: { hairLength: "Largo" }, origen: "tpv123" }, cliente);
    const enviado = argumentosCitas[0] as { data: Record<string, unknown> };
    expect(enviado.data.note).toBe("Trae foto");
    expect(enviado.data.bookingAnswers).toEqual({ hairLength: "Largo" });
    expect(enviado.data.origen).toBe("tpv123");
  });
});

describe("solapes desde el panel", () => {
  it("permitirSolape viaja explícito en el alta y en el parche, y por defecto es false", async () => {
    pushAppointment("the-best-shave-barber", { ...cita, id: "s-1" }, cliente);
    pushAppointment("the-best-shave-barber", { ...cita, id: "s-2" }, cliente, { permitirSolape: true });
    pushAppointmentPatch("the-best-shave-barber", { ...cita, id: "s-3" }, { start: cita.start }, cliente, { permitirSolape: true });
    await esperarAvisos();
    const [sin, con, parche] = argumentosCitas as Array<{ data: { permitirSolape?: boolean } }>;
    expect(sin.data.permitirSolape).toBe(false);
    expect(con.data.permitirSolape).toBe(true);
    expect(parche.data.permitirSolape).toBe(true);
  });

  it("un rechazo por solape no se da por guardado: se convierte en aviso reintentable", async () => {
    rechazo = "RESERVA_SOLAPE_PANEL";
    pushAppointment("the-best-shave-barber", cita, cliente);
    await new Promise((r) => setTimeout(r, 0));
    expect(leerAvisos().some((a) => a.mensaje.includes("la cita de"))).toBe(true);
  });
});

describe("cambios locales sin guardar", () => {
  it("una cita queda marcada mientras sube y se desmarca al guardarse", async () => {
    pushAppointment("the-best-shave-barber", cita, cliente);
    expect(cambioSinGuardar(`cita:${cita.id}`)).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(cambioSinGuardar(`cita:${cita.id}`)).toBe(false);
  });

  it("si la subida falla, sigue marcada hasta que el reintento la guarde", async () => {
    fallarTodo = true;
    pushAppointmentPatch("the-best-shave-barber", cita, { status: "confirmed" }, cliente);
    await new Promise((r) => setTimeout(r, 0));
    expect(cambioSinGuardar(`cita:${cita.id}`)).toBe(true);
    fallarTodo = false;
    leerAvisos()[0]!.reintentar?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(cambioSinGuardar(`cita:${cita.id}`)).toBe(false);
  });
});

describe("bloqueo manual con columna propia", () => {
  const ficha = { id: "c-1", name: "Ana", phone: "600111222", createdAt: "2026-01-01T00:00:00.000Z" };

  it("bloquear manda manualBlock:true y desbloquear manualBlock:false", () => {
    pushManualBlock("the-best-shave-barber", ficha, true);
    pushManualBlock("the-best-shave-barber", ficha, false);
    const [bloqueo, desbloqueo] = argumentosCitas as Array<{ data: { manualBlock?: boolean } }>;
    expect(llamadas).toEqual(["applyClientPenalty", "clearClientPenalty"]);
    expect(bloqueo.data.manualBlock).toBe(true);
    expect(desbloqueo.data.manualBlock).toBe(false);
  });
});

/**
 * Barrido de calidad 2026-09-26: red lenta y 5xx de paso. El dueño no debe
 * ver un aviso por un corte de un segundo, nada se duplica al repetir, y
 * dos cambios de la misma cita llegan en el orden en que se hicieron.
 */
describe("reintentos automáticos con espera creciente", () => {
  it("un fallo pasajero se reintenta solo y no llega a aviso", async () => {
    let fallos = 2;
    const original = fallarTodo;
    fallarTodo = true;
    esperaDeReintentoParaPruebas(async (ms) => { esperasPedidas.push(ms); if (--fallos === 0) fallarTodo = original; });
    esperasPedidas.length = 0;
    pushAppointment("the-best-shave-barber", cita, cliente);
    await esperarAvisos();
    esperaDeReintentoParaPruebas(async (ms) => { esperasPedidas.push(ms); });
    expect(esperasPedidas).toEqual([ESPERAS_REINTENTO_MS[0], ESPERAS_REINTENTO_MS[1]]);
    expect(llamadas).toEqual(["syncAppointment", "syncAppointment", "syncAppointment"]);
    expect(leerAvisos()).toEqual([]);
    expect(cambioSinGuardar(`cita:${cita.id}`)).toBe(false);
  });

  it("si la red sigue caída, se rinde tras los reintentos y deja UN aviso", async () => {
    fallarTodo = true;
    esperasPedidas.length = 0;
    pushAppointment("the-best-shave-barber", cita, cliente);
    await esperarAvisos();
    expect(esperasPedidas).toEqual([...ESPERAS_REINTENTO_MS]);
    expect(llamadas).toHaveLength(1 + ESPERAS_REINTENTO_MS.length);
    expect(leerAvisos()).toHaveLength(1);
    expect(cambioSinGuardar(`cita:${cita.id}`)).toBe(true);
  });

  it("un rechazo del servidor (solape) no se reintenta: reintentar no lo arregla", async () => {
    rechazo = "RESERVA_SOLAPE_PANEL";
    pushAppointment("the-best-shave-barber", cita, cliente);
    await esperarAvisos();
    expect(llamadas).toEqual(["syncAppointment"]);
    expect(leerAvisos()).toHaveLength(1);
  });

  it("un pago que se reintenta viaja siempre con el mismo id (el servidor ignora duplicados)", async () => {
    let fallos = 1;
    fallarTodo = true;
    esperaDeReintentoParaPruebas(async () => { if (--fallos === 0) fallarTodo = false; });
    idsDePago.length = 0;
    pushPago("the-best-shave-barber", {
      id: "p-1", appointmentId: cita.id, clientId: "c-1", clientName: "Marta", importeEur: 15,
      metodo: "efectivo", concepto: "cita", fecha: "2026-09-26T13:30:00.000Z",
    } as never);
    await esperarAvisos();
    esperaDeReintentoParaPruebas(async (ms) => { esperasPedidas.push(ms); });
    expect(idsDePago).toEqual(["p-1", "p-1"]);
    expect(leerAvisos()).toEqual([]);
  });

  it("la ficha sin teléfono es un alta que no se repite sola (evita fichas dobles)", async () => {
    fallarTodo = true;
    pushClient("the-best-shave-barber", { ...cliente, id: "c-sin-tel", phone: "" });
    await esperarAvisos();
    expect(llamadas).toEqual(["saveClient"]);
    expect(leerAvisos()).toHaveLength(1);
  });

  it("dos cambios de la misma cita suben en orden aunque el primero tenga que reintentarse", async () => {
    let fallos = 1;
    fallarTodo = true;
    esperaDeReintentoParaPruebas(async () => { await new Promise((r) => setTimeout(r, 0)); if (--fallos === 0) fallarTodo = false; });
    pushAppointmentPatch("the-best-shave-barber", cita, { status: "confirmed" }, cliente);
    pushAppointmentPatch("the-best-shave-barber", cita, { status: "completed" }, cliente);
    await esperarAvisos();
    esperaDeReintentoParaPruebas(async (ms) => { esperasPedidas.push(ms); });
    const estados = (argumentosCitas as Array<{ data: { patch: { status: string } } }>).map((a) => a.data.patch.status);
    // confirmed falla; su reintento ya no se manda porque «completed» es
    // posterior y toca el mismo campo; completed llega después y gana.
    expect(estados).toEqual(["confirmed", "completed"]);
    expect(leerAvisos()).toEqual([]);
  });
});

describe("el botón «Reintentar» respeta el orden (segunda pasada)", () => {
  it("un parche viejo reintentado a mano no pisa un campo que cambió después", async () => {
    fallarTodo = true;
    pushAppointmentPatch("the-best-shave-barber", cita, { status: "confirmed", note: "vieja" }, cliente);
    await esperarAvisos();
    const reintentar = leerAvisos()[0]!.reintentar!;
    fallarTodo = false;
    pushAppointmentPatch("the-best-shave-barber", cita, { status: "completed" }, cliente);
    await esperarAvisos();
    argumentosCitas.length = 0;
    limpiarAvisos();
    reintentar();
    await esperarAvisos();
    // Solo viaja lo que nadie ha vuelto a tocar: la nota, no el estado.
    expect((argumentosCitas as Array<{ data: { patch: object } }>).map((a) => a.data.patch)).toEqual([{ note: "vieja" }]);
    expect(leerAvisos()).toEqual([]);
  });

  it("reintentar la cita entera tras otro cambio de ella no la sube con la versión vieja", async () => {
    fallarTodo = true;
    pushAppointment("the-best-shave-barber", { ...cita, id: "r-1" }, cliente);
    await esperarAvisos();
    const reintentar = leerAvisos()[0]!.reintentar!;
    fallarTodo = false;
    pushAppointmentPatch("the-best-shave-barber", { ...cita, id: "r-1" }, { status: "completed" }, cliente);
    await esperarAvisos();
    llamadas.length = 0;
    reintentar();
    await esperarAvisos();
    expect(llamadas).toEqual([]);
  });

  it("el reintento espera a que termine la subida en curso de esa cita", async () => {
    fallarTodo = true;
    pushAppointmentPatch("the-best-shave-barber", { ...cita, id: "q-1" }, { note: "a" }, cliente);
    await esperarAvisos();
    const reintentar = leerAvisos()[0]!.reintentar!;
    fallarTodo = false;
    let soltar!: () => void;
    esperaDeReintentoParaPruebas(() => new Promise<void>((r) => { soltar = r; }));
    fallarTodo = true;
    pushAppointmentPatch("the-best-shave-barber", { ...cita, id: "q-1" }, { status: "completed" }, cliente);
    await esperarAvisos();
    argumentosCitas.length = 0;
    fallarTodo = false;
    reintentar();
    await esperarAvisos();
    expect(argumentosCitas).toEqual([]); // en cola, detrás del parche que está esperando
    soltar();
    await esperarAvisos();
    esperaDeReintentoParaPruebas(async (ms) => { esperasPedidas.push(ms); });
    const orden = (argumentosCitas as Array<{ data: { patch: object } }>).map((a) => a.data.patch);
    expect(orden).toEqual([{ status: "completed" }, { note: "a" }]);
  });
});
